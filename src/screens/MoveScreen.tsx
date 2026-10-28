import { BackButton, Layout } from '../components/Layout';
import { useCommands, usePrinterStore } from '../stores/usePrinterStore';

export function MoveScreen() {
  const commands = useCommands();
  const position = usePrinterStore((state) => state.position);
  const fanPartPercent = usePrinterStore((state) => state.fanPartPercent);
  const fanChamberPercent = usePrinterStore((state) => state.fanChamberPercent);
  const runAction = usePrinterStore((state) => state.runAction);

  return (
    <Layout title="Move" subtitle="Jog + Homing + Fans">
      <section className="status-row">
        <article className="status-chip"><div className="k">Position X</div><div className="v">{position.x.toFixed(1)}</div></article>
        <article className="status-chip"><div className="k">Position Y</div><div className="v">{position.y.toFixed(1)}</div></article>
        <article className="status-chip"><div className="k">Position Z</div><div className="v">{position.z.toFixed(2)}</div></article>
      </section>

      <section className="card">
        <div className="card-label">Machine Prep</div>
        <div className="card-title">Homing</div>
        <div className="btn-row">
          <button type="button" className="btn accent" onClick={() => runAction('Home All', () => commands.home('xyz'))}>Home All</button>
          <button type="button" className="btn" onClick={() => runAction('Home XY', () => commands.home('xy'))}>Home XY</button>
          <button type="button" className="btn" onClick={() => runAction('Home Z', () => commands.home('z'))}>Home Z</button>
        </div>
      </section>

      <section className="card">
        <div className="card-label">Axis Controls</div>
        <div className="card-title">Jog Axes</div>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => runAction('Jog X-', () => commands.jog('X', -1))}>X-</button>
          <button type="button" className="btn" onClick={() => runAction('Jog Y+', () => commands.jog('Y', 1))}>Y+</button>
          <button type="button" className="btn" onClick={() => runAction('Jog X+', () => commands.jog('X', 1))}>X+</button>
        </div>
        <div className="spacer" />
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => runAction('Jog Z+', () => commands.jog('Z', 0.2))}>Z+</button>
          <button type="button" className="btn" onClick={() => runAction('Jog Y-', () => commands.jog('Y', -1))}>Y-</button>
          <button type="button" className="btn" onClick={() => runAction('Jog Z-', () => commands.jog('Z', -0.2))}>Z-</button>
        </div>
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
        <div className="kv"><span>Chamber Fan</span><strong>{fanChamberPercent}%</strong></div>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => runAction('Chamber fan -10%', () => commands.setFan(fanChamberPercent - 10, 'chamber_fan'))}>-10%</button>
          <button type="button" className="btn" onClick={() => runAction('Chamber fan off', () => commands.setFan(0, 'chamber_fan'))}>Off</button>
          <button type="button" className="btn" onClick={() => runAction('Chamber fan +10%', () => commands.setFan(fanChamberPercent + 10, 'chamber_fan'))}>+10%</button>
        </div>
      </section>

      <BackButton to="/settings" />
    </Layout>
  );
}
