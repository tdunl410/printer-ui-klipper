import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import emergencyIcon from '../../assets/emergency.svg';
import pauseIcon from '../../assets/pause.svg';
import resumeIcon from '../../assets/resume.svg';
import { Dialog } from '../components/Dialog';
import { Layout } from '../components/Layout';
import { useCommands, usePrinterStore } from '../stores/usePrinterStore';
import { pct } from '../utils/format';
import { fetchThumbnailUrl } from '../utils/thumbnail';

export function PrintScreen() {
  const commands = useCommands();
  const job = usePrinterStore((state) => state.job);
  const temperatures = usePrinterStore((state) => state.temperatures);
  const speedPercent = usePrinterStore((state) => state.speedPercent);
  const flowPercent = usePrinterStore((state) => state.flowPercent);
  const fanPartPercent = usePrinterStore((state) => state.fanPartPercent);
  const runAction = usePrinterStore((state) => state.runAction);
  const [confirmAction, setConfirmAction] = useState<'stop' | 'emergency' | null>(null);
  const connection = usePrinterStore((state) => state.connection);
  const [thumbnailUrl, setThumbnailUrl] = useState<string>();
  const isPaused = job.state === 'paused';

  useEffect(() => {
    if (!job.filename) return;
    let cancelled = false;
    void fetchThumbnailUrl(connection.moonrakerBaseUrl, job.filename).then((url) => {
      if (!cancelled) setThumbnailUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [connection.moonrakerBaseUrl, job.filename]);

  if (job.state !== 'printing' && job.state !== 'paused' && job.state !== 'shutdown' && job.state !== 'startup') {
    return <Navigate to="/files" replace />;
  }

  const remainingLabel = job.remaining || job.eta || '00:00';

  return (
    <Layout title="Active Print" subtitle={`Part: ${job.filename}`}>
      <section className="card">
        <div className="card-label">Time Remaining</div>
        <div className="card-title">{remainingLabel}</div>
        <div
          className="progress-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(job.progress * 100)}
        >
          <div className="progress-fill" style={{ width: pct(Math.min(1, Math.max(0, job.progress))) }} />
        </div>
        <div className="kv"><span>{pct(job.progress)} complete</span><strong>ETA {job.eta}</strong></div>
      </section>

      <section className="card">
        <div className="card-label">Current Job</div>
        <div className="media-thumb">
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt={`${job.filename} preview`} />
          ) : (
            <div className="file-thumb-placeholder">No Preview</div>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-label">Execution</div>
        <div className="card-title">Progress</div>
        <div className="kv"><span>Status</span><strong>{job.state}</strong></div>
        <div className="kv"><span>Completion</span><strong>{pct(job.progress)}</strong></div>
        <div className="kv"><span>Time Elapsed</span><strong>{job.elapsed}</strong></div>
        <div className="kv"><span>ETA</span><strong>{job.eta}</strong></div>
        <div className="kv"><span>Time Remaining</span><strong>{remainingLabel}</strong></div>
        <div className="kv"><span>Speed</span><strong>{speedPercent}%</strong></div>
        <div className="kv"><span>Flow</span><strong>{flowPercent}%</strong></div>
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
          <div className="kv"><span>Layer</span><strong>{job.layer}</strong></div>
        </article>
      </section>

      <section className="card">
        <div className="card-label">Operator Controls</div>
        <div className="card-title">Actions</div>
        <div className="btn-row">
          <button
            type="button"
            className="btn accent with-icon"
            onClick={() => runAction(isPaused ? 'Resume Print' : 'Pause Print', () => (isPaused ? commands.resumePrint() : commands.pausePrint()))}
          >
            <img className="button-icon" src={isPaused ? resumeIcon : pauseIcon} alt="" aria-hidden="true" />
            {isPaused ? 'Resume' : 'Pause'}
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
            className="btn with-icon"
            onClick={() => setConfirmAction('emergency')}
          >
            <img className="button-icon" src={emergencyIcon} alt="" aria-hidden="true" />
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
          title="Emergency stop? This shuts down Klipper immediately."
          actions={[
            {
              label: 'Emergency Stop',
              variant: 'accent',
              onClick: () => {
                void runAction('Emergency Command', () => commands.emergencyStop());
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
