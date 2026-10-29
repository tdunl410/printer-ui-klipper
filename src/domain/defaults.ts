import type { ConnectionDetails, JobState, MachineStats, PositionState, PrinterTemperatures } from './models';

export const defaultTemperatures: PrinterTemperatures = {
  nozzle: { current: 0, target: 0 },
  bed: { current: 0, target: 0 },
  chamber: { current: 0, target: 0 },
  ambient: 0,
  controller: 0,
  raspberryPi: 0,
  sensors: {},
};

export const defaultJob: JobState = {
  filename: '',
  progress: 0,
  state: 'idle',
  layer: '-',
  eta: '00:00',
  elapsed: '00:00',
};

export const defaultPosition: PositionState = {
  x: 0,
  y: 0,
  z: 0,
};

export const defaultStats: MachineStats = {
  totalTimeHours: 0,
  printCount: 0,
  filamentKg: 0,
};

export const defaultConnection = (): ConnectionDetails => {
  const host = window.location.hostname || 'printer.local';
  const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
  const wsProtocol = protocol === 'https' ? 'wss' : 'ws';
  const moonrakerBaseUrl = localStorage.getItem('moonraker-base-url') || `${protocol}://${host}`;
  const websocketUrl = localStorage.getItem('moonraker-websocket-url') || `${wsProtocol}://${host}/websocket`;

  return {
    moonrakerBaseUrl,
    websocketUrl,
    networkState: 'offline',
    hostname: host,
    networkInterfaces: [],
  };
};
