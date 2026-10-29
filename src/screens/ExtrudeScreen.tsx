import { BackButton, Layout } from '../components/Layout';
import { useCommands, usePrinterStore } from '../stores/usePrinterStore';

export function ExtrudeScreen() {
  const commands = useCommands();
  const temperatures = usePrinterStore((state) => state.temperatures);
  const macros = usePrinterStore((state) => state.macros);
  const runAction = usePrinterStore((state) => state.runAction);
  const extrusionMacros = macros.filter((name) => /filament|purge|extrude|load|unload/i.test(name)).slice(0, 5);

  return (
    <Layout title="Extrude" subtitle="Load, Unload, Purge">
      <section className="status-row">
        <article className="status-chip"><div className="k">Nozzle</div><div className="v">{Math.round(temperatures.nozzle.current)}/{Math.round(temperatures.nozzle.target)}</div></article>
        <article className="status-chip"><div className="k">Extruder</div><div className="v">{temperatures.nozzle.current >= 170 ? 'Hot' : 'Cold'}</div></article>
        <article className="status-chip"><div className="k">Step</div><div className="v">5mm</div></article>
      </section>

      <section className="card">
        <div className="card-label">Readiness</div>
        <div className="card-title">Extruder State</div>
        <div className="kv"><span>Nozzle Temp</span><strong>{Math.round(temperatures.nozzle.current)} / {Math.round(temperatures.nozzle.target)}°C</strong></div>
        <div className="kv"><span>Extrusion Distance</span><strong>5mm step</strong></div>
      </section>

      <section className="card">
        <div className="card-label">Manual Actions</div>
        <div className="card-title">Extrusion Controls</div>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => runAction('Retract 5mm', () => commands.extrude(-5))}>Retract -5</button>
          <button type="button" className="btn accent" onClick={() => runAction('Extrude 5mm', () => commands.extrude(5))}>Extrude +5</button>
          <button type="button" className="btn" onClick={() => runAction('Extrude 20mm', () => commands.extrude(20))}>Extrude +20</button>
        </div>
        <div className="spacer" />
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => runAction('Load Filament', () => commands.runMacro('LOAD_FILAMENT'))}>Load Filament</button>
          <button type="button" className="btn" onClick={() => runAction('Unload Filament', () => commands.runMacro('UNLOAD_FILAMENT'))}>Unload</button>
          <button type="button" className="btn" onClick={() => runAction('Purge Nozzle', () => commands.runMacro('PURGE_NOZZLE'))}>Purge</button>
        </div>
        <div className="spacer" />
        <button type="button" className="btn" onClick={() => runAction('Disable Motors', () => commands.disableMotors())}>Disable Motors</button>
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

      <BackButton to="/settings" />
    </Layout>
  );
}
