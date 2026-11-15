import { useState } from 'react';
import { useCommands, usePrinterStore } from '../stores/usePrinterStore';

interface TuneSettingProps {
  label: string;
  unit: string;
  value?: number;
  increment: number;
  max?: number;
  onSet: (value: number) => void;
}

function TuneSetting({ label, unit, value, increment, max, onSet }: TuneSettingProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const parsed = draft === null ? value : Number(draft);
  const valid = draft !== '' && parsed !== undefined && Number.isFinite(parsed)
    && parsed >= 0 && (max === undefined || parsed <= max);
  const adjust = (delta: number) => {
    if (value === undefined) return;
    const adjusted = Number((value + delta).toPrecision(12));
    onSet(Math.min(max ?? Infinity, Math.max(0, adjusted)));
    setDraft(null);
  };

  return (
    <div className="motion-setting">
      <div className="kv"><span>{label}</span><strong>{value === undefined ? 'Unavailable' : `${value} ${unit}`}</strong></div>
      <div className="motion-setting-controls">
        <button type="button" className="btn" aria-label={`Decrease ${label}`} disabled={value === undefined || value <= 0} onClick={() => adjust(-increment)}>−</button>
        <input
          className="motion-setting-input"
          type="number"
          inputMode="decimal"
          aria-label={`${label} value`}
          min={0}
          max={max}
          step="any"
          value={draft ?? value ?? ''}
          disabled={value === undefined}
          onChange={(event) => setDraft(event.currentTarget.value)}
        />
        <button type="button" className="btn" aria-label={`Increase ${label}`} disabled={value === undefined || (max !== undefined && value >= max)} onClick={() => adjust(increment)}>+</button>
        <button type="button" className="btn" disabled={value === undefined || !valid} onClick={() => {
          if (parsed === undefined || !valid) return;
          onSet(parsed);
          setDraft(null);
        }}>Set</button>
      </div>
      <div className="motion-setting-hint">
        {draft !== null && !valid ? (max === undefined ? 'Enter a non-negative number.' : `Enter a value from 0 to ${max}.`) : `Step ${increment} ${unit}`}
      </div>
    </div>
  );
}

export function MotionTuneControls() {
  const commands = useCommands();
  const tuning = usePrinterStore((state) => state.motionTuning);
  const runAction = usePrinterStore((state) => state.runAction);
  const extruder = tuning.activeExtruder;
  const values = extruder ? tuning.extruders[extruder] : undefined;

  return (
    <section className="card">
      <div className="card-title">Pressure Advance &amp; Motion</div>
      <div className="motion-setting-hint">Active extruder: {extruder ?? 'unavailable'}</div>
      <TuneSetting
        key={`advance-${extruder}`}
        label="Pressure advance"
        unit="s"
        value={values?.pressureAdvance}
        increment={0.001}
        onSet={(value) => {
          if (extruder) void runAction('Set pressure advance', () => commands.setPressureAdvance(extruder, value));
        }}
      />
      <TuneSetting
        key={`smooth-${extruder}`}
        label="Smooth time"
        unit="s"
        value={values?.smoothTime}
        increment={0.001}
        max={0.2}
        onSet={(value) => {
          if (extruder) void runAction('Set smooth time', () => commands.setPressureAdvanceSmoothTime(extruder, value));
        }}
      />
      <TuneSetting
        label="Square corner velocity"
        unit="mm/s"
        value={tuning.squareCornerVelocity}
        increment={5}
        onSet={(value) => void runAction('Set square corner velocity', () => commands.setSquareCornerVelocity(value))}
      />
    </section>
  );
}
