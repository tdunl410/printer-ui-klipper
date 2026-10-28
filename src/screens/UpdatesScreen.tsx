import { BackButton, Layout } from '../components/Layout';
import { usePrinterStore } from '../stores/usePrinterStore';

export function UpdatesScreen() {
  const logs = usePrinterStore((state) => state.logs);

  return (
    <Layout title="Updates" subtitle="Versions + Logs">
      <section className="status-row">
        <article className="status-chip"><div className="k">System</div><div className="v">Ready</div></article>
        <article className="status-chip"><div className="k">Last Check</div><div className="v">Today</div></article>
        <article className="status-chip"><div className="k">Updates</div><div className="v">2 Available</div></article>
      </section>

      <section className="card">
        <div className="card-label">Installed Versions</div>
        <div className="card-title">Core Services</div>
        <div className="kv"><span>Klipper</span><strong>v0.12.0</strong></div>
        <div className="kv"><span>Moonraker</span><strong>v0.9.x</strong></div>
        <div className="kv"><span>Mainsail</span><strong>v2.x</strong></div>
        <div className="kv"><span>UI Shell</span><strong>v0.1.0</strong></div>
      </section>

      <section className="card">
        <div className="card-label">Available Updates</div>
        <div className="card-title">Queue</div>
        <div className="file-item">Moonraker: v0.9.x → v0.10.x</div>
        <div className="file-item">Mainsail: v2.x → v2.y</div>
        <div className="btn-row">
          <button type="button" className="btn accent">Update All</button>
          <button type="button" className="btn">Update Selected</button>
          <button type="button" className="btn">Ignore</button>
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

      <BackButton to="/settings" />
    </Layout>
  );
}
