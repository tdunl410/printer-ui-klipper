import { useMemo, useState } from 'react';
import { BackButton, Layout } from '../components/Layout';
import { useCommands, usePrinterStore } from '../stores/usePrinterStore';

function tempY(value: number) {
  const clamped = Math.max(0, Math.min(300, value));
  return 145 - (clamped / 300) * 125;
}

function line(series: number[]) {
  if (series.length === 0) return '';
  const span = Math.max(1, series.length - 1);
  const points = series.map((value, index) => {
    const x = (index / span) * 320;
    return `${x.toFixed(1)},${tempY(value).toFixed(1)}`;
  });
  return points.join(' ');
}

export function PreheatScreen() {
  const commands = useCommands();
  const temperatures = usePrinterStore((state) => state.temperatures);
  const temperatureHistory = usePrinterStore((state) => state.temperatureHistory);
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

  const adjust = (heater: 'extruder' | 'heater_bed' | 'chamber', delta: number) => {
    const currentTarget = targetMap[heater];
    const nextTarget = Math.max(0, Math.round(currentTarget + delta));
    void runAction(`Set ${heater}`, () => commands.setHeater(heater, nextTarget));
  };

  const sensorEntries = Object.entries(temperatures.sensors);

  return (
    <Layout title="Preheat" subtitle="Nozzle + Bed + Chamber">
      <section className="status-row">
        <article className="status-chip"><div className="k">Nozzle</div><div className="v">{Math.round(temperatures.nozzle.current)}/{Math.round(temperatures.nozzle.target)}</div></article>
        <article className="status-chip"><div className="k">Bed</div><div className="v">{Math.round(temperatures.bed.current)}/{Math.round(temperatures.bed.target)}</div></article>
        <article className="status-chip"><div className="k">Chamber</div><div className="v">{Math.round(temperatures.chamber.current)}/{Math.round(temperatures.chamber.target)}</div></article>
      </section>

      <section className="card">
        <div className="card-label">Set Targets</div>
        <div className="card-title">Temperature Setpoints</div>

        <button type="button" className="kv temp-target-row button-reset" onClick={() => openKeypad('extruder')}><span>Nozzle</span><strong>{Math.round(temperatures.nozzle.current)} / {Math.round(temperatures.nozzle.target)}°C</strong></button>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => adjust('extruder', -5)}>-5°C</button>
          <button type="button" className="btn" onClick={() => adjust('extruder', -targetMap.extruder)}>Off</button>
          <button type="button" className="btn" onClick={() => adjust('extruder', 5)}>+5°C</button>
        </div>

        <div className="spacer" />
        <button type="button" className="kv temp-target-row button-reset" onClick={() => openKeypad('heater_bed')}><span>Bed</span><strong>{Math.round(temperatures.bed.current)} / {Math.round(temperatures.bed.target)}°C</strong></button>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => adjust('heater_bed', -5)}>-5°C</button>
          <button type="button" className="btn" onClick={() => adjust('heater_bed', -targetMap.heater_bed)}>Off</button>
          <button type="button" className="btn" onClick={() => adjust('heater_bed', 5)}>+5°C</button>
        </div>

        <div className="spacer" />
        <button type="button" className="kv temp-target-row button-reset" onClick={() => openKeypad('chamber')}><span>Chamber</span><strong>{Math.round(temperatures.chamber.current)} / {Math.round(temperatures.chamber.target)}°C</strong></button>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => adjust('chamber', -5)}>-5°C</button>
          <button type="button" className="btn" onClick={() => adjust('chamber', -targetMap.chamber)}>Off</button>
          <button type="button" className="btn" onClick={() => adjust('chamber', 5)}>+5°C</button>
        </div>
      </section>

      <section className="card">
        <div className="card-label">Live Monitoring</div>
        <div className="card-title">All Temperatures</div>

        <div className="temp-legend">
          <span><i className="dot nozzle"></i>Nozzle</span>
          <span><i className="dot bed"></i>Bed</span>
          <span><i className="dot chamber"></i>Chamber</span>
          <span><i className="dot ambient"></i>Ambient</span>
          <span><i className="dot controller"></i>Controller</span>
          <span><i className="dot pi"></i>Raspberry Pi</span>
          {sensorEntries.map(([name]) => (
            <span key={name}><i className="dot" style={{ background: 'var(--text-muted)' }}></i>{name}</span>
          ))}
        </div>

        <div className="temp-graph-wrap">
          <svg className="temp-graph" viewBox="0 0 320 150" preserveAspectRatio="none" aria-label="Temperature graph">
            <g className="grid">
              <line x1="0" y1="20" x2="320" y2="20"></line>
              <line x1="0" y1="50" x2="320" y2="50"></line>
              <line x1="0" y1="80" x2="320" y2="80"></line>
              <line x1="0" y1="110" x2="320" y2="110"></line>
              <line x1="0" y1="140" x2="320" y2="140"></line>
            </g>
            <polyline className="line nozzle" points={line(temperatureHistory.nozzle ?? [temperatures.nozzle.current])}></polyline>
            <polyline className="line bed" points={line(temperatureHistory.bed ?? [temperatures.bed.current])}></polyline>
            <polyline className="line chamber" points={line(temperatureHistory.chamber ?? [temperatures.chamber.current])}></polyline>
            <polyline className="line ambient" points={line(temperatureHistory.ambient ?? [temperatures.ambient])}></polyline>
            <polyline className="line controller" points={line(temperatureHistory.controller ?? [temperatures.controller])}></polyline>
            <polyline className="line pi" points={line(temperatureHistory.raspberryPi ?? [temperatures.raspberryPi])}></polyline>
            {sensorEntries.map(([name]) => (
              <polyline
                key={name}
                className="line"
                points={line(temperatureHistory[name] ?? [temperatures.sensors[name].current])}
                style={{ stroke: 'var(--text-muted)' }}
              ></polyline>
            ))}
          </svg>
        </div>
      </section>

      <section className="card">
        <div className="card-label">Material Presets</div>
        <div className="card-title">Presets</div>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => runAction('Apply PLA preset', () => commands.runMacro('SET_HEATER_TEMPERATURE HEATER=extruder TARGET=210\nSET_HEATER_TEMPERATURE HEATER=heater_bed TARGET=60'))}>PLA</button>
          <button type="button" className="btn" onClick={() => runAction('Apply ABS preset', () => commands.runMacro('SET_HEATER_TEMPERATURE HEATER=extruder TARGET=245\nSET_HEATER_TEMPERATURE HEATER=heater_bed TARGET=100'))}>ABS</button>
          <button type="button" className="btn" onClick={() => runAction('Apply ASA preset', () => commands.runMacro('SET_HEATER_TEMPERATURE HEATER=extruder TARGET=255\nSET_HEATER_TEMPERATURE HEATER=heater_bed TARGET=105\nSET_TEMPERATURE_FAN_TARGET TEMPERATURE_FAN=chamber TARGET=45'))}>ASA</button>
        </div>
      </section>

      <section className="card">
        <div className="card-label">Sensor Health</div>
        <div className="card-title">Sensors</div>
        <div className="kv"><span>Toolhead Ambient</span><strong>{Math.round(temperatures.ambient)}°C</strong></div>
        <div className="kv"><span>Electronics Bay</span><strong>{Math.round(temperatures.controller)}°C</strong></div>
        <div className="kv"><span>Chamber Rear</span><strong>{Math.round(temperatures.raspberryPi)}°C</strong></div>
        {sensorEntries.map(([name, values]) => (
          <div className="kv" key={name}><span>{name}</span><strong>{Math.round(values.current)} / {Math.round(values.target)}°C</strong></div>
        ))}
      </section>

      <BackButton to="/" />

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
