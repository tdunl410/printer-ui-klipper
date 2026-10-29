import { useState } from 'react';
import arrowDown from '../../assets/arrow-down.svg';
import arrowLeft from '../../assets/arrow-left.svg';
import arrowRight from '../../assets/arrow-right.svg';
import arrowUp from '../../assets/arrow-up.svg';
import homeIcon from '../../assets/home.svg';
import { useCommands, usePrinterStore } from '../stores/usePrinterStore';

const RING_OUTER = 96;
const RING_INNER = 54;
const GAP_DEG = 3;
const polar = (radius: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return [100 + radius * Math.cos(rad), 100 + radius * Math.sin(rad)] as const;
};

// Annular wedge centred on `centerDeg` (0° = right, 90° = down in SVG space)
const wedge = (centerDeg: number) => {
  const start = centerDeg - 45 + GAP_DEG;
  const end = centerDeg + 45 - GAP_DEG;
  const [ox1, oy1] = polar(RING_OUTER, start);
  const [ox2, oy2] = polar(RING_OUTER, end);
  const [ix1, iy1] = polar(RING_INNER, end);
  const [ix2, iy2] = polar(RING_INNER, start);
  return `M${ox1} ${oy1} A${RING_OUTER} ${RING_OUTER} 0 0 1 ${ox2} ${oy2} L${ix1} ${iy1} A${RING_INNER} ${RING_INNER} 0 0 0 ${ix2} ${iy2} Z`;
};

const segmentDef = (label: string, axis: 'X' | 'Y', sign: 1 | -1, centerDeg: number, icon: string) => {
  const [iconX, iconY] = polar((RING_OUTER + RING_INNER) / 2, centerDeg);
  return { label, axis, sign, icon, path: wedge(centerDeg), iconX, iconY };
};

const jogSegments = [
  segmentDef('Y+', 'Y', 1, -90, arrowUp),
  segmentDef('X+', 'X', 1, 0, arrowRight),
  segmentDef('Y-', 'Y', -1, 90, arrowDown),
  segmentDef('X-', 'X', -1, 180, arrowLeft),
];

export function MoveControls() {
  const commands = useCommands();
  const position = usePrinterStore((state) => state.position);
  const fanPartPercent = usePrinterStore((state) => state.fanPartPercent);
  const fanChamberPercent = usePrinterStore((state) => state.fanChamberPercent);
  const runAction = usePrinterStore((state) => state.runAction);
  const [moveDistance, setMoveDistance] = useState(10);
  const distanceOptions = [5, 10, 25, 50];

  return (
    <>
      <section className="status-row">
        <article className="status-chip"><div className="k">Position X</div><div className="v">{position.x.toFixed(1)}</div></article>
        <article className="status-chip"><div className="k">Position Y</div><div className="v">{position.y.toFixed(1)}</div></article>
        <article className="status-chip"><div className="k">Position Z</div><div className="v">{position.z.toFixed(2)}</div></article>
      </section>

      <section className="card">
        <div className="card-label">Homing</div>
        <div className="btn-row">
          <button type="button" className="btn accent with-icon" onClick={() => runAction('Home All', () => commands.home('xyz'))}>
            <img className="button-icon" src={homeIcon} alt="" aria-hidden="true" />
            All
          </button>
          <button type="button" className="btn with-icon" onClick={() => runAction('Home XY', () => commands.home('xy'))}>
            <img className="button-icon" src={homeIcon} alt="" aria-hidden="true" />
            XY
          </button>
          <button type="button" className="btn with-icon" onClick={() => runAction('Home Z', () => commands.home('z'))}>
            <img className="button-icon" src={homeIcon} alt="" aria-hidden="true" />
            Z
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card-label">Axis Controls</div>
        <div className="btn-row four">
          {distanceOptions.map((distance) => (
            <button
              key={distance}
              type="button"
              className={`btn ${moveDistance === distance ? 'accent' : ''}`}
              onClick={() => setMoveDistance(distance)}
            >
              {distance}mm
            </button>
          ))}
        </div>
        <div className="spacer" />
        <div className="move-controls">
          <svg className="jog-ring" viewBox="0 0 200 200" role="group" aria-label="XY move controls">
            {jogSegments.map((segment) => (
              <g
                key={segment.label}
                className="jog-segment"
                role="button"
                tabIndex={0}
                aria-label={segment.label}
                onClick={() => runAction(`Jog ${segment.label} ${moveDistance}mm`, () => commands.jog(segment.axis, segment.sign * moveDistance))}
              >
                <path d={segment.path} />
                <image href={segment.icon} x={segment.iconX - 11} y={segment.iconY - 11} width="22" height="22" />
              </g>
            ))}
            <circle className="jog-inner-ring" cx="100" cy="100" r="46" />
            <g className="jog-home" role="button" tabIndex={0} aria-label="Home XY" onClick={() => runAction('Home XY', () => commands.home('xy'))}>
              <circle cx="100" cy="100" r="34" />
              <image href={homeIcon} x="86" y="86" width="28" height="28" />
            </g>
          </svg>
          <div className="z-controls" aria-label="Z move controls">
            <button type="button" className="btn z-btn with-icon" onClick={() => runAction(`Jog Z+ ${moveDistance}mm`, () => commands.jog('Z', moveDistance))}><img className="button-icon" src={arrowUp} alt="" />Z+</button>
            <button type="button" className="btn z-btn with-icon" onClick={() => runAction(`Jog Z- ${moveDistance}mm`, () => commands.jog('Z', -moveDistance))}><img className="button-icon" src={arrowDown} alt="" />Z-</button>
          </div>
        </div>
        <div className="spacer" />
        <button type="button" className="btn" onClick={() => runAction('Disable Motors', () => commands.disableMotors())}>Disable Motors</button>
      </section>

      <section className="card">
        <div className="card-label">Cooling</div>
        <div className="card-title">Fan Speeds</div>
        <div className="kv"><span>Part Fan</span><strong>{fanPartPercent}%</strong></div>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => runAction('Part fan -10%', () => commands.setFan(fanPartPercent - 10, 'fan'))}>-10%</button>
          <button type="button" className="btn" onClick={() => runAction('Part fan off', () => commands.setFan(0, 'fan'))}>Off</button>
          <button type="button" className="btn" onClick={() => runAction('Part fan +10%', () => commands.setFan(fanPartPercent + 10, 'fan'))}>+10%</button>
        </div>
        <div className="spacer" />
        <div className="kv"><span>Aux Fan</span><strong>{fanChamberPercent}%</strong></div>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => runAction('Aux fan -10%', () => commands.setFan(fanChamberPercent - 10, 'aux_fan'))}>-10%</button>
          <button type="button" className="btn" onClick={() => runAction('Aux fan off', () => commands.setFan(0, 'aux_fan'))}>Off</button>
          <button type="button" className="btn" onClick={() => runAction('Aux fan +10%', () => commands.setFan(fanChamberPercent + 10, 'aux_fan'))}>+10%</button>
        </div>
      </section>
    </>
  );
}
