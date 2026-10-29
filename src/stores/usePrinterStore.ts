import { create } from 'zustand';
import { defaultConnection, defaultJob, defaultPosition, defaultStats, defaultTemperatures } from '../domain/defaults';
import type {
  CommandStatus,
  ConnectionDetails,
  ConnectionState,
  FileEntry,
  JobState,
  MachineStats,
  PositionState,
  PrinterTemperatures,
  SystemVersions,
} from '../domain/models';
import { CommandService } from '../services/commands';
import { MoonrakerHttpClient } from '../transport/moonrakerHttp';
import { MoonrakerSocket } from '../transport/moonrakerSocket';
import { hhmmFromSeconds } from '../utils/format';

type ThemeKey = 'purple' | 'blue' | 'green' | 'rose';

interface PrinterStore {
  profileName: string;
  connectionState: ConnectionState;
  connection: ConnectionDetails;
  temperatures: PrinterTemperatures;
  temperatureHistory: Record<string, number[]>;
  job: JobState;
  position: PositionState;
  stats: MachineStats;
  files: FileEntry[];
  selectedFile?: FileEntry;
  macros: string[];
  logs: string[];
  versions: SystemVersions;
  updateCount: number;
  commandQueue: CommandStatus[];
  theme: ThemeKey;
  fanPartPercent: number;
  fanChamberPercent: number;
  speedPercent: number;
  flowPercent: number;
  boot: () => void;
  disconnect: () => void;
  setTheme: (theme: ThemeKey) => void;
  setConnectionUrls: (baseUrl: string, wsUrl: string) => void;
  runAction: (label: string, action: () => Promise<unknown>) => Promise<void>;
  setSelectedFile: (path: string) => void;
  pendingPrintLaunch: boolean;
  setPendingPrintLaunch: (value: boolean) => void;
}

type PrinterSetState = (
  partial:
    | PrinterStore
    | Partial<PrinterStore>
    | ((state: PrinterStore) => PrinterStore | Partial<PrinterStore>),
  replace?: boolean,
) => void;

type PrinterGetState = () => PrinterStore;

let socketClient: MoonrakerSocket | undefined;
let pollTimer: number | undefined;
let dynamicObjects: string[] = [];
let dynamicCache: Record<string, any> = {};

function parseStatusPayload(payload: unknown) {
  if (typeof payload !== 'object' || payload === null) return undefined;
  const root = payload as { method?: string; params?: unknown[] };
  if (root.method !== 'notify_status_update') return undefined;
  const first = root.params?.[0];
  if (typeof first !== 'object' || first === null) return undefined;
  return first as Record<string, any>;
}

const normalizeProfileName = (value: string) => {
  return value
    .trim()
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
};

const isIpOrLocalHost = (value: string) => {
  const raw = value.trim().toLowerCase();
  if (!raw) return true;
  if (raw === 'localhost' || raw === '127.0.0.1' || raw === '::1') return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(raw)) return true;
  return false;
};

const pushHistory = (history: Record<string, number[]>, key: string, value: number, max = 64) => {
  const current = history[key] ?? [];
  const next = [...current, value];
  if (next.length > max) {
    next.shift();
  }
  history[key] = next;
};

const toPercent = (raw: unknown, fallback: number) => {
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return fallback;
  if (numeric <= 1) return Math.round(numeric * 100);
  return Math.round(Math.max(0, Math.min(100, numeric)));
};

const collectStateCandidates = (value: unknown, out: string[]) => {
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (normalized) {
      out.push(normalized);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectStateCandidates(entry, out));
    return;
  }

  if (value && typeof value === 'object') {
    Object.entries(value as Record<string, unknown>).forEach(([key, nested]) => {
      if (/state|status/i.test(key) || key === 'printer' || key === 'webhooks' || key === 'idle_timeout') {
        collectStateCandidates(nested, out);
      }
    });
  }
};

const resolvePrinterState = (status: Record<string, any>, fallback: JobState['state']) => {
  const candidates: string[] = [];
  collectStateCandidates(status, candidates);

  const explicit = candidates
    .map((candidate) => candidate.trim().toLowerCase())
    .filter((candidate) => [
      'printing',
      'paused',
      'complete',
      'error',
      'shutdown',
      'startup',
      'starting',
      'booting',
      'idle',
      'ready',
      'standby',
      'offline',
      'halted',
    ].includes(candidate));

  const resolved = explicit.find((candidate) => {
    return candidate === 'printing' || candidate === 'paused' || candidate === 'complete' || candidate === 'error' || candidate === 'shutdown' || candidate === 'startup' || candidate === 'starting' || candidate === 'booting' || candidate === 'idle' || candidate === 'ready' || candidate === 'standby' || candidate === 'offline' || candidate === 'halted';
  });

  if (!resolved) return fallback;
  const normalized = resolved.trim().toLowerCase();
  if (normalized === 'printing' || normalized === 'paused' || normalized === 'complete' || normalized === 'error') return normalized;
  if (normalized === 'shutdown' || normalized === 'offline' || normalized === 'halted') return 'shutdown';
  if (normalized === 'startup' || normalized === 'starting' || normalized === 'booting') return 'startup';
  return 'idle';
};

const readHeater = (
  status: Record<string, any>,
  key: string,
  fallback: { current: number; target: number },
) => ({
  current: Number(status[key]?.temperature ?? fallback.current),
  target: Number(status[key]?.target ?? fallback.target),
});

const dynamicFieldsForObject = (name: string) => {
  if (name.startsWith('output_pin ')) {
    return ['value'];
  }

  if (
    name.startsWith('temperature_sensor ') ||
    name.startsWith('temperature_fan ') ||
    name.startsWith('heater_generic ')
  ) {
    return ['temperature', 'target', 'speed'];
  }

  if (
    name.startsWith('fan_generic ') ||
    name.startsWith('controller_fan ') ||
    name.startsWith('heater_fan ')
  ) {
    return ['speed'];
  }

  return ['temperature', 'target', 'speed', 'value'];
};

const resolveObjectName = (name: string, objects: string[]) => {
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  if (objects.includes(trimmed)) return trimmed;

  const candidates = [
    `temperature_sensor ${trimmed}`,
    `temperature_fan ${trimmed}`,
    `heater_generic ${trimmed}`,
    `fan_generic ${trimmed}`,
    `controller_fan ${trimmed}`,
    `heater_fan ${trimmed}`,
    `output_pin ${trimmed}`,
  ];

  return candidates.find((candidate) => objects.includes(candidate));
};

const getDynamicTemperatureObjects = (status: Record<string, any>, objects: string[]) => {
  const fromHeaters = [
    ...((status.heaters?.available_heaters as string[] | undefined) ?? []),
    ...((status.heaters?.available_sensors as string[] | undefined) ?? []),
    ...((status.heaters?.available_monitors as string[] | undefined) ?? []),
  ].map((name) => resolveObjectName(String(name), objects)).filter((name): name is string => Boolean(name));

  const fromObjectList = objects.filter((name) => {
    return (
      name.startsWith('temperature_sensor ') ||
      name.startsWith('temperature_fan ') ||
      name.startsWith('heater_generic ') ||
      name.startsWith('fan_generic ') ||
      name.startsWith('controller_fan ') ||
      name.startsWith('heater_fan ') ||
      name.startsWith('output_pin ')
    );
  });

  return Array.from(new Set([...fromHeaters, ...fromObjectList])).filter(Boolean);
};

const deriveTemperatures = (dynamicStatus: Record<string, any>, previous: PrinterStore['temperatures']) => {
  const currentState = { temperatures: previous };
  const sensors = Object.entries(dynamicStatus).reduce<Record<string, { current: number; target: number }>>((acc, [key, value]) => {
    const sensorName = key.includes(' ') ? key.split(' ').slice(1).join(' ') : key;
    const previousSensor = currentState.temperatures.sensors[sensorName];
    const hasTemperature = Number.isFinite(Number((value as any)?.temperature));
    if (!hasTemperature && !previousSensor) {
      return acc;
    }
    acc[sensorName] = {
      current: Number((value as any)?.temperature ?? previousSensor?.current ?? currentState.temperatures.ambient),
      target: Number((value as any)?.target ?? previousSensor?.target ?? 0),
    };
    return acc;
  }, {});

  const chamberSensorEntry = Object.entries(dynamicStatus).find(([name]) => {
    return (
      name.trim().toLowerCase() === 'chamber' ||
      /temperature_sensor\s+chamber/i.test(name) ||
      (/\bchamber\b/i.test(name) && /sensor/i.test(name))
    );
  });

  const chamberControlEntry = Object.entries(dynamicStatus).find(([name]) => {
    return /temperature_fan\s+chamber/i.test(name) || /heater_generic\s+chamber/i.test(name);
  });

  const chamberCandidate = Object.entries(sensors).find(([name]) => /^chamber$/i.test(name) || /\bchamber\b/i.test(name));

  const chamberCurrent = Number(
    (chamberSensorEntry?.[1] as any)?.temperature ?? chamberCandidate?.[1]?.current ?? currentState.temperatures.chamber.current,
  );
  const chamberTarget = Number(
    (chamberControlEntry?.[1] as any)?.target
      ?? (chamberControlEntry?.[1] as any)?.target_temp
      ?? chamberCandidate?.[1]?.target
      ?? currentState.temperatures.chamber.target,
  );

  const chamber = {
    current: chamberCurrent,
    target: chamberTarget,
  };

  const sensorEntries = Object.entries(sensors);
  const ambientCandidates = sensorEntries.filter(([name]) => /ambient|air|enclosure/i.test(name));
  const controllerCandidates = sensorEntries.filter(([name]) => /mcu|board|controller|electronics/i.test(name));
  const piCandidates = sensorEntries.filter(([name]) => /pi|raspberry|soc|cpu/i.test(name));

  const ambient = ambientCandidates[0]?.[1].current ?? currentState.temperatures.ambient;
  const controller = controllerCandidates[0]?.[1].current ?? currentState.temperatures.controller;
  const raspberryPi = piCandidates[0]?.[1].current ?? currentState.temperatures.raspberryPi;

  return { sensors, chamber, ambient, controller, raspberryPi };
};

const parseNetworkInterfaces = (networkResult: Record<string, unknown>) => {
  const root = (networkResult.result as any) ?? {};
  const interfaces: any[] = Array.isArray(root.interfaces)
    ? root.interfaces
    : Object.values(root.network ?? root.interfaces ?? {}).filter((entry) => typeof entry === 'object');

  return interfaces.map((entry) => {
    const info = entry as any;
    const name = String(info.ifname ?? info.interface ?? info.device ?? info.name ?? 'unknown');
    const lower = name.toLowerCase();
    const type: 'wifi' | 'ethernet' | 'other' = lower.startsWith('wl') || info.ssid
      ? 'wifi'
      : lower.startsWith('en') || lower.startsWith('eth')
        ? 'ethernet'
        : 'other';

    const ipAddresses = (Array.isArray(info.ip_addresses) ? info.ip_addresses : info.addresses ?? [])
      .map((addr: any) => String(addr.address ?? addr.ip_address ?? addr ?? ''))
      .filter(Boolean);

    return {
      name,
      type,
      isUp: Boolean(info.is_up ?? info.up ?? false),
      ssid: info.ssid ? String(info.ssid) : undefined,
      signalDbm: Number.isFinite(Number(info.signal_dbm)) ? Number(info.signal_dbm) : undefined,
      ipAddresses,
      gateway: info.gateway ? String(info.gateway) : undefined,
    };
  });
};

export const usePrinterStore = create<PrinterStore>((set: PrinterSetState, get: PrinterGetState) => {
  const initialTheme = (localStorage.getItem('printer-ui-theme') as ThemeKey | null) ?? 'purple';

  const addCommand = (status: CommandStatus) => {
    set((state) => ({
      commandQueue: [status, ...state.commandQueue.filter((entry) => entry.id !== status.id)].slice(0, 20),
    }));
  };

  const httpClient = new MoonrakerHttpClient(defaultConnection().moonrakerBaseUrl);
  const fetchSnapshot = async () => {
    const { connection } = get();
    const scopedHttp = httpClient.withBaseUrl(connection.moonrakerBaseUrl);

    const [objectsRes, filesRes, systemRes, networkRes, objectListRes, updateRes, historyRes, mainsailGeneralRes] = await Promise.allSettled([
      scopedHttp.queryObjects({
        toolhead: ['position'],
        gcode_move: ['speed_factor', 'extrude_factor'],
        extruder: ['temperature', 'target'],
        heater_bed: ['temperature', 'target'],
        heaters: ['available_heaters', 'available_sensors', 'available_monitors'],
        print_stats: ['state', 'filename', 'print_duration', 'total_duration', 'info', 'message'],
        display_status: ['progress'],
        fan: ['speed'],
        webhooks: ['state', 'state_message'],
        idle_timeout: ['state'],
        printer_state: ['state'],
      }),
      scopedHttp.listFiles('gcodes'),
      scopedHttp.systemInfo(),
      scopedHttp.networkInfo(),
      scopedHttp.listObjects(),
      scopedHttp.updateStatus(),
      scopedHttp.historyTotals(),
      scopedHttp.databaseItem('mainsail', 'general'),
    ]);

    const objectNames = objectListRes.status === 'fulfilled'
      ? ((((objectListRes.value.result as any) || {}).objects as string[] | undefined) ?? [])
      : [];

    if (objectsRes.status === 'fulfilled') {
      const status = (((objectsRes.value.result as any) || {}).status || {}) as Record<string, any>;

      dynamicObjects = getDynamicTemperatureObjects(status, objectNames);
      socketClient?.subscribe(dynamicObjects);

      let dynamicStatus: Record<string, any> = {};
      if (dynamicObjects.length > 0) {
        const dynamicResults = await Promise.allSettled(
          dynamicObjects.map(async (name) => {
            const result = await scopedHttp.queryObjects({ [name]: dynamicFieldsForObject(name) });
            return (((result.result as any) || {}).status || {}) as Record<string, any>;
          }),
        );

        dynamicStatus = dynamicResults.reduce<Record<string, any>>((acc, entry) => {
          if (entry.status === 'fulfilled') {
            Object.assign(acc, entry.value);
          }
          return acc;
        }, {});
      }

      dynamicCache = dynamicStatus;
      const currentState = get();
      const nozzle = readHeater(status, 'extruder', currentState.temperatures.nozzle);
      const bed = readHeater(status, 'heater_bed', currentState.temperatures.bed);

      const { sensors, chamber, ambient, controller, raspberryPi } = deriveTemperatures(dynamicStatus, currentState.temperatures);

      const auxFanEntry =
        dynamicStatus['output_pin aux_fan'] ??
        dynamicStatus.aux_fan ??
        Object.entries(dynamicStatus).find(([name]) => /output_pin\s+aux_fan|\baux_fan\b/i.test(name))?.[1];

      const chamberFanEntry = Object.entries(dynamicStatus).find(([name]) => /chamber.*fan|fan.*chamber/i.test(name));

      const printDuration = Number(status.print_stats?.print_duration ?? 0);
      const progress = Number(status.display_status?.progress ?? 0);
      const estimatedTotal = progress > 0 ? printDuration / progress : Number(status.print_stats?.total_duration ?? 0);
      const remainingSeconds = Math.max(0, estimatedTotal - printDuration);
      const currentLayer = status.print_stats?.info?.current_layer;
      const totalLayer = status.print_stats?.info?.total_layer;

      set((state) => ({
        temperatures: {
          ...state.temperatures,
          nozzle,
          bed,
          chamber,
          ambient,
          controller,
          raspberryPi,
          sensors,
        },
        temperatureHistory: (() => {
          const history = { ...state.temperatureHistory };
          pushHistory(history, 'nozzle', nozzle.current);
          pushHistory(history, 'bed', bed.current);
          pushHistory(history, 'chamber', chamber.current);
          pushHistory(history, 'ambient', ambient);
          pushHistory(history, 'controller', controller);
          pushHistory(history, 'raspberryPi', raspberryPi);

          Object.entries(sensors).forEach(([name, values]) => {
            pushHistory(history, name, values.current);
          });

          return history;
        })(),
        position: {
          x: Number(status.toolhead?.position?.[0] ?? 0),
          y: Number(status.toolhead?.position?.[1] ?? 0),
          z: Number(status.toolhead?.position?.[2] ?? 0),
        },
        fanPartPercent: toPercent(status.fan?.speed, state.fanPartPercent),
        fanChamberPercent: toPercent(
          (auxFanEntry as any)?.value ?? (auxFanEntry as any)?.speed ?? (chamberFanEntry?.[1] as any)?.speed,
          state.fanChamberPercent,
        ),
        speedPercent: Math.round(Number(status.gcode_move?.speed_factor ?? state.speedPercent / 100) * 100),
        flowPercent: Math.round(Number(status.gcode_move?.extrude_factor ?? state.flowPercent / 100) * 100),
        job: {
          ...state.job,
          filename: String(status.print_stats?.filename || ''),
          progress,
          state: resolvePrinterState(status, state.job.state),
          elapsed: hhmmFromSeconds(printDuration),
          eta: hhmmFromSeconds(remainingSeconds),
          remaining: hhmmFromSeconds(remainingSeconds),
          layer:
            typeof currentLayer === 'number' && typeof totalLayer === 'number'
              ? `${currentLayer}/${totalLayer}`
              : '-',
        },
        logs: [
          status.webhooks?.state_message ? String(status.webhooks.state_message) : `State: ${String(status.webhooks?.state ?? status.print_stats?.state ?? 'unknown')}`,
          ...state.logs,
        ].slice(0, 40),
      }));
    }

    if (filesRes.status === 'fulfilled') {
      const result = (filesRes.value.result as any) || [];
      const files = Array.isArray(result)
        ? result
            .map((entry: any) => ({
              path: String(entry.path ?? ''),
              modified: Number(entry.modified ?? 0),
              size: Number(entry.size ?? 0),
            }))
            .filter((entry: FileEntry) => Boolean(entry.path))
        : [];

      set((state) => ({
        files,
        selectedFile: files.find((f) => f.path === state.selectedFile?.path) ?? state.selectedFile,
      }));
    }

    if (systemRes.status === 'fulfilled') {
      set({
        versions: {
          moonraker: String((systemRes.value.result as any)?.moonraker_version?.version ?? ''),
          klipper: String((systemRes.value.result as any)?.klipper_version ?? ''),
        },
      });
    }

    if (historyRes.status === 'fulfilled') {
      const root = ((historyRes.value.result as any) || {}) as Record<string, any>;
      const totals = (root.job_totals ?? root.totals ?? root) as Record<string, any>;
      const totalSeconds = Number(totals.total_time ?? totals.print_time ?? 0);
      const totalJobs = Number(totals.total_jobs ?? totals.count ?? 0);
      const totalFilamentMm = Number(totals.total_filament_used ?? totals.filament_used ?? 0);

      set({
        stats: {
          totalTimeHours: totalSeconds / 3600,
          printCount: Number.isFinite(totalJobs) ? totalJobs : 0,
          filamentKg: Number.isFinite(totalFilamentMm) ? totalFilamentMm / 1000 / 1000 : 0,
        },
      });
    }

    const mainsailValue = mainsailGeneralRes.status === 'fulfilled' ? ((mainsailGeneralRes.value.result as any) || {}).value : undefined;
    const mainsailGeneral = typeof mainsailValue === 'object' && mainsailValue !== null ? mainsailValue : {};
    const systemRoot = systemRes.status === 'fulfilled' ? ((systemRes.value.result as any) || {}) : {};
    const systemInfo = (systemRoot.system_info ?? systemRoot.system ?? {}) as Record<string, any>;
    const hostNameRaw =
      systemInfo.hostname ??
      systemInfo.host_name ??
      systemRoot.hostname ??
      get().connection.hostname ??
      '';

    const configuredPrinterName =
      String(
        (mainsailGeneral as any).printer_name ??
          (mainsailGeneral as any).printerName ??
          (mainsailGeneral as any).machine_name ??
          (mainsailGeneral as any).instance_name ??
          (mainsailGeneral as any).name ??
          (mainsailGeneral as any).title ??
          '',
      ) || '';

    const candidateHostNames = [
      String(hostNameRaw ?? ''),
      String(get().connection.hostname ?? ''),
    ].map((entry) => entry.trim()).filter(Boolean);

    const preferredHostName = candidateHostNames.find((entry) => !isIpOrLocalHost(entry)) ?? '';
    const existingName = get().profileName;
    const nextRawName = configuredPrinterName || preferredHostName || (isIpOrLocalHost(existingName) ? 'Printer' : existingName);
    set({ profileName: normalizeProfileName(nextRawName) });

    if (networkRes.status === 'fulfilled') {
      const interfaces = parseNetworkInterfaces(networkRes.value);
      const isOnline = interfaces.some((entry) => entry.isUp && entry.ipAddresses.length > 0);
      set((state) => ({
        connection: {
          ...state.connection,
          networkInterfaces: interfaces,
          networkState: isOnline ? 'online' : 'offline',
        },
      }));
    }

    if (updateRes.status === 'fulfilled') {
      const versionInfo = ((updateRes.value.result as any) || {}).version_info || {};
      const entries = Object.values(versionInfo) as Array<{ channel?: string; is_valid?: boolean; commits_behind?: number }>;
      const pending = entries.filter((entry) => {
        if (typeof entry.commits_behind === 'number') {
          return entry.commits_behind > 0;
        }
        return entry.is_valid === false || entry.channel === 'dev';
      }).length;

      set({ updateCount: pending });
    }
  };

  return {
    profileName: 'Printer',
    connectionState: 'connecting',
    connection: defaultConnection(),
    temperatures: defaultTemperatures,
    temperatureHistory: {},
    job: defaultJob,
    position: defaultPosition,
    stats: defaultStats,
    files: [],
    selectedFile: undefined,
    macros: [],
    logs: [],
    versions: {},
    updateCount: 0,
    commandQueue: [],
    theme: initialTheme,
    fanPartPercent: 0,
    fanChamberPercent: 0,
    speedPercent: 100,
    flowPercent: 100,
    boot: () => {
      const existing = socketClient;
      if (existing) {
        existing.close();
      }

      if (pollTimer) {
        window.clearInterval(pollTimer);
        pollTimer = undefined;
      }

      set({ connectionState: 'connecting' });
      fetchSnapshot()
        .then(() => set({ connectionState: 'online' }))
        .catch(() => set({ connectionState: 'offline' }));

      const { connection } = get();

      socketClient = new MoonrakerSocket(
        connection.websocketUrl,
        ['toolhead', 'extruder', 'heater_bed', 'print_stats', 'display_status', 'fan', 'idle_timeout', 'gcode_move', 'heaters', 'webhooks'],
        () => set({ connectionState: 'online' }),
        () => set({ connectionState: 'offline' }),
        (payload) => {
          const status = parseStatusPayload(payload);
          if (!status) return;

          set((state) => {
            const next = { ...state };

            if (status.extruder) {
              next.temperatures = {
                ...next.temperatures,
                nozzle: {
                  current: Number(status.extruder.temperature ?? next.temperatures.nozzle.current),
                  target: Number(status.extruder.target ?? next.temperatures.nozzle.target),
                },
              };
            }

            if (status.heater_bed) {
              next.temperatures = {
                ...next.temperatures,
                bed: {
                  current: Number(status.heater_bed.temperature ?? next.temperatures.bed.current),
                  target: Number(status.heater_bed.target ?? next.temperatures.bed.target),
                },
              };
            }

            const dynamicUpdates = Object.entries(status).filter(([name]) => dynamicObjects.includes(name));
            if (dynamicUpdates.length > 0) {
              dynamicUpdates.forEach(([name, values]) => {
                dynamicCache[name] = { ...dynamicCache[name], ...values };
              });
              const derived = deriveTemperatures(dynamicCache, next.temperatures);
              next.temperatures = { ...next.temperatures, ...derived };
              const auxLive = dynamicCache['output_pin aux_fan'];
              if (auxLive) next.fanChamberPercent = toPercent(auxLive.value, next.fanChamberPercent);
            }

            if (status.toolhead?.position) {
              next.position = {
                x: Number(status.toolhead.position[0] ?? next.position.x),
                y: Number(status.toolhead.position[1] ?? next.position.y),
                z: Number(status.toolhead.position[2] ?? next.position.z),
              };
            }

            const nextPrinterState = resolvePrinterState(status, next.job.state);
            const isActivePrintState = nextPrinterState === 'printing' || nextPrinterState === 'paused';
            next.pendingPrintLaunch = isActivePrintState ? next.pendingPrintLaunch : false;

            if (nextPrinterState !== 'printing' && nextPrinterState !== 'paused' && nextPrinterState !== 'shutdown' && nextPrinterState !== 'startup') {
              next.job = {
                ...next.job,
                state: nextPrinterState,
                progress: 0,
                elapsed: '00:00',
                eta: '00:00',
                remaining: '00:00',
              };
            }

            return next;
          });
        },
      );

      socketClient.connect();
      pollTimer = window.setInterval(() => {
        void fetchSnapshot();
      }, 2500);
      document.body.dataset.theme = get().theme;

      const scopedHttp = httpClient.withBaseUrl(connection.moonrakerBaseUrl);
      void scopedHttp.listObjects().then((result) => {
        const objectList = ((((result.result as any) || {}).objects as string[] | undefined) ?? [])
          .filter((name) => name.startsWith('gcode_macro '))
          .map((name) => name.slice('gcode_macro '.length));

        set({ macros: objectList });
      }).catch(() => {
        set({ macros: [] });
      });
    },
    disconnect: () => {
      socketClient?.close();
      if (pollTimer) {
        window.clearInterval(pollTimer);
        pollTimer = undefined;
      }
    },
    setTheme: (theme: ThemeKey) => {
      localStorage.setItem('printer-ui-theme', theme);
      document.body.dataset.theme = theme;
      set({ theme });
    },
    setConnectionUrls: (baseUrl: string, wsUrl: string) => {
      localStorage.setItem('moonraker-base-url', baseUrl);
      localStorage.setItem('moonraker-websocket-url', wsUrl);
      set((state) => ({
        connection: {
          ...state.connection,
          moonrakerBaseUrl: baseUrl,
          websocketUrl: wsUrl,
        },
      }));
    },
    runAction: async (label: string, action: () => Promise<unknown>) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      addCommand({ id, label, status: 'pending', timestamp: Date.now() });

      try {
        await action();
        addCommand({ id, label, status: 'success', timestamp: Date.now() });
        void fetchSnapshot();
      } catch (error) {
        addCommand({
          id,
          label,
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown failure',
          timestamp: Date.now(),
        });
      }
    },
    setSelectedFile: (path: string) => {
      set((state) => ({
        selectedFile: state.files.find((entry) => entry.path === path) ?? state.selectedFile,
      }));
    },
    pendingPrintLaunch: false,
    setPendingPrintLaunch: (value: boolean) => {
      set({ pendingPrintLaunch: value });
    },
  };
});

export function useCommands() {
  const { connection } = usePrinterStore.getState();
  const http = new MoonrakerHttpClient(connection.moonrakerBaseUrl);
  const sendSocketRpc = (method: string, params?: Record<string, unknown>) => {
    socketClient?.send({ jsonrpc: '2.0', method, params: params ?? {}, id: Date.now() });
  };
  return new CommandService(http, sendSocketRpc);
}
