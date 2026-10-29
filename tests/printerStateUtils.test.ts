import { describe, expect, it } from 'vitest';
import { defaultTemperatures } from '../src/domain/defaults';
import {
  computeJobState,
  deriveTemperatures,
  normalizeKlipperState,
  toPercent,
} from '../src/stores/printerStateUtils';

describe('printerStateUtils', () => {
  it('maps percent values from ratio and clamps percentages', () => {
    expect(toPercent(0.5, 12)).toBe(50);
    expect(toPercent(140, 12)).toBe(100);
    expect(toPercent(-10, 12)).toBe(0);
    expect(toPercent('bad', 12)).toBe(12);
  });

  it('normalizes klipper state with fallback for unknown values', () => {
    expect(normalizeKlipperState(' STARTUP ', 'ready')).toBe('startup');
    expect(normalizeKlipperState('totally-unknown', 'shutdown')).toBe('shutdown');
  });

  it('lets klipper startup/shutdown/error override print_stats state', () => {
    expect(computeJobState('startup', 'printing')).toBe('startup');
    expect(computeJobState('shutdown', 'printing')).toBe('shutdown');
    expect(computeJobState('disconnected', 'paused')).toBe('shutdown');
    expect(computeJobState('error', 'printing')).toBe('error');
  });

  it('uses print_stats state when klipper is ready', () => {
    expect(computeJobState('ready', 'printing')).toBe('printing');
    expect(computeJobState('ready', 'paused')).toBe('paused');
    expect(computeJobState('ready', 'complete')).toBe('complete');
    expect(computeJobState('ready', 'unknown')).toBe('idle');
  });

  it('derives chamber and named sensor temperatures from dynamic status', () => {
    const previous = {
      ...defaultTemperatures,
      chamber: { current: 20, target: 0 },
      sensors: { ambient_probe: { current: 22, target: 0 } },
    };

    const dynamicStatus = {
      'temperature_sensor chamber': { temperature: 44.2 },
      'temperature_fan chamber': { target: 52 },
      'temperature_sensor ambient_probe': { temperature: 26.5 },
      'temperature_sensor mcu_temp': { temperature: 38.1 },
      'temperature_sensor raspberry_pi': { temperature: 49.8 },
    };

    const derived = deriveTemperatures(dynamicStatus, previous);

    expect(derived.chamber.current).toBeCloseTo(44.2, 1);
    expect(derived.chamber.target).toBe(52);
    expect(derived.sensors.ambient_probe.current).toBeCloseTo(26.5, 1);
    expect(derived.ambient).toBeCloseTo(26.5, 1);
    expect(derived.controller).toBeCloseTo(38.1, 1);
    expect(derived.raspberryPi).toBeCloseTo(49.8, 1);
  });

  it('keeps previous sensor value when dynamic update lacks temperature', () => {
    const previous = {
      ...defaultTemperatures,
      ambient: 23,
      sensors: {
        ambient_probe: { current: 23, target: 0 },
      },
    };

    const dynamicStatus = {
      'temperature_sensor ambient_probe': { target: 40 },
    };

    const derived = deriveTemperatures(dynamicStatus, previous);

    expect(derived.sensors.ambient_probe.current).toBe(23);
    expect(derived.sensors.ambient_probe.target).toBe(40);
    expect(derived.ambient).toBe(23);
  });
});
