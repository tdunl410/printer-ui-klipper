import { useState } from 'react';
import { useCommands, usePrinterStore } from '../stores/usePrinterStore';

export type HeaterKey = 'extruder' | 'heater_bed' | 'chamber';

const heaterLabels: Record<HeaterKey, string> = {
  extruder: 'Nozzle',
  heater_bed: 'Bed',
  chamber: 'Chamber',
};

export function useHeaterKeypad() {
  const commands = useCommands();
  const temperatures = usePrinterStore((state) => state.temperatures);
  const runAction = usePrinterStore((state) => state.runAction);
  const [active, setActive] = useState<HeaterKey | null>(null);
  const [input, setInput] = useState('');

  const targets: Record<HeaterKey, number> = {
    extruder: temperatures.nozzle.target,
    heater_bed: temperatures.bed.target,
    chamber: temperatures.chamber.target,
  };

  const open = (heater: HeaterKey) => {
    setActive(heater);
    setInput(String(Math.max(0, Math.round(targets[heater]))));
  };

  const close = () => {
    setActive(null);
    setInput('');
  };

  const apply = () => {
    if (!active) return;
    const parsed = Number(input);
    if (!Number.isFinite(parsed)) return;
    const safeTarget = Math.max(0, Math.round(parsed));
    void runAction(`Set ${active}`, () => commands.setHeater(active, safeTarget));
    close();
  };

  return { active, input, setInput, targets, open, close, apply };
}

type Keypad = ReturnType<typeof useHeaterKeypad>;

export function HeaterKeypad({ keypad }: { keypad: Keypad }) {
  const { active, input, setInput, close, apply } = keypad;
  if (!active) return null;

  const append = (digit: number) => setInput((prev) => `${prev}${digit}`.replace(/^0+(\d)/, '$1'));

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <section className="modal-card">
        <div className="card-label">Set Target</div>
        <div className="card-title">{heaterLabels[active]} Temperature</div>
        <div className="temp-input-display">{input || '0'}°C</div>
        <div className="numpad-grid">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((value) => (
            <button key={value} type="button" className="btn" onClick={() => append(value)}>
              {value}
            </button>
          ))}
          <button type="button" className="btn" onClick={() => setInput('')}>Clear</button>
          <button type="button" className="btn" onClick={() => append(0)}>0</button>
          <button type="button" className="btn" onClick={() => setInput((prev) => prev.slice(0, -1))}>⌫</button>
        </div>
        <div className="btn-row top-gap">
          <button type="button" className="btn accent" onClick={apply}>Set</button>
          <button type="button" className="btn" onClick={close}>Close</button>
        </div>
      </section>
    </div>
  );
}
