export type ConnectionState = 'connecting' | 'online' | 'offline';
export type PrintState = 'idle' | 'printing' | 'paused' | 'complete' | 'error';

export interface HeaterState {
  current: number;
  target: number;
}

export interface PrinterTemperatures {
  nozzle: HeaterState;
  bed: HeaterState;
  chamber: HeaterState;
  ambient: number;
  controller: number;
  raspberryPi: number;
  sensors: Record<string, HeaterState>;
}

export interface JobState {
  filename: string;
  progress: number;
  state: PrintState;
  layer: string;
  eta: string;
  remaining: string;
  elapsed: string;
}

export interface PositionState {
  x: number;
  y: number;
  z: number;
}

export interface MachineStats {
  totalTimeHours: number;
  printCount: number;
  filamentKg: number;
}

export interface NetworkInterfaceInfo {
  name: string;
  type: 'wifi' | 'ethernet' | 'other';
  isUp: boolean;
  ssid?: string;
  signalDbm?: number;
  ipAddresses: string[];
  gateway?: string;
}

export interface SystemVersions {
  moonraker?: string;
  klipper?: string;
  mainsail?: string;
  fluidd?: string;
}

export interface FileEntry {
  path: string;
  modified?: number;
  size?: number;
}

export interface CommandStatus {
  id: string;
  label: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
  timestamp: number;
}

export interface ConnectionDetails {
  moonrakerBaseUrl: string;
  websocketUrl: string;
  networkState: 'online' | 'offline';
  hostname: string;
  networkInterfaces: NetworkInterfaceInfo[];
}
