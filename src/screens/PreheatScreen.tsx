import { useMemo } from 'react';
import { HeaterKeypad, useHeaterKeypad, type HeaterKey } from '../components/HeaterKeypad';
import { Layout } from '../components/Layout';
import { useCommands, usePrinterStore } from '../stores/usePrinterStore';

const GRAPH_TOP = 20;
const GRAPH_BOTTOM = 140;
const GRAPH_LEFT = 34;
const GRAPH_RIGHT = 320;
const GRAPH_HEIGHT = GRAPH_BOTTOM - GRAPH_TOP;
const GRID_LINES = 5;

function line(series: number[], minTemp: number, maxTemp: number) {
  if (series.length === 0) return '';
  const span = Math.max(1, series.length - 1);
  const tempSpan = Math.max(1, maxTemp - minTemp);
  const points = series.map((value, index) => {
    const x = GRAPH_LEFT + (index / span) * (GRAPH_RIGHT - GRAPH_LEFT);
    const clamped = Math.min(maxTemp, Math.max(minTemp, value));
    const y = GRAPH_BOTTOM - ((clamped - minTemp) / tempSpan) * GRAPH_HEIGHT;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return points.join(' ');
}

export function PreheatScreen() {
  const commands = useCommands();
  const temperatures = usePrinterStore((state) => state.temperatures);
  const temperatureHistory = usePrinterStore((state) => state.temperatureHistory);
  const runAction = usePrinterStore((state) => state.runAction);
  const keypad = useHeaterKeypad();
  const targetMap = keypad.targets;

  const adjust = (heater: HeaterKey, delta: number) => {
    const currentTarget = targetMap[heater];
    const nextTarget = Math.max(0, Math.round(currentTarget + delta));
    void runAction(`Set ${heater}`, () => commands.setHeater(heater, nextTarget));
  };

  const sensorEntries = useMemo(() => {
    const reserved = new Set(['nozzle', 'extruder', 'bed', 'heater_bed', 'chamber', 'ambient', 'controller', 'raspberrypi']);
    return Object.entries(temperatures.sensors).filter(([name]) => {
      const normalized = name.toLowerCase().replace(/[_\s-]+/g, '');
      return !reserved.has(normalized);
    });
  }, [temperatures.sensors]);

  const graphScale = useMemo(() => {
    const allSeries = [
      temperatureHistory.nozzle ?? [temperatures.nozzle.current],
      temperatureHistory.bed ?? [temperatures.bed.current],
      temperatureHistory.chamber ?? [temperatures.chamber.current],
      temperatureHistory.ambient ?? [temperatures.ambient],
      temperatureHistory.controller ?? [temperatures.controller],
      temperatureHistory.raspberryPi ?? [temperatures.raspberryPi],
      ...sensorEntries.map(([name]) => temperatureHistory[name] ?? [temperatures.sensors[name].current]),
    ];

    const values = allSeries.flat().filter((value) => Number.isFinite(value));
    const minValue = values.length > 0 ? Math.min(...values) : 0;
    const maxValue = values.length > 0 ? Math.max(...values) : 50;
    const rawSpan = Math.max(5, maxValue - minValue);
    const padding = Math.max(2, rawSpan * 0.12);
    const minTemp = Math.max(0, Math.floor(minValue - padding));
    const maxTemp = Math.max(minTemp + 5, Math.ceil(maxValue + padding));

    const ticks = Array.from({ length: GRID_LINES }, (_, index) => {
      const t = index / (GRID_LINES - 1);
      const y = GRAPH_TOP + t * GRAPH_HEIGHT;
      const value = Math.round(maxTemp - t * (maxTemp - minTemp));
      return { y, value };
    });

    return { minTemp, maxTemp, ticks };
  }, [
    sensorEntries,
    temperatureHistory.ambient,
    temperatureHistory.bed,
    temperatureHistory.chamber,
    temperatureHistory.controller,
    temperatureHistory.nozzle,
    temperatureHistory.raspberryPi,
    temperatures.ambient,
    temperatures.bed.current,
    temperatures.chamber.current,
    temperatures.controller,
    temperatures.nozzle.current,
    temperatures.raspberryPi,
    temperatures.sensors,
  ]);

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

        <button type="button" className="kv temp-target-row button-reset" onClick={() => keypad.open('extruder')}><span>Nozzle</span><strong>{Math.round(temperatures.nozzle.current)} / {Math.round(temperatures.nozzle.target)}°C</strong></button>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => adjust('extruder', -5)}>-5°C</button>
          <button type="button" className="btn" onClick={() => adjust('extruder', -targetMap.extruder)}>Off</button>
          <button type="button" className="btn" onClick={() => adjust('extruder', 5)}>+5°C</button>
        </div>

        <div className="spacer" />
        <button type="button" className="kv temp-target-row button-reset" onClick={() => keypad.open('heater_bed')}><span>Bed</span><strong>{Math.round(temperatures.bed.current)} / {Math.round(temperatures.bed.target)}°C</strong></button>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => adjust('heater_bed', -5)}>-5°C</button>
          <button type="button" className="btn" onClick={() => adjust('heater_bed', -targetMap.heater_bed)}>Off</button>
          <button type="button" className="btn" onClick={() => adjust('heater_bed', 5)}>+5°C</button>
        </div>

        <div className="spacer" />
        <button type="button" className="kv temp-target-row button-reset" onClick={() => keypad.open('chamber')}><span>Chamber</span><strong>{Math.round(temperatures.chamber.current)} / {Math.round(temperatures.chamber.target)}°C</strong></button>
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
          <span><i className="dot pi"></i>Raspberry Pi</span>
          {sensorEntries.map(([name]) => (
            <span key={name}><i className="dot" style={{ background: 'var(--text-muted)' }}></i>{name}</span>
          ))}
        </div>

        <div className="temp-graph-wrap">
          <svg className="temp-graph" viewBox="0 0 320 150" preserveAspectRatio="none" aria-label="Temperature graph">
            <g className="grid">
              {graphScale.ticks.map((tick) => (
                <line key={`grid-${tick.y}`} x1={GRAPH_LEFT} y1={tick.y} x2={GRAPH_RIGHT} y2={tick.y}></line>
              ))}
            </g>
            <g>
              {graphScale.ticks.map((tick) => (
                <text key={`label-${tick.y}`} x={2} y={tick.y + 3} fill="var(--text-muted)" fontSize="9">
                  {tick.value}°
                </text>
              ))}
            </g>
            <polyline className="line nozzle" points={line(temperatureHistory.nozzle ?? [temperatures.nozzle.current], graphScale.minTemp, graphScale.maxTemp)}></polyline>
            <polyline className="line bed" points={line(temperatureHistory.bed ?? [temperatures.bed.current], graphScale.minTemp, graphScale.maxTemp)}></polyline>
            <polyline className="line chamber" points={line(temperatureHistory.chamber ?? [temperatures.chamber.current], graphScale.minTemp, graphScale.maxTemp)}></polyline>
            <polyline className="line ambient" points={line(temperatureHistory.ambient ?? [temperatures.ambient], graphScale.minTemp, graphScale.maxTemp)}></polyline>
            <polyline className="line pi" points={line(temperatureHistory.raspberryPi ?? [temperatures.raspberryPi], graphScale.minTemp, graphScale.maxTemp)}></polyline>
            {sensorEntries.map(([name]) => (
              <polyline
                key={name}
                className="line"
                points={line(temperatureHistory[name] ?? [temperatures.sensors[name].current], graphScale.minTemp, graphScale.maxTemp)}
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
        {sensorEntries.map(([name, values]) => (
          <div className="kv" key={name}><span>{name}</span><strong>{Math.round(values.current)} / {Math.round(values.target)}°C</strong></div>
        ))}
      </section>

      <HeaterKeypad keypad={keypad} />
    </Layout>
  );
}
