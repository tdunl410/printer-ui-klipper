import { useState } from 'react';
import { useCommands, usePrinterStore } from '../stores/usePrinterStore';
import { Dialog } from './Dialog';
import { KeyboardInput } from './OnScreenKeyboard';

export interface Preset {
  id: string;
  name: string;
  nozzle: number;
  bed: number;
  chamber: number;
  fan: number;
}

const STORAGE_KEY = 'printer-ui-presets';

const defaultPresets: Preset[] = [
  { id: 'pla', name: 'PLA', nozzle: 210, bed: 60, chamber: 0, fan: 100 },
  { id: 'abs', name: 'ABS', nozzle: 245, bed: 100, chamber: 0, fan: 0 },
  { id: 'asa', name: 'ASA', nozzle: 255, bed: 105, chamber: 45, fan: 0 },
];

function loadPresets(): Preset[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (Array.isArray(parsed) && parsed.every((entry) => entry && typeof entry.id === 'string' && typeof entry.name === 'string')) {
      return parsed as Preset[];
    }
  } catch {
    // fall through to defaults
  }
  return defaultPresets;
}

const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));

function Stepper({ label, value, step, max, unit, onChange }: {
  label: string;
  value: number;
  step: number;
  max: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="preset-stepper">
      <span>{label}</span>
      <button type="button" className="btn" onClick={() => onChange(clamp(value - step * 2, max))}>-{step * 2}</button>
      <button type="button" className="btn" onClick={() => onChange(clamp(value - step, max))}>-{step}</button>
      <strong>{value}{unit}</strong>
      <button type="button" className="btn" onClick={() => onChange(clamp(value + step, max))}>+{step}</button>
      <button type="button" className="btn" onClick={() => onChange(clamp(value + step * 2, max))}>+{step * 2}</button>
    </div>
  );
}

export function PresetsCard() {
  const commands = useCommands();
  const runAction = usePrinterStore((state) => state.runAction);
  const [presets, setPresets] = useState<Preset[]>(loadPresets);
  const [editing, setEditing] = useState<Preset | null>(null);
  const [isNew, setIsNew] = useState(false);

  const persist = (next: Preset[]) => {
    setPresets(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const apply = (preset: Preset) => {
    const lines = [
      `SET_HEATER_TEMPERATURE HEATER=extruder TARGET=${preset.nozzle}`,
      `SET_HEATER_TEMPERATURE HEATER=heater_bed TARGET=${preset.bed}`,
      // 0 means "leave the chamber alone" so printers without one don't error
      ...(preset.chamber > 0 ? [`SET_TEMPERATURE_FAN_TARGET TEMPERATURE_FAN=chamber TARGET=${preset.chamber}`] : []),
      `M106 S${Math.round((preset.fan / 100) * 255)}`,
    ];
    void runAction(`Apply ${preset.name} preset`, () => commands.runMacro(lines.join('\n')));
  };

  const startNew = () => {
    setIsNew(true);
    setEditing({ id: `preset-${Date.now()}`, name: '', nozzle: 200, bed: 60, chamber: 0, fan: 0 });
  };

  const save = () => {
    if (!editing) return;
    const named = { ...editing, name: editing.name.trim() };
    persist(isNew ? [...presets, named] : presets.map((entry) => (entry.id === named.id ? named : entry)));
    setEditing(null);
  };

  const patch = (changes: Partial<Preset>) => setEditing((prev) => (prev ? { ...prev, ...changes } : prev));

  return (
    <section className="card">
      <div className="card-label">Material Presets</div>
      <div className="card-title">Presets</div>
      {presets.map((preset) => (
        <div className="preset-row" key={preset.id}>
          <button type="button" className="macro-item button-reset" onClick={() => apply(preset)}>
            <span>{preset.name}</span>
            <strong>
              {preset.nozzle}° / {preset.bed}°{preset.chamber > 0 ? ` / ${preset.chamber}°` : ''} · Fan {preset.fan}%
            </strong>
          </button>
          <button type="button" className="btn" onClick={() => { setIsNew(false); setEditing(preset); }}>Edit</button>
        </div>
      ))}
      <div className="btn-row top-gap">
        <button type="button" className="btn" onClick={startNew}>Add Preset</button>
      </div>

      {editing ? (
        <Dialog
          subtitle={isNew ? 'New Preset' : 'Edit Preset'}
          title={editing.name || 'Untitled'}
          actions={[
            { label: 'Save', variant: 'accent', onClick: save, disabled: !editing.name.trim() },
            { label: 'Cancel', onClick: () => setEditing(null) },
            ...(isNew ? [] : [{
              label: 'Delete',
              onClick: () => {
                persist(presets.filter((entry) => entry.id !== editing.id));
                setEditing(null);
              },
            }]),
          ]}
        >
          <label className="field-label">Name</label>
          <KeyboardInput label="Preset name" value={editing.name} onChange={(name) => patch({ name })} placeholder="Preset name" />
          <Stepper label="Nozzle" value={editing.nozzle} step={5} max={480} unit="°" onChange={(nozzle) => patch({ nozzle })} />
          <Stepper label="Bed" value={editing.bed} step={5} max={160} unit="°" onChange={(bed) => patch({ bed })} />
          <Stepper label="Chamber" value={editing.chamber} step={5} max={100} unit="°" onChange={(chamber) => patch({ chamber })} />
          <Stepper label="Fan" value={editing.fan} step={5} max={100} unit="%" onChange={(fan) => patch({ fan })} />
          <div className="field-label">Chamber 0° leaves the chamber untouched.</div>
        </Dialog>
      ) : null}
    </section>
  );
}
