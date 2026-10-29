import { Link } from 'react-router-dom';
import extrudeIcon from '../../assets/extrude.svg';
import heaterIcon from '../../assets/heater.svg';
import moveIcon from '../../assets/move.svg';
import networkIcon from '../../assets/network.svg';
import printerRender from '../../assets/printer-render.png';
import { HeaterKeypad, useHeaterKeypad } from '../components/HeaterKeypad';
import { Layout } from '../components/Layout';
import { usePrinterStore } from '../stores/usePrinterStore';

export function HomeScreen() {
  const profileName = usePrinterStore((state) => state.profileName);
  const connectionState = usePrinterStore((state) => state.connectionState);
  const job = usePrinterStore((state) => state.job);
  const temperatures = usePrinterStore((state) => state.temperatures);
  const stats = usePrinterStore((state) => state.stats);
  const keypad = useHeaterKeypad();

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
        <img src={printerRender} alt="Printer render" />
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

      {job.state === 'printing' || job.state === 'paused' ? (
        <Link className="primary" to="/print">
          View Active Print
        </Link>
      ) : (
        <Link className="primary" to={printRoute}>
          Print
        </Link>
      )}

      <section className="floating-actions">
        <Link className="action-link with-icon" to="/control">
          <img className="action-icon" src={moveIcon} alt="" aria-hidden="true" />
          Move
        </Link>
        <Link className="action-link with-icon" to="/preheat">
          <img className="action-icon" src={heaterIcon} alt="" aria-hidden="true" />
          Preheat
        </Link>
        <Link className="action-link with-icon" to="/extrude">
          <img className="action-icon" src={extrudeIcon} alt="" aria-hidden="true" />
          Extrude
        </Link>
      </section>

      <HeaterKeypad keypad={keypad} />
    </Layout>
  );
}
