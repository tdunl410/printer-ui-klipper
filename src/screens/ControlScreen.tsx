import { Layout } from '../components/Layout';
import { MoveControls } from '../components/MoveControls';
import { useCommands, usePrinterStore } from '../stores/usePrinterStore';

export function ControlScreen() {
  const commands = useCommands();
  const macros = usePrinterStore((state) => state.macros);
  const logs = usePrinterStore((state) => state.logs);

  const runAction = usePrinterStore((state) => state.runAction);


  return (
    <Layout title="Control" subtitle=" ">


      <MoveControls />

      <section className="card">
        <div className="card-label">One-Tap Macros</div>
        <div className="card-title">Macros</div>
        {macros.slice(0, 5).map((macro) => (
          <button
            type="button"
            className="macro-item button-reset"
            key={macro}
            onClick={() => runAction(`Run ${macro}`, () => commands.runMacro(macro))}
          >
            {macro}
          </button>
        ))}
        {macros.length === 0 ? <div className="macro-item">No macros discovered.</div> : null}
      </section>

      <section className="card">
        <div className="card-label">Realtime Log</div>
        <div className="card-title">Console</div>
        <div className="console">
          {logs.slice(0, 10).map((line, index) => (
            <div className="console-line" key={`${line}-${index}`}>{line}</div>
          ))}
        </div>
      </section>

    </Layout>
  );
}
