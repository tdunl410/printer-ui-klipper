import { BackButton, Layout } from '../components/Layout';
import { useCommands, usePrinterStore } from '../stores/usePrinterStore';

function tempY(value: number) {
  const clamped = Math.max(0, Math.min(300, value));
  return 145 - (clamped / 300) * 125;
}

function line(value: number) {
  const points = Array.from({ length: 17 }, (_, index) => {
    const x = index * 20;
    const wave = Math.sin(index / 3) * 6;
    return `${x},${(tempY(value) + wave).toFixed(1)}`;
  });
  return points.join(' ');
}

export function PreheatScreen() {
  const commands = useCommands();
  const temperatures = usePrinterStore((state) => state.temperatures);
  const runAction = usePrinterStore((state) => state.runAction);

  const adjust = (heater: 'extruder' | 'heater_bed' | 'chamber', delta: number, currentTarget: number) => {
    void runAction(`Set ${heater}`, () => commands.setHeater(heater, Math.max(0, currentTarget + delta)));
  };

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

        <div className="kv"><span>Nozzle</span><strong>{Math.round(temperatures.nozzle.current)} / {Math.round(temperatures.nozzle.target)}°C</strong></div>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => adjust('extruder', -5, temperatures.nozzle.target)}>-5°C</button>
          <button type="button" className="btn" onClick={() => adjust('extruder', -temperatures.nozzle.target, temperatures.nozzle.target)}>Off</button>
          <button type="button" className="btn" onClick={() => adjust('extruder', 5, temperatures.nozzle.target)}>+5°C</button>
        </div>

        <div className="spacer" />
        <div className="kv"><span>Bed</span><strong>{Math.round(temperatures.bed.current)} / {Math.round(temperatures.bed.target)}°C</strong></div>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => adjust('heater_bed', -5, temperatures.bed.target)}>-5°C</button>
          <button type="button" className="btn" onClick={() => adjust('heater_bed', -temperatures.bed.target, temperatures.bed.target)}>Off</button>
          <button type="button" className="btn" onClick={() => adjust('heater_bed', 5, temperatures.bed.target)}>+5°C</button>
        </div>

        <div className="spacer" />
        <div className="kv"><span>Chamber</span><strong>{Math.round(temperatures.chamber.current)} / {Math.round(temperatures.chamber.target)}°C</strong></div>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => adjust('chamber', -5, temperatures.chamber.target)}>-5°C</button>
          <button type="button" className="btn" onClick={() => adjust('chamber', -temperatures.chamber.target, temperatures.chamber.target)}>Off</button>
          <button type="button" className="btn" onClick={() => adjust('chamber', 5, temperatures.chamber.target)}>+5°C</button>
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
            <polyline className="line nozzle" points={line(temperatures.nozzle.current)}></polyline>
            <polyline className="line bed" points={line(temperatures.bed.current)}></polyline>
            <polyline className="line chamber" points={line(temperatures.chamber.current)}></polyline>
            <polyline className="line ambient" points={line(temperatures.ambient)}></polyline>
            <polyline className="line controller" points={line(temperatures.controller)}></polyline>
            <polyline className="line pi" points={line(temperatures.raspberryPi)}></polyline>
          </svg>
        </div>
      </section>

      <section className="card">
        <div className="card-label">Material Presets</div>
        <div className="card-title">Presets</div>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => runAction('Apply PLA preset', () => commands.runMacro('SET_HEATER_TEMPERATURE HEATER=extruder TARGET=210\nSET_HEATER_TEMPERATURE HEATER=heater_bed TARGET=60'))}>PLA</button>
          <button type="button" className="btn" onClick={() => runAction('Apply ABS preset', () => commands.runMacro('SET_HEATER_TEMPERATURE HEATER=extruder TARGET=245\nSET_HEATER_TEMPERATURE HEATER=heater_bed TARGET=100'))}>ABS</button>
          <button type="button" className="btn" onClick={() => runAction('Apply ASA preset', () => commands.runMacro('SET_HEATER_TEMPERATURE HEATER=extruder TARGET=255\nSET_HEATER_TEMPERATURE HEATER=heater_bed TARGET=105\nSET_HEATER_TEMPERATURE HEATER=chamber TARGET=45'))}>ASA</button>
        </div>
      </section>

      <section className="card">
        <div className="card-label">Sensor Health</div>
        <div className="card-title">Sensors</div>
        <div className="kv"><span>Toolhead Ambient</span><strong>{Math.round(temperatures.ambient)}°C</strong></div>
        <div className="kv"><span>Electronics Bay</span><strong>{Math.round(temperatures.controller)}°C</strong></div>
        <div className="kv"><span>Chamber Rear</span><strong>{Math.round(temperatures.raspberryPi)}°C</strong></div>
      </section>

      <BackButton to="/" />
    </Layout>
  );
}
