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
}

let socketClient: MoonrakerSocket | undefined;
let pollTimer: number | undefined;
let dynamicObjects: string[] = [];

function parseStatusPayload(payload: unknown) {
  if (typeof payload !== 'object' || payload === null) return undefined;
  const root = payload as { method?: string; params?: unknown[] };
  if (root.method !== 'notify_status_update') return undefined;
  const first = root.params?.[0];
  if (typeof first !== 'object' || first === null) return undefined;
  return first as Record<string, any>;
}

const pushHistory = (history: Record<string, number[]>, key: string, value: number, max = 64) => {
  const current = history[key] ?? [];
  const next = [...current, value];
  if (next.length > max) {
    next.shift();
  }
  history[key] = next;
};

const toState = (value: string): JobState['state'] => {
  if (value === 'printing' || value === 'paused' || value === 'complete' || value === 'error') {
    return value;
  }
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

const getDynamicTemperatureObjects = (status: Record<string, any>, objects: string[]) => {
  const fromHeaters = [
    ...((status.heaters?.available_heaters as string[] | undefined) ?? []),
    ...((status.heaters?.available_sensors as string[] | undefined) ?? []),
    ...((status.heaters?.available_monitors as string[] | undefined) ?? []),
  ];

  const fromObjectList = objects.filter((name) => {
    return (
      name.startsWith('temperature_sensor ') ||
      name.startsWith('temperature_fan ') ||
      name.startsWith('heater_generic ') ||
      name.startsWith('fan_generic ') ||
      name.startsWith('controller_fan ') ||
      name.startsWith('heater_fan ')
    );
  });

  return Array.from(new Set([...fromHeaters, ...fromObjectList])).filter(Boolean);
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

export const usePrinterStore = create<PrinterStore>((set, get) => {
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

      let dynamicStatus: Record<string, any> = {};
      if (dynamicObjects.length > 0) {
        const dynamicQuery = Object.fromEntries(dynamicObjects.map((name) => [name, ['temperature', 'target', 'speed']]));
        try {
          const dynamicRes = await scopedHttp.queryObjects(dynamicQuery);
          dynamicStatus = (((dynamicRes.result as any) || {}).status || {}) as Record<string, any>;
        } catch {
          dynamicStatus = {};
        }
      }

      const currentState = get();
      const nozzle = readHeater(status, 'extruder', currentState.temperatures.nozzle);
      const bed = readHeater(status, 'heater_bed', currentState.temperatures.bed);

      const sensors = Object.entries(dynamicStatus).reduce<Record<string, { current: number; target: number }>>((acc, [key, value]) => {
        const sensorName = key.includes(' ') ? key.split(' ').slice(1).join(' ') : key;
        acc[sensorName] = {
          current: Number((value as any)?.temperature ?? 0),
          target: Number((value as any)?.target ?? 0),
        };
        return acc;
      }, {});

      const chamberCandidate = Object.entries(sensors).find(([name]) => /chamber/i.test(name));
      const chamber = chamberCandidate?.[1] ?? sensors.chamber ?? currentState.temperatures.chamber;

      const chamberFanEntry = Object.entries(dynamicStatus).find(([name]) => /chamber.*fan|fan.*chamber/i.test(name));

      const sensorEntries = Object.entries(sensors);
      const ambientCandidates = sensorEntries.filter(([name]) => /ambient|air|enclosure/i.test(name));
      const controllerCandidates = sensorEntries.filter(([name]) => /mcu|board|controller|electronics/i.test(name));
      const piCandidates = sensorEntries.filter(([name]) => /pi|raspberry|soc|cpu/i.test(name));

      const ambient = ambientCandidates[0]?.[1].current ?? currentState.temperatures.ambient;
      const controller = controllerCandidates[0]?.[1].current ?? currentState.temperatures.controller;
      const raspberryPi = piCandidates[0]?.[1].current ?? currentState.temperatures.raspberryPi;

      const printDuration = Number(status.print_stats?.print_duration ?? 0);
      const progress = Number(status.display_status?.progress ?? 0);
      const estimatedTotal = progress > 0 ? printDuration / progress : Number(status.print_stats?.total_duration ?? 0);
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
        fanPartPercent: Math.round(Number(status.fan?.speed ?? state.fanPartPercent / 100) * 100),
        fanChamberPercent: Math.round(Number((chamberFanEntry?.[1] as any)?.speed ?? state.fanChamberPercent / 100) * 100),
        speedPercent: Math.round(Number(status.gcode_move?.speed_factor ?? state.speedPercent / 100) * 100),
        flowPercent: Math.round(Number(status.gcode_move?.extrude_factor ?? state.flowPercent / 100) * 100),
        job: {
          ...state.job,
          filename: String(status.print_stats?.filename || ''),
          progress,
          state: toState(String(status.print_stats?.state || 'idle').toLowerCase()),
          elapsed: hhmmFromSeconds(printDuration),
          eta: hhmmFromSeconds(Math.max(0, estimatedTotal - printDuration)),
          layer:
            typeof currentLayer === 'number' && typeof totalLayer === 'number'
              ? `${currentLayer}/${totalLayer}`
              : '-',
        },
        logs: [
          status.webhooks?.state_message ? String(status.webhooks.state_message) : `State: ${String(status.webhooks?.state ?? 'unknown')}`,
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

    if (mainsailGeneralRes.status === 'fulfilled') {
      const value = ((mainsailGeneralRes.value.result as any) || {}).value;
      const general = typeof value === 'object' && value !== null ? value : {};
      const printerName =
        String(
          (general as any).printer_name ??
            (general as any).printerName ??
            (general as any).machine_name ??
            (general as any).instance_name ??
            '',
        ) || '';

      if (printerName) {
        set({ profileName: printerName });
      }
    }

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
    profileName: 'Voron 2.4',
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

            if (status.toolhead?.position) {
              next.position = {
                x: Number(status.toolhead.position[0] ?? next.position.x),
                y: Number(status.toolhead.position[1] ?? next.position.y),
                z: Number(status.toolhead.position[2] ?? next.position.z),
              };
            }

            if (status.display_status?.progress !== undefined) {
              next.job = {
                ...next.job,
                progress: Number(status.display_status.progress),
              };
            }

            if (status.print_stats) {
              const current = status.print_stats;
              const printDuration = Number(current.print_duration ?? 0);
              const progress = Number(status.display_status?.progress ?? next.job.progress);
              const totalDuration = progress > 0 ? printDuration / progress : Number(current.total_duration ?? 0);
              next.job = {
                ...next.job,
                filename: String(current.filename ?? next.job.filename),
                state: toState(String(current.state ?? next.job.state).toLowerCase()),
                elapsed: hhmmFromSeconds(printDuration),
                eta: hhmmFromSeconds(Math.max(0, totalDuration - printDuration)),
                layer:
                  typeof current.info?.current_layer === 'number' && typeof current.info?.total_layer === 'number'
                    ? `${current.info.current_layer}/${current.info.total_layer}`
                    : next.job.layer,
              };
            }

            if (status.fan?.speed !== undefined) {
              next.fanPartPercent = Math.round(Number(status.fan.speed) * 100);
            }

            if (status.gcode_move?.speed_factor !== undefined) {
              next.speedPercent = Math.round(Number(status.gcode_move.speed_factor) * 100);
            }

            if (status.gcode_move?.extrude_factor !== undefined) {
              next.flowPercent = Math.round(Number(status.gcode_move.extrude_factor) * 100);
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
    setTheme: (theme) => {
      localStorage.setItem('printer-ui-theme', theme);
      document.body.dataset.theme = theme;
      set({ theme });
    },
    setConnectionUrls: (baseUrl, wsUrl) => {
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
    runAction: async (label, action) => {
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
    setSelectedFile: (path) => {
      set((state) => ({
        selectedFile: state.files.find((entry) => entry.path === path) ?? state.selectedFile,
      }));
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
