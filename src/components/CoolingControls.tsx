import type { CSSProperties } from 'react';
import { useCommands, usePrinterStore } from '../stores/usePrinterStore';

export function CoolingControls() {
  const commands = useCommands();
  const fanPartPercent = usePrinterStore((state) => state.fanPartPercent);
  const outputPins = usePrinterStore((state) => state.outputPins);
  const runAction = usePrinterStore((state) => state.runAction);

  return (
    <section className="card">
      <div className="card-title">Cooling</div>
      <div className="kv"><span>Part Fan</span><strong>{fanPartPercent}%</strong></div>
      <div className="fan-slider-row">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          className="fan-slider"
          aria-label="Part fan speed"
          value={Math.round(fanPartPercent)}
          style={{ '--slider-fill': `${Math.round(fanPartPercent)}%` } as CSSProperties}
          onChange={(event) => {
            const nextPercent = Number(event.currentTarget.value);
            void runAction(`Set part fan ${nextPercent}%`, () => commands.setFan(nextPercent, 'fan'));
          }}
        />
        <button type="button" className="btn" onClick={() => runAction('Part fan off', () => commands.setFan(0, 'fan'))}>OFF</button>
      </div>
      {outputPins.map((pin) => (
        <div key={pin.name}>
          <div className="spacer" />
          <div className="kv"><span>{pin.label}</span><strong>{pin.percent}%</strong></div>
          <div className="fan-slider-row">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              className="fan-slider"
              aria-label={`${pin.label} speed`}
              value={Math.round(pin.percent)}
              style={{ '--slider-fill': `${Math.round(pin.percent)}%` } as CSSProperties}
              onChange={(event) => {
                const nextPercent = Number(event.currentTarget.value);
                void runAction(`Set ${pin.label} ${nextPercent}%`, () => commands.setOutputPin(nextPercent, pin.name));
              }}
            />
            <button type="button" className="btn" onClick={() => runAction(`${pin.label} off`, () => commands.setOutputPin(0, pin.name))}>OFF</button>
          </div>
        </div>
      ))}
    </section>
  );
}
