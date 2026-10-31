import { MoonrakerHttpClient } from '../transport/moonrakerHttp';

export class CommandService {
  constructor(
    private readonly http: MoonrakerHttpClient,
    private readonly sendSocketRpc: (method: string, params?: Record<string, unknown>) => void,
  ) {}

  async pausePrint() {
    return this.socketFirst('printer.print.pause');
  }

  async resumePrint() {
    return this.socketFirst('printer.print.resume');
  }

  async cancelPrint() {
    return this.socketFirst('printer.print.cancel');
  }

  // Same endpoint Mainsail uses: bypasses the gcode queue so it works mid-macro or mid-print.
  // Also sent over the already-open websocket so it can't queue behind pending HTTP requests.
  async emergencyStop() {
    this.sendSocketRpc('printer.emergency_stop', {});
    return this.http.post('/printer/emergency_stop');
  }

  async runMacro(name: string) {
    return this.gcode(name);
  }

  async startPrint(filename: string) {
    return this.http.post('/printer/print/start', { filename });
  }

  async deleteFile(path: string) {
    const encodedPath = path
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    return this.http.delete(`/server/files/gcodes/${encodedPath}`);
  }

  async renameFile(source: string, dest: string) {
    return this.http.post('/server/files/move', {
      source: `gcodes/${source}`,
      dest: `gcodes/${dest}`,
    });
  }

  async uploadGcode(file: File, path = '') {
    return this.http.uploadGcode(file, path);
  }

  async setHeater(heater: 'extruder' | 'heater_bed' | 'chamber', target: number) {
    const boundedTarget = Math.max(0, target);
    if (heater === 'chamber') {
      return this.gcode(`SET_TEMPERATURE_FAN_TARGET TEMPERATURE_FAN=chamber TARGET=${boundedTarget}`);
    }
    return this.gcode(`SET_HEATER_TEMPERATURE HEATER=${heater} TARGET=${boundedTarget}`);
  }

  async home(axis: 'xyz' | 'xy' | 'z') {
    if (axis === 'xyz') {
      return this.gcode('G28');
    }
    if (axis === 'xy') {
      return this.gcode('G28 X Y');
    }
    return this.gcode('G28 Z');
  }

  async jog(axis: 'X' | 'Y' | 'Z', distance: number) {
    return this.gcode(`G91\nG1 ${axis}${distance.toFixed(2)} F6000\nG90`);
  }

  async setFan(percent: number, fan = 'fan') {
    if (fan === 'fan') {
      const boundedPercent = Math.max(0, Math.min(percent, 100));
      const speedValue = Math.round((boundedPercent / 100) * 255);
      return this.gcode(`M106 S${speedValue}`);
    }

    if (fan === 'aux_fan' || fan === 'chamber_fan') {
      const boundedAux = Math.max(0, Math.min(percent, 100));
      return this.gcode(`SET_PIN PIN=aux_fan VALUE=${boundedAux.toFixed(2)}`);
    }

    const bounded = Math.max(0, Math.min(percent, 100));
    return this.gcode(`SET_FAN_SPEED FAN=${fan} SPEED=${(bounded / 100).toFixed(2)}`);
  }

  async extrude(mm: number, speed = 180) {
    return this.gcode(`M83\nG1 E${mm.toFixed(2)} F${speed * 60}`);
  }

  async setPrintSpeed(percent: number) {
    const bounded = Math.max(10, Math.min(percent, 300));
    return this.gcode(`M220 S${Math.round(bounded)}`);
  }

  async setFlow(percent: number) {
    const bounded = Math.max(10, Math.min(percent, 200));
    return this.gcode(`M221 S${Math.round(bounded)}`);
  }

  async adjustZOffset(delta: number) {
    return this.gcode(`SET_GCODE_OFFSET Z_ADJUST=${delta.toFixed(3)} MOVE=1`);
  }

  async resetZOffset() {
    return this.gcode('SET_GCODE_OFFSET Z=0 MOVE=1');
  }

  async disableMotors() {
    return this.gcode('M84');
  }

  async firmwareRestart() {
    return this.http.post('/printer/firmware_restart');
  }

  async systemAction(action: 'restart-klipper' | 'restart-host' | 'shutdown') {
    if (action === 'restart-klipper') {
      return this.http.post('/machine/services/restart', { service: 'klipper' });
    }
    if (action === 'restart-host') {
      return this.http.post('/machine/reboot');
    }
    return this.http.post('/machine/shutdown');
  }

  async updateScreen() {
    const response = await fetch('/api/ui/update-screen', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const text = await response.text();
      let message = text;

      if (!message) {
        message = `Update request failed (${response.status})`;
      }

      if (response.status === 403) {
        message = 'UI updates are only allowed from the local printer screen.';
      } else if (response.status === 404) {
        message = 'Update endpoint unavailable. Use the printer-ui static server for this action.';
      }

      throw new Error(message);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return (await response.json()) as Record<string, unknown>;
    }

    return { ok: true };
  }

  private async socketFirst(method: string, params: Record<string, unknown> = {}) {
    this.sendSocketRpc(method, params);
    return Promise.resolve({ method, params });
  }

  private async gcode(script: string) {
    return this.http.post('/printer/gcode/script', { script });
  }
}
