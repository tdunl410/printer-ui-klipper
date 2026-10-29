import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { usePrinterStore } from '../stores/usePrinterStore';

export function HomeScreen() {
  const profileName = usePrinterStore((state) => state.profileName);
  const connectionState = usePrinterStore((state) => state.connectionState);
  const job = usePrinterStore((state) => state.job);
  const temperatures = usePrinterStore((state) => state.temperatures);
  const stats = usePrinterStore((state) => state.stats);

  const printRoute = job.state === 'printing' || job.state === 'paused' ? '/print' : '/files';

  return (
    <Layout
      title={profileName}
      subtitle={`${job.state === 'idle' ? 'Idle' : job.state} | ${connectionState === 'online' ? 'Ready to Print' : 'Disconnected'}`}
    >
      <section className="status-row two">
        <article className="status-chip">
          <div className="k">State</div>
          <div className="v">{job.state}</div>
        </article>
        <article className="status-chip">
          <div className="k">Network</div>
          <div className={`v ${connectionState === 'online' ? 'status-ok' : ''}`}>
            {connectionState === 'online' ? 'Online' : connectionState}
          </div>
        </article>
      </section>

      <div className="hero">
        <img src="/assets/printer-render.png" alt="Printer render" />
        <div className="pill" style={{ left: 16, top: 26 }}>
          🧰 {Math.round(temperatures.nozzle.current)}°C <span className="target">/{Math.round(temperatures.nozzle.target)}°C</span>
        </div>
        <div className="pill" style={{ right: 16, bottom: 20 }}>
          ♨️ {Math.round(temperatures.bed.current)}°C <span className="target">/{Math.round(temperatures.bed.target)}°C</span>
        </div>
        <div className="pill" style={{ right: 16, top: 26 }}>
          🌡 {Math.round(temperatures.chamber.current)}°C <span className="target">/{Math.round(temperatures.chamber.target)}°C</span>
        </div>
      </div>

      <div className="card-label">Machine Statistics</div>
      <section className="stats">
        <article className="stat">
          <div className="value">{Math.round(stats.totalTimeHours)}h</div>
          <div className="label">Total Time</div>
        </article>
        <article className="stat">
          <div className="value">{stats.printCount}</div>
          <div className="label">Print Count</div>
        </article>
        <article className="stat">
          <div className="value">{stats.filamentKg.toFixed(1)}kg</div>
          <div className="label">Filament Usage</div>
        </article>
      </section>

      <Link className="primary" to={printRoute}>
        Print
      </Link>

      <section className="floating-actions">
        <Link className="action-link" to="/move">
          Move
        </Link>
        <Link className="action-link" to="/preheat">
          Preheat
        </Link>
        <Link className="action-link" to="/extrude">
          Extrude
        </Link>
      </section>
    </Layout>
  );
}
