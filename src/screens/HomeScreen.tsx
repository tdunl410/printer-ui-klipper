import { Link } from 'react-router-dom';
import extrudeIcon from '../../assets/extrude.svg';
import heaterIcon from '../../assets/heater.svg';
import moveIcon from '../../assets/move.svg';
import networkIcon from '../../assets/network.svg';
import { HeaterKeypad, useHeaterKeypad } from '../components/HeaterKeypad';
import { Layout } from '../components/Layout';
import { usePrinterStore } from '../stores/usePrinterStore';
import { printerRenders } from '../utils/printerRenders';

export function HomeScreen() {
  const profileName = usePrinterStore((state) => state.profileName);
  const connectionState = usePrinterStore((state) => state.connectionState);
  const job = usePrinterStore((state) => state.job);
  const temperatures = usePrinterStore((state) => state.temperatures);
  const stats = usePrinterStore((state) => state.stats);
  const printerRenderName = usePrinterStore((state) => state.printerRender);
  const keypad = useHeaterKeypad();
  const printerRender = printerRenders.find((render) => render.name === printerRenderName) ?? printerRenders[0];

  const printRoute = job.state === 'printing' || job.state === 'paused' ? '/print' : '/files';
  const connectionBadge = connectionState === 'online' ? 'Ready to Print' : 'Disconnected';
  const stateLabel = job.state === 'idle' ? 'Idle' : job.state === 'shutdown' ? 'Shutdown' : job.state === 'startup' ? 'Starting' : job.state;

  return (
    <Layout
      title={profileName}
      subtitle={`${stateLabel} | ${connectionState === 'online' ? connectionBadge : 'Disconnected'}`}
    >
      <section className="status-row two">
        <article className="status-chip">
          <div className="k">State</div>
          <div className="v">{stateLabel}</div>
        </article>
        <article className="status-chip">
          <div className="k status-icon-label">
            <img className="status-icon" src={networkIcon} alt="" aria-hidden="true" />
            Network
          </div>
          <div className={`v ${connectionState === 'online' ? 'status-ok' : ''}`}>
            {connectionState === 'online' ? 'Online' : connectionState}
          </div>
        </article>
      </section>

      <div className="hero">
        {printerRender ? <img src={printerRender.src} alt="Printer render" /> : null}
        <button type="button" className="pill temp-pill" style={{ left: 16, top: 26 }} onClick={() => keypad.open('extruder')}>
          {Math.round(temperatures.nozzle.current)}°C <span className="target">/{Math.round(temperatures.nozzle.target)}°C</span>
        </button>
        <button type="button" className="pill temp-pill" style={{ right: 16, bottom: 20 }} onClick={() => keypad.open('heater_bed')}>
          {Math.round(temperatures.bed.current)}°C <span className="target">/{Math.round(temperatures.bed.target)}°C</span>
        </button>
        <button type="button" className="pill temp-pill" style={{ right: 16, top: 26 }} onClick={() => keypad.open('chamber')}>
          {Math.round(temperatures.chamber.current)}°C <span className="target">/{Math.round(temperatures.chamber.target)}°C</span>
        </button>
      </div>

      
      <section className="stats">
        <div className="card-label stats-title">Machine Statistics</div>
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

      {job.state === 'printing' || job.state === 'paused' ? (
        <Link className="primary home-primary" to="/print">
          View Active Print
        </Link>
      ) : (
        <Link className="primary home-primary" to={printRoute}>
          Print
        </Link>
      )}

      <section className="floating-actions">
        <Link className="action-link with-icon home-action-link" to="/control" aria-label="Move">
          <img className="action-icon" src={moveIcon} alt="" aria-hidden="true" />
          <span className="btn-label">Move</span>
        </Link>
        <Link className="action-link with-icon home-action-link" to="/preheat" aria-label="Preheat">
          <img className="action-icon" src={heaterIcon} alt="" aria-hidden="true" />
          <span className="btn-label">Preheat</span>
        </Link>
        <Link className="action-link with-icon home-action-link" to="/extrude" aria-label="Extrude">
          <img className="action-icon" src={extrudeIcon} alt="" aria-hidden="true" />
          <span className="btn-label">Extrude</span>
        </Link>
      </section>

      <HeaterKeypad keypad={keypad} />
    </Layout>
  );
}
