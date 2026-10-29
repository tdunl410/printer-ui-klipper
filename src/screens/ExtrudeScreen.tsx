import { useState } from 'react';
import arrowDown from '../../assets/arrow-down.svg';
import arrowUp from '../../assets/arrow-up.svg';
import extrudeIcon from '../../assets/extrude.svg';
import { Layout } from '../components/Layout';
import { useCommands, usePrinterStore } from '../stores/usePrinterStore';

export function ExtrudeScreen() {
  const commands = useCommands();
  const temperatures = usePrinterStore((state) => state.temperatures);
  const macros = usePrinterStore((state) => state.macros);
  const runAction = usePrinterStore((state) => state.runAction);
  const [extrudeDistance, setExtrudeDistance] = useState(5);
  const [extrudeSpeed, setExtrudeSpeed] = useState(25);
  const distanceOptions = [1, 5, 10, 25];
  const speedOptions = [1, 5, 10, 25];
  const extrusionMacros = macros.filter((name) => /filament|purge|extrude|load|unload/i.test(name)).slice(0, 5);

  return (
    <Layout title="Extrude" subtitle="Load, Unload, Purge">
      <section className="card">
        <div className="card-label">Extruder</div>
        <div className="ex-temp">
          <div>
            <div className="ex-temp-value">{temperatures.nozzle.current.toFixed(1)}°C</div>
            <div className="ex-temp-sub">Target {Math.round(temperatures.nozzle.target)}°C · {temperatures.nozzle.current >= 170 ? 'Ready' : 'Too cold'}</div>
          </div>
        </div>
        <div className="ex-grid">
          <button type="button" className="ex-tile c-blue" onClick={() => runAction(`Extrude ${extrudeDistance}mm`, () => commands.extrude(extrudeDistance, extrudeSpeed))}><img src={extrudeIcon} alt="" />Extrude</button>
          <button type="button" className="ex-tile c-green" onClick={() => runAction('Load Filament', () => commands.runMacro('LOAD_FILAMENT'))}><img src={arrowDown} alt="" />Load</button>
          <button type="button" className="ex-tile c-pink" onClick={() => runAction('Unload Filament', () => commands.runMacro('UNLOAD_FILAMENT'))}><img src={arrowUp} alt="" />Unload</button>
          <button type="button" className="ex-tile c-orange" onClick={() => runAction(`Retract ${extrudeDistance}mm`, () => commands.extrude(-extrudeDistance, extrudeSpeed))}><img src={arrowUp} alt="" />Retract</button>
        </div>
        <div className="ex-label">Distance (mm)</div>
        <div className="ex-seg">
          {distanceOptions.map((d) => (
            <button key={d} type="button" className={extrudeDistance === d ? 'active' : ''} onClick={() => setExtrudeDistance(d)}>{d}</button>
          ))}
        </div>
        <div className="ex-label">Speed (mm/s)</div>
        <div className="ex-seg">
          {speedOptions.map((v) => (
            <button key={v} type="button" className={extrudeSpeed === v ? 'active' : ''} onClick={() => setExtrudeSpeed(v)}>{v}</button>
          ))}
        </div>
        <div className="spacer" />
        <div className="btn-row two">
          <button type="button" className="btn" onClick={() => runAction('Purge Nozzle', () => commands.runMacro('PURGE_NOZZLE'))}>Purge</button>
          <button type="button" className="btn" onClick={() => runAction('Disable Motors', () => commands.disableMotors())}>Disable Motors</button>
        </div>
      </section>

      <section className="card">
        <div className="card-label">Automation</div>
        <div className="card-title">Macros</div>
        {extrusionMacros.map((macro) => (
          <button
            key={macro}
            type="button"
            className="macro-item button-reset"
            onClick={() => runAction(`Run ${macro}`, () => commands.runMacro(macro))}
          >
            {macro}
          </button>
        ))}
        {extrusionMacros.length === 0 ? (
          <div className="macro-item">No extrusion macros discovered.</div>
        ) : null}
      </section>

    </Layout>
  );
}
