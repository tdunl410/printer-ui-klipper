import { MoonrakerHttpClient } from '../transport/moonrakerHttp';

type UpdateScreenStatus = {
  status: 'idle' | 'running' | 'success' | 'error';
  startedAt: number;
  finishedAt: number;
  logs: string[];
  lastLog: string;
  error: string;
  currentCommit: string;
  targetCommit: string;
  pid?: number;
  scriptPath: string;
};

function isLegacyStatusUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const normalized = message.toLowerCase();
  return normalized.includes('unable to query update status (404)')
    || normalized.includes('"error":"not found"')
    || normalized.includes('returned html instead of json');
}

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

  async excludeObjects(names: string[]) {
    const uniqueNames = Array.from(
      new Set(
        names
          .map((name) => name.trim())
          .filter(Boolean),
      ),
    );

    for (const name of uniqueNames) {
      await this.gcode(`EXCLUDE_OBJECT NAME=${this.quoteGcodeString(name)}`);
    }

    return { excluded: uniqueNames };
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

  async getUpdateScreenStatus() {
    const response = await fetch('/api/ui/update-screen', {
      method: 'GET',
    });

    const contentType = response.headers.get('content-type') ?? '';
    const bodyText = await response.text();

    if (!response.ok) {
      throw new Error(bodyText || `Unable to query update status (${response.status})`);
    }

    if (!contentType.includes('application/json')) {
      if (bodyText.trim().startsWith('<!doctype') || bodyText.trim().startsWith('<html')) {
        throw new Error('Update status endpoint returned HTML instead of JSON. Open the UI via the printer-ui server (http://127.0.0.1:4409), not the Vite dev server.');
      }
      throw new Error('Update status endpoint returned an unexpected response format.');
    }

    let payload: { update?: UpdateScreenStatus };
    try {
      payload = JSON.parse(bodyText) as { update?: UpdateScreenStatus };
    } catch {
      throw new Error('Update status endpoint returned invalid JSON.');
    }

    return payload.update;
  }

  async updateScreen(onProgress?: (status: UpdateScreenStatus) => void): Promise<UpdateScreenStatus> {
    const response = await fetch('/api/ui/update-screen', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const contentType = response.headers.get('content-type') ?? '';
    const payload = contentType.includes('application/json')
      ? (await response.json()) as { error?: string; update?: UpdateScreenStatus }
      : {};

    if (!response.ok) {
      let message = payload.error;

      if (!message) {
        const text = await response.text();
        message = text || `Update request failed (${response.status})`;
      }

      if (response.status === 403) {
        message = 'UI updates are only allowed from the local printer screen.';
      } else if (response.status === 404) {
        message = 'Update endpoint unavailable. Use the printer-ui static server for this action.';
      }

      throw new Error(message);
    }

    if (payload.update) {
      onProgress?.(payload.update);
    }

    const timeoutAt = Date.now() + 180000;
    while (Date.now() < timeoutAt) {
      await new Promise((resolve) => window.setTimeout(resolve, 800));
      let status: UpdateScreenStatus | undefined;
      try {
        status = await this.getUpdateScreenStatus();
      } catch (error) {
        if (isLegacyStatusUnavailable(error)) {
          onProgress?.({
            status: 'running' as const,
            startedAt: Date.now(),
            finishedAt: 0,
            logs: ['Live update status is unavailable on the currently installed backend. Update has been started and backend files will be refreshed.'],
            lastLog: 'Live status unavailable on current backend; applying update and reloading…',
            error: '',
            currentCommit: '',
            targetCommit: '',
            scriptPath: '',
          });
          await new Promise((resolve) => window.setTimeout(resolve, 2500));
          return {
            status: 'success' as const,
            startedAt: Date.now(),
            finishedAt: Date.now(),
            logs: ['Update started. Live status unavailable on prior backend implementation.'],
            lastLog: 'Update started. Reloading to pick up the new backend…',
            error: '',
            currentCommit: '',
            targetCommit: '',
            scriptPath: '',
          };
        }
        throw error;
      }

      if (!status) continue;
      onProgress?.(status);

      if (status.status === 'error') {
        throw new Error(status.error || status.lastLog || 'Update failed.');
      }

      if (status.status === 'success') {
        return status;
      }
    }

    throw new Error('Update timed out while waiting for completion.');
  }

  async updateAll() {
    return this.http.post('/machine/update/full');
  }

  async updateTarget(name: string) {
    const normalized = name.trim().toLowerCase();
    if (!normalized) {
      throw new Error('No update target selected.');
    }

    if (normalized === 'moonraker') {
      return this.http.post('/machine/update/moonraker');
    }
    if (normalized === 'klipper') {
      return this.http.post('/machine/update/klipper');
    }
    if (normalized === 'firmware') {
      return this.http.post('/machine/update/firmware');
    }
    if (['mainsail', 'fluidd', 'web', 'client'].includes(normalized)) {
      return this.http.post(`/machine/update/client?name=${encodeURIComponent(name.trim())}`);
    }

    return this.http.post(`/machine/update/client?name=${encodeURIComponent(name.trim())}`);
  }

  private async socketFirst(method: string, params: Record<string, unknown> = {}) {
    this.sendSocketRpc(method, params);
    return Promise.resolve({ method, params });
  }

  private async gcode(script: string) {
    return this.http.post('/printer/gcode/script', { script });
  }

  private quoteGcodeString(value: string) {
    return `"${value.replace(/(["\\])/g, '\\$1')}"`;
  }
}
