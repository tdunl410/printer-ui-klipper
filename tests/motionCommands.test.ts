import { describe, expect, it, vi } from 'vitest';
import { CommandService } from '../src/services/commands';
import { MoonrakerHttpClient } from '../src/transport/moonrakerHttp';

describe('live motion tuning commands', () => {
  it('sends each setting to the correct Klipper gcode parameter', async () => {
    const http = new MoonrakerHttpClient('http://printer');
    const post = vi.spyOn(http, 'post').mockResolvedValue({});
    const commands = new CommandService(http, () => {});

    await commands.setPressureAdvance('extruder1', 0.055);
    await commands.setPressureAdvanceSmoothTime('extruder1', 0.04);
    await commands.setSquareCornerVelocity(5.5);

    expect(post.mock.calls).toEqual([
      ['/printer/gcode/script', { script: 'SET_PRESSURE_ADVANCE EXTRUDER=extruder1 ADVANCE=0.055' }],
      ['/printer/gcode/script', { script: 'SET_PRESSURE_ADVANCE EXTRUDER=extruder1 SMOOTH_TIME=0.04' }],
      ['/printer/gcode/script', { script: 'SET_VELOCITY_LIMIT SQUARE_CORNER_VELOCITY=5.5' }],
    ]);
  });

  it('rejects invalid values and unsafe extruder names', async () => {
    const http = new MoonrakerHttpClient('http://printer');
    const post = vi.spyOn(http, 'post').mockResolvedValue({});
    const commands = new CommandService(http, () => {});

    await expect(commands.setPressureAdvance('extruder\nG28', 0.1)).rejects.toThrow();
    await expect(commands.setPressureAdvance('extruder', -1)).rejects.toThrow();
    await expect(commands.setPressureAdvanceSmoothTime('extruder', 0.201)).rejects.toThrow();
    await expect(commands.setPressureAdvanceSmoothTime('extruder', NaN)).rejects.toThrow();
    await expect(commands.setSquareCornerVelocity(-1)).rejects.toThrow();
    await expect(commands.setSquareCornerVelocity(Infinity)).rejects.toThrow();
    expect(post).not.toHaveBeenCalled();
  });
});
