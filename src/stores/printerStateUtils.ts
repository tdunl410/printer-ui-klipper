import type { JobState, KlipperState, PrinterTemperatures } from '../domain/models';

export interface MotionTuning {
  activeExtruder?: string;
  extruders: Record<string, { pressureAdvance?: number; smoothTime?: number }>;
  squareCornerVelocity?: number;
}

export const mergeMotionTuning = (
  previous: MotionTuning,
  status: Record<string, unknown>,
): MotionTuning => {
  const toolhead = status.toolhead;
  const toolheadValues = typeof toolhead === 'object' && toolhead !== null
    ? toolhead as Record<string, unknown>
    : {};
  const next = { ...previous, extruders: { ...previous.extruders } };
  if (typeof toolheadValues.extruder === 'string') next.activeExtruder = toolheadValues.extruder;
  if (typeof toolheadValues.square_corner_velocity === 'number' && Number.isFinite(toolheadValues.square_corner_velocity)) {
    next.squareCornerVelocity = toolheadValues.square_corner_velocity;
  }
  for (const [name, raw] of Object.entries(status)) {
    if (!/^extruder\d*$/.test(name) || typeof raw !== 'object' || raw === null) continue;
    const values = raw as Record<string, unknown>;
    const extruder = { ...next.extruders[name] };
    if (typeof values.pressure_advance === 'number' && Number.isFinite(values.pressure_advance)) {
      extruder.pressureAdvance = values.pressure_advance;
    }
    if (typeof values.smooth_time === 'number' && Number.isFinite(values.smooth_time)) {
      extruder.smoothTime = values.smooth_time;
    }
    next.extruders[name] = extruder;
  }
  return next;
};

export const fillMissingMotionTuning = (live: MotionTuning, snapshot: MotionTuning): MotionTuning => {
  const extruders = { ...snapshot.extruders };
  for (const [name, values] of Object.entries(live.extruders)) {
    extruders[name] = { ...extruders[name], ...values };
  }
  return {
    activeExtruder: live.activeExtruder ?? snapshot.activeExtruder,
    squareCornerVelocity: live.squareCornerVelocity ?? snapshot.squareCornerVelocity,
    extruders,
  };
};

const KLIPPER_STATES: KlipperState[] = ['ready', 'startup', 'shutdown', 'error', 'disconnected'];

export const toPercent = (raw: unknown, fallback: number) => {
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return fallback;
  if (numeric >= 0 && numeric <= 1) return Math.round(numeric * 100);
  return Math.round(Math.max(0, Math.min(100, numeric)));
};

export const normalizeKlipperState = (raw: unknown, fallback: KlipperState): KlipperState => {
  const value = String(raw ?? '').trim().toLowerCase();
  return (KLIPPER_STATES as string[]).includes(value) ? (value as KlipperState) : fallback;
};

export const computeJobState = (klipper: KlipperState, printState: unknown): JobState['state'] => {
  if (klipper === 'startup') return 'startup';
  if (klipper === 'shutdown' || klipper === 'disconnected') return 'shutdown';
  if (klipper === 'error') return 'error';
  const value = String(printState ?? '').trim().toLowerCase();
  if (value === 'printing' || value === 'paused' || value === 'complete' || value === 'error') return value;
  return 'idle';
};

export const deriveTemperatures = (dynamicStatus: Record<string, any>, previous: PrinterTemperatures) => {
  const currentState = { temperatures: previous };
  const sensors = Object.entries(dynamicStatus).reduce<Record<string, { current: number; target: number }>>((acc, [key, value]) => {
    const sensorName = key.includes(' ') ? key.split(' ').slice(1).join(' ') : key;
    const previousSensor = currentState.temperatures.sensors[sensorName];
    const hasTemperature = Number.isFinite(Number((value as any)?.temperature));
    if (!hasTemperature && !previousSensor) {
      return acc;
    }
    acc[sensorName] = {
      current: Number((value as any)?.temperature ?? previousSensor?.current ?? currentState.temperatures.ambient),
      target: Number((value as any)?.target ?? previousSensor?.target ?? 0),
    };
    return acc;
  }, {});

  const chamberSensorEntry = Object.entries(dynamicStatus).find(([name]) => {
    return (
      name.trim().toLowerCase() === 'chamber' ||
      /temperature_sensor\s+chamber/i.test(name) ||
      (/\bchamber\b/i.test(name) && /sensor/i.test(name))
    );
  });

  const chamberControlEntry = Object.entries(dynamicStatus).find(([name]) => {
    return /temperature_fan\s+chamber/i.test(name) || /heater_generic\s+chamber/i.test(name);
  });

  const chamberCandidate = Object.entries(sensors).find(([name]) => /^chamber$/i.test(name) || /\bchamber\b/i.test(name));

  const chamberCurrent = Number(
    (chamberSensorEntry?.[1] as any)?.temperature ?? chamberCandidate?.[1]?.current ?? currentState.temperatures.chamber.current,
  );
  const chamberTarget = Number(
    (chamberControlEntry?.[1] as any)?.target
      ?? (chamberControlEntry?.[1] as any)?.target_temp
      ?? chamberCandidate?.[1]?.target
      ?? currentState.temperatures.chamber.target,
  );

  const chamber = {
    current: chamberCurrent,
    target: chamberTarget,
  };

  const sensorEntries = Object.entries(sensors);
  const ambientCandidates = sensorEntries.filter(([name]) => /ambient|air|enclosure/i.test(name));
  const controllerCandidates = sensorEntries.filter(([name]) => /mcu|board|controller|electronics/i.test(name));
  const piCandidates = sensorEntries.filter(([name]) => /pi|raspberry|soc|cpu/i.test(name));

  const ambient = ambientCandidates[0]?.[1].current ?? currentState.temperatures.ambient;
  const controller = controllerCandidates[0]?.[1].current ?? currentState.temperatures.controller;
  const raspberryPi = piCandidates[0]?.[1].current ?? currentState.temperatures.raspberryPi;

  return { sensors, chamber, ambient, controller, raspberryPi };
};
