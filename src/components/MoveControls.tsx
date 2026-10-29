import { useState } from 'react';
import arrowDown from '../../assets/arrow-down.svg';
import arrowLeft from '../../assets/arrow-left.svg';
import arrowRight from '../../assets/arrow-right.svg';
import arrowUp from '../../assets/arrow-up.svg';
import homeIcon from '../../assets/home.svg';
import { useCommands, usePrinterStore } from '../stores/usePrinterStore';

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
        <div className="card-label">Machine Prep</div>
        <div className="card-title">Homing</div>
        <div className="btn-row">
          <button type="button" className="btn accent with-icon" onClick={() => runAction('Home All', () => commands.home('xyz'))}>
            <img className="button-icon" src={homeIcon} alt="" aria-hidden="true" />
            Home All
          </button>
          <button type="button" className="btn with-icon" onClick={() => runAction('Home XY', () => commands.home('xy'))}>
            <img className="button-icon" src={homeIcon} alt="" aria-hidden="true" />
            Home XY
          </button>
          <button type="button" className="btn with-icon" onClick={() => runAction('Home Z', () => commands.home('z'))}>
            <img className="button-icon" src={homeIcon} alt="" aria-hidden="true" />
            Home Z
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card-label">Axis Controls</div>
        <div className="card-title">Jog Axes</div>
        <div className="kv"><span>Move Distance</span><strong>{moveDistance} mm</strong></div>
        <div className="btn-row">
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
          <div className="move-pad" aria-label="XY move controls">
            <button type="button" className="btn move-pad-btn up with-icon" onClick={() => runAction(`Jog Y+ ${moveDistance}mm`, () => commands.jog('Y', moveDistance))}><img className="button-icon" src={arrowUp} alt="" />Y+</button>
            <button type="button" className="btn move-pad-btn left with-icon" onClick={() => runAction(`Jog X- ${moveDistance}mm`, () => commands.jog('X', -moveDistance))}><img className="button-icon" src={arrowLeft} alt="" />X-</button>
            <button type="button" className="btn move-pad-btn right with-icon" onClick={() => runAction(`Jog X+ ${moveDistance}mm`, () => commands.jog('X', moveDistance))}><img className="button-icon" src={arrowRight} alt="" />X+</button>
            <button type="button" className="btn move-pad-btn down with-icon" onClick={() => runAction(`Jog Y- ${moveDistance}mm`, () => commands.jog('Y', -moveDistance))}><img className="button-icon" src={arrowDown} alt="" />Y-</button>
            <button type="button" className="btn accent move-pad-home with-icon" onClick={() => runAction('Home XY', () => commands.home('xy'))}>
              <img className="button-icon" src={homeIcon} alt="" aria-hidden="true" />
              Home
            </button>
          </div>
          <div className="z-controls" aria-label="Z move controls">
            <button type="button" className="btn with-icon" onClick={() => runAction(`Jog Z+ ${moveDistance}mm`, () => commands.jog('Z', moveDistance))}><img className="button-icon" src={arrowUp} alt="" />Z+</button>
            <button type="button" className="btn with-icon" onClick={() => runAction(`Jog Z- ${moveDistance}mm`, () => commands.jog('Z', -moveDistance))}><img className="button-icon" src={arrowDown} alt="" />Z-</button>
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
