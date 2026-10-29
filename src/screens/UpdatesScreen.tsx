import { Layout } from '../components/Layout';
import { useCommands, usePrinterStore } from '../stores/usePrinterStore';

export function UpdatesScreen() {
  const commands = useCommands();
  const boot = usePrinterStore((state) => state.boot);
  const runAction = usePrinterStore((state) => state.runAction);
  const connectionState = usePrinterStore((state) => state.connectionState);
  const logs = usePrinterStore((state) => state.logs);
  const versions = usePrinterStore((state) => state.versions);
  const updateCount = usePrinterStore((state) => state.updateCount);

  return (
    <Layout title="Updates" subtitle="Versions + Logs">
      <section className="status-row">
        <article className="status-chip"><div className="k">System</div><div className="v">{connectionState === 'online' ? 'Ready' : 'Offline'}</div></article>
        <article className="status-chip"><div className="k">Moonraker</div><div className="v">{versions.moonraker || '-'}</div></article>
        <article className="status-chip"><div className="k">Updates</div><div className="v">{updateCount}</div></article>
      </section>

      <section className="card">
        <div className="card-label">Installed Versions</div>
        <div className="card-title">Core Services</div>
        <div className="kv"><span>Klipper</span><strong>{versions.klipper || '-'}</strong></div>
        <div className="kv"><span>Moonraker</span><strong>{versions.moonraker || '-'}</strong></div>
        <div className="kv"><span>Mainsail</span><strong>{versions.mainsail || '-'}</strong></div>
        <div className="kv"><span>Fluidd</span><strong>{versions.fluidd || '-'}</strong></div>
      </section>

      <section className="card">
        <div className="card-label">Available Updates</div>
        <div className="card-title">Queue</div>
        <div className="file-item">{updateCount > 0 ? `${updateCount} updates reported by Moonraker` : 'No pending updates reported'}</div>
        <div className="btn-row">
          <button type="button" className="btn accent" onClick={() => boot()}>Refresh</button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              void runAction('Update Screen', async () => {
                await commands.updateScreen();
                window.setTimeout(() => {
                  window.location.reload();
                }, 4000);
              });
            }}
          >
            Update Screen
          </button>
          <button type="button" className="btn" onClick={() => runAction('Restart Klipper', () => commands.systemAction('restart-klipper'))}>Restart Klipper</button>
          <button type="button" className="btn" onClick={() => runAction('Restart Host', () => commands.systemAction('restart-host'))}>Restart Host</button>
        </div>
      </section>

      <section className="card">
        <div className="card-label">Diagnostics</div>
        <div className="card-title">Logs & Recovery</div>
        <div className="console short-console">
          {logs.slice(0, 8).map((line, index) => (
            <div key={`${line}-${index}`} className="console-line">{line}</div>
          ))}
        </div>
      </section>

    </Layout>
  );
}
