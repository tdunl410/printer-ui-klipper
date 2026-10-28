import { create } from 'zustand';
import { defaultConnection, defaultJob, defaultPosition, defaultStats, defaultTemperatures } from '../domain/defaults';
import type { CommandStatus, ConnectionDetails, ConnectionState, FileEntry, JobState, MachineStats, PositionState, PrinterTemperatures } from '../domain/models';
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
  job: JobState;
  position: PositionState;
  stats: MachineStats;
  files: FileEntry[];
  selectedFile?: FileEntry;
  macros: string[];
  logs: string[];
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

function parseStatusPayload(payload: unknown) {
  if (typeof payload !== 'object' || payload === null) return undefined;
  const root = payload as { method?: string; params?: unknown[] };
  if (root.method !== 'notify_status_update') return undefined;
  const first = root.params?.[0];
  if (typeof first !== 'object' || first === null) return undefined;
  return first as Record<string, any>;
}

export const usePrinterStore = create<PrinterStore>((set, get) => {
  const initialTheme = (localStorage.getItem('printer-ui-theme') as ThemeKey | null) ?? 'purple';

  const addCommand = (status: CommandStatus) => {
    set((state) => ({ commandQueue: [status, ...state.commandQueue].slice(0, 8) }));
  };

  const runSocketRpc = (method: string, params: Record<string, unknown> = {}) => {
    socketClient?.send({ jsonrpc: '2.0', method, params, id: Date.now() });
  };

  const httpClient = new MoonrakerHttpClient(defaultConnection().moonrakerBaseUrl);
  const fetchSnapshot = async () => {
    const { connection } = get();
    const scopedHttp = httpClient.withBaseUrl(connection.moonrakerBaseUrl);

    const [objectsRes, filesRes, systemRes] = await Promise.allSettled([
      scopedHttp.queryObjects({
        toolhead: ['position'],
        extruder: ['temperature', 'target'],
        heater_bed: ['temperature', 'target'],
        print_stats: ['state', 'filename', 'print_duration', 'total_duration', 'info', 'message'],
        display_status: ['progress'],
        fan: ['speed'],
      }),
      scopedHttp.listFiles('gcodes'),
      scopedHttp.systemInfo(),
    ]);

    if (objectsRes.status === 'fulfilled') {
      const status = (((objectsRes.value.result as any) || {}).status || {}) as Record<string, any>;
      set((state) => ({
        temperatures: {
          ...state.temperatures,
          nozzle: {
            current: Number(status.extruder?.temperature ?? state.temperatures.nozzle.current),
            target: Number(status.extruder?.target ?? state.temperatures.nozzle.target),
          },
          bed: {
            current: Number(status.heater_bed?.temperature ?? state.temperatures.bed.current),
            target: Number(status.heater_bed?.target ?? state.temperatures.bed.target),
          },
        },
        position: {
          x: Number(status.toolhead?.position?.[0] ?? state.position.x),
          y: Number(status.toolhead?.position?.[1] ?? state.position.y),
          z: Number(status.toolhead?.position?.[2] ?? state.position.z),
        },
        fanPartPercent: Math.round(Number(status.fan?.speed ?? state.fanPartPercent / 100) * 100),
        job: {
          ...state.job,
          filename: String(status.print_stats?.filename || state.job.filename),
          progress: Number(status.display_status?.progress ?? state.job.progress),
          state: (String(status.print_stats?.state || state.job.state).toLowerCase() as JobState['state']) || 'idle',
          elapsed: hhmmFromSeconds(Number(status.print_stats?.print_duration ?? 0)),
          eta: hhmmFromSeconds(Math.max(0, Number(status.print_stats?.total_duration ?? 0) - Number(status.print_stats?.print_duration ?? 0))),
        },
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
        selectedFile: files.find((f) => f.path === state.selectedFile?.path) ?? files[0] ?? state.selectedFile,
      }));
    }

    if (systemRes.status === 'fulfilled') {
      const moonrakerVersion = String((systemRes.value.result as any)?.moonraker_version?.version ?? 'unknown');
      set((state) => ({
        logs: [`Moonraker ${moonrakerVersion}`, ...state.logs].slice(0, 25),
      }));
    }
  };

  return {
    profileName: 'Voron 2.4',
    connectionState: 'connecting',
    connection: defaultConnection(),
    temperatures: defaultTemperatures,
    job: defaultJob,
    position: defaultPosition,
    stats: defaultStats,
    files: [],
    selectedFile: undefined,
    macros: ['QUAD_GANTRY_LEVEL', 'BED_MESH_CALIBRATE', 'LOAD_FILAMENT', 'UNLOAD_FILAMENT', 'PURGE_NOZZLE'],
    logs: [
      'Recv: ok T:236.2 /240.0 B:99.8 /100.0',
      'Send: BED_MESH_PROFILE LOAD=default',
      'Recv: // mesh loaded from profile [default]',
      'Send: SET_FAN_SPEED FAN=part PERCENT=0.35',
    ],
    commandQueue: [],
    theme: initialTheme,
    fanPartPercent: 35,
    fanChamberPercent: 65,
    speedPercent: 100,
    flowPercent: 98,
    boot: () => {
      const existing = socketClient;
      if (existing) {
        existing.close();
      }

      set({ connectionState: 'connecting' });
      fetchSnapshot()
        .then(() => set({ connectionState: 'online' }))
        .catch(() => set({ connectionState: 'offline' }));

      const { connection } = get();

      socketClient = new MoonrakerSocket(
        connection.websocketUrl,
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
              next.job = {
                ...next.job,
                filename: String(current.filename ?? next.job.filename),
                state: String(current.state ?? next.job.state).toLowerCase() as JobState['state'],
                elapsed: hhmmFromSeconds(Number(current.print_duration ?? 0)),
                eta: hhmmFromSeconds(
                  Math.max(0, Number(current.total_duration ?? 0) - Number(current.print_duration ?? 0)),
                ),
              };
            }

            if (status.fan?.speed !== undefined) {
              next.fanPartPercent = Math.round(Number(status.fan.speed) * 100);
            }

            return next;
          });
        },
      );

      socketClient.connect();
      document.body.dataset.theme = get().theme;
    },
    disconnect: () => socketClient?.close(),
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
