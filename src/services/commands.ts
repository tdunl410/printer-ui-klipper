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

  async runMacro(name: string) {
    return this.gcode(name);
  }

  async setHeater(heater: 'extruder' | 'heater_bed' | 'chamber', target: number) {
    const gcodeHeater = heater === 'chamber' ? 'chamber' : heater;
    return this.gcode(`SET_HEATER_TEMPERATURE HEATER=${gcodeHeater} TARGET=${Math.max(0, target)}`);
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
    const bounded = Math.max(0, Math.min(percent, 100));
    return this.gcode(`SET_FAN_SPEED FAN=${fan} SPEED=${(bounded / 100).toFixed(2)}`);
  }

  async extrude(mm: number, speed = 180) {
    return this.gcode(`M83\nG1 E${mm.toFixed(2)} F${speed * 60}`);
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

  private async socketFirst(method: string, params: Record<string, unknown> = {}) {
    this.sendSocketRpc(method, params);
    return Promise.resolve({ method, params });
  }

  private async gcode(script: string) {
    return this.http.post('/printer/gcode/script', { script });
  }
}
