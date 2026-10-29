import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import printerRender from '../../assets/printer-render.png';
import { Layout } from '../components/Layout';
import { useCommands } from '../stores/usePrinterStore';
import { usePrinterStore } from '../stores/usePrinterStore';

export function HomeScreen() {
  const commands = useCommands();
  const profileName = usePrinterStore((state) => state.profileName);
  const connectionState = usePrinterStore((state) => state.connectionState);
  const job = usePrinterStore((state) => state.job);
  const temperatures = usePrinterStore((state) => state.temperatures);
  const stats = usePrinterStore((state) => state.stats);
  const runAction = usePrinterStore((state) => state.runAction);
  const [activeKeypad, setActiveKeypad] = useState<'extruder' | 'heater_bed' | 'chamber' | null>(null);
  const [inputTarget, setInputTarget] = useState('');

  const targetMap = useMemo(
    () => ({
      extruder: temperatures.nozzle.target,
      heater_bed: temperatures.bed.target,
      chamber: temperatures.chamber.target,
    }),
    [temperatures.bed.target, temperatures.chamber.target, temperatures.nozzle.target],
  );

  const openKeypad = (heater: 'extruder' | 'heater_bed' | 'chamber') => {
    setActiveKeypad(heater);
    setInputTarget(String(Math.max(0, Math.round(targetMap[heater]))));
  };

  const closeKeypad = () => {
    setActiveKeypad(null);
    setInputTarget('');
  };

  const applyTarget = () => {
    if (!activeKeypad) return;
    const parsed = Number(inputTarget);
    if (!Number.isFinite(parsed)) return;
    const safeTarget = Math.max(0, Math.round(parsed));
    void runAction(`Set ${activeKeypad}`, () => commands.setHeater(activeKeypad, safeTarget));
    closeKeypad();
  };

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
          <div className="k">Network</div>
          <div className={`v ${connectionState === 'online' ? 'status-ok' : ''}`}>
            {connectionState === 'online' ? 'Online' : connectionState}
          </div>
        </article>
      </section>

      <div className="hero">
        <img src={printerRender} alt="Printer render" />
        <button type="button" className="pill temp-pill" style={{ left: 16, top: 26 }} onClick={() => openKeypad('extruder')}>
          🧰 {Math.round(temperatures.nozzle.current)}°C <span className="target">/{Math.round(temperatures.nozzle.target)}°C</span>
        </button>
        <button type="button" className="pill temp-pill" style={{ right: 16, bottom: 20 }} onClick={() => openKeypad('heater_bed')}>
          ♨️ {Math.round(temperatures.bed.current)}°C <span className="target">/{Math.round(temperatures.bed.target)}°C</span>
        </button>
        <button type="button" className="pill temp-pill" style={{ right: 16, top: 26 }} onClick={() => openKeypad('chamber')}>
          🌡 {Math.round(temperatures.chamber.current)}°C <span className="target">/{Math.round(temperatures.chamber.target)}°C</span>
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

      {activeKeypad ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <section className="modal-card">
            <div className="card-label">Set Target</div>
            <div className="card-title">{activeKeypad === 'extruder' ? 'Nozzle' : activeKeypad === 'heater_bed' ? 'Bed' : 'Chamber'} Temperature</div>
            <div className="temp-input-display">{inputTarget || '0'}°C</div>
            <div className="numpad-grid">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((value) => (
                <button
                  key={value}
                  type="button"
                  className="btn"
                  onClick={() => setInputTarget((prev) => `${prev}${value}`.replace(/^0+(\d)/, '$1'))}
                >
                  {value}
                </button>
              ))}
              <button type="button" className="btn" onClick={() => setInputTarget('')}>Clear</button>
              <button type="button" className="btn" onClick={() => setInputTarget((prev) => `${prev}0`.replace(/^0+(\d)/, '$1'))}>0</button>
              <button type="button" className="btn" onClick={() => setInputTarget((prev) => prev.slice(0, -1))}>⌫</button>
            </div>
            <div className="btn-row top-gap">
              <button type="button" className="btn accent" onClick={applyTarget}>Set</button>
              <button type="button" className="btn" onClick={closeKeypad}>Close</button>
            </div>
          </section>
        </div>
      ) : null}
    </Layout>
  );
}
