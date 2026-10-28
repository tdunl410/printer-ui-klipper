import type { ConnectionDetails, JobState, MachineStats, PositionState, PrinterTemperatures } from './models';

export const defaultTemperatures: PrinterTemperatures = {
  nozzle: { current: 24, target: 240 },
  bed: { current: 60, target: 100 },
  chamber: { current: 38, target: 45 },
  ambient: 30,
  controller: 34,
  raspberryPi: 37,
};

export const defaultJob: JobState = {
  filename: 'enclosure_bracket_v12.gcode',
  progress: 0.47,
  state: 'printing',
  layer: '168/356',
  eta: '02:31',
  elapsed: '02:19',
};

export const defaultPosition: PositionState = {
  x: 124.3,
  y: 112.8,
  z: 5.2,
};

export const defaultStats: MachineStats = {
  totalTimeHours: 396,
  printCount: 128,
  filamentKg: 8.7,
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
    networkState: 'online',
    hostname: host,
  };
};
