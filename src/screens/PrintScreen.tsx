import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Dialog } from '../components/Dialog';
import { BackButton, Layout } from '../components/Layout';
import { useCommands, usePrinterStore } from '../stores/usePrinterStore';
import { pct } from '../utils/format';

export function PrintScreen() {
  const commands = useCommands();
  const job = usePrinterStore((state) => state.job);
  const temperatures = usePrinterStore((state) => state.temperatures);
  const speedPercent = usePrinterStore((state) => state.speedPercent);
  const flowPercent = usePrinterStore((state) => state.flowPercent);
  const fanPartPercent = usePrinterStore((state) => state.fanPartPercent);
  const runAction = usePrinterStore((state) => state.runAction);
  const [confirmAction, setConfirmAction] = useState<'stop' | 'emergency' | null>(null);

  if (job.state !== 'printing' && job.state !== 'paused') {
    return <Navigate to="/files" replace />;
  }

  return (
    <Layout title="Active Print" subtitle={`Part: ${job.filename}`}>
      <section className="status-row">
        <article className="status-chip"><div className="k">Progress</div><div className="v">{pct(job.progress)}</div></article>
        <article className="status-chip"><div className="k">Layer</div><div className="v">{job.layer}</div></article>
        <article className="status-chip"><div className="k">ETA</div><div className="v">{job.eta}</div></article>
      </section>

      <section className="card">
        <div className="card-label">Current Job</div>
        <div className="media-thumb">
          <img src="/assets/printer-render.png" alt="Current print visualization" />
        </div>
      </section>

      <section className="card">
        <div className="card-label">Execution</div>
        <div className="card-title">Progress</div>
        <div className="kv"><span>Status</span><strong>{job.state}</strong></div>
        <div className="kv"><span>Completion</span><strong>{pct(job.progress)}</strong></div>
        <div className="kv"><span>Time Elapsed</span><strong>{job.elapsed}</strong></div>
        <div className="kv"><span>ETA</span><strong>{job.eta}</strong></div>
      </section>

      <section className="grid-2">
        <article className="card">
          <div className="card-label">Thermals</div>
          <div className="card-title">Temperatures</div>
          <div className="kv"><span>Hotend</span><strong>{Math.round(temperatures.nozzle.current)} / {Math.round(temperatures.nozzle.target)}°C</strong></div>
          <div className="kv"><span>Bed</span><strong>{Math.round(temperatures.bed.current)} / {Math.round(temperatures.bed.target)}°C</strong></div>
          <div className="kv"><span>Chamber</span><strong>{Math.round(temperatures.chamber.current)} / {Math.round(temperatures.chamber.target)}°C</strong></div>
        </article>
        <article className="card">
          <div className="card-label">Live Tuning</div>
          <div className="card-title">Tune</div>
          <div className="kv"><span>Speed</span><strong>{speedPercent}%</strong></div>
          <div className="kv"><span>Flow</span><strong>{flowPercent}%</strong></div>
          <div className="kv"><span>Part Fan</span><strong>{fanPartPercent}%</strong></div>
        </article>
      </section>

      <section className="card">
        <div className="card-label">Operator Controls</div>
        <div className="card-title">Actions</div>
        <div className="btn-row">
          <button
            type="button"
            className="btn accent"
            onClick={() => runAction('Pause Print', () => commands.pausePrint())}
          >
            Pause
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setConfirmAction('stop')}
          >
            Stop
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setConfirmAction('emergency')}
          >
            Emergency
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card-label">Fast Adjust</div>
        <div className="card-title">Quick Tune</div>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => runAction('Speed -10', () => commands.setPrintSpeed(speedPercent - 10))}>Speed -10</button>
          <button type="button" className="btn" onClick={() => runAction('Flow +5', () => commands.setFlow(flowPercent + 5))}>Flow +5</button>
          <button type="button" className="btn" onClick={() => runAction('Fan +10', () => commands.setFan(Math.min(100, fanPartPercent + 10), 'fan'))}>Fan +10</button>
        </div>
      </section>

      <BackButton to="/" />

      {confirmAction === 'stop' ? (
        <Dialog
          subtitle="Confirm Action"
          title="Stop the active print?"
          actions={[
            {
              label: 'Stop',
              variant: 'accent',
              onClick: () => {
                void runAction('Stop Print', () => commands.cancelPrint());
                setConfirmAction(null);
              },
            },
            { label: 'Cancel', onClick: () => setConfirmAction(null) },
          ]}
        />
      ) : null}

      {confirmAction === 'emergency' ? (
        <Dialog
          subtitle="Confirm Action"
          title="Send emergency M112 command?"
          actions={[
            {
              label: 'Send M112',
              variant: 'accent',
              onClick: () => {
                void runAction('Emergency Command', () => commands.runMacro('M112'));
                setConfirmAction(null);
              },
            },
            { label: 'Cancel', onClick: () => setConfirmAction(null) },
          ]}
        />
      ) : null}
    </Layout>
  );
}
