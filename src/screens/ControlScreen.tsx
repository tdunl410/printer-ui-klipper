import { BackButton, Layout } from '../components/Layout';
import { useCommands, usePrinterStore } from '../stores/usePrinterStore';

export function ControlScreen() {
  const commands = useCommands();
  const connectionState = usePrinterStore((state) => state.connectionState);
  const macros = usePrinterStore((state) => state.macros);
  const logs = usePrinterStore((state) => state.logs);
  const commandQueue = usePrinterStore((state) => state.commandQueue);
  const runAction = usePrinterStore((state) => state.runAction);

  const pending = commandQueue.filter((entry) => entry.status === 'pending').length;
  const hasErrors = commandQueue.some((entry) => entry.status === 'error');

  return (
    <Layout title="Console" subtitle="Macros + Terminal">
      <section className="status-row">
        <article className="status-chip"><div className="k">Klipper</div><div className="v">{connectionState === 'online' ? 'Ready' : 'Offline'}</div></article>
        <article className="status-chip"><div className="k">Queue</div><div className="v">{pending} Pending</div></article>
        <article className="status-chip"><div className="k">Errors</div><div className="v">{hasErrors ? 'Present' : 'None'}</div></article>
      </section>

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

      <BackButton to="/" />
    </Layout>
  );
}
