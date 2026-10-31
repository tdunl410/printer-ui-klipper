import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import arrowDownIcon from '../../assets/arrow-down.svg';
import arrowUpIcon from '../../assets/arrow-up.svg';
import pauseIcon from '../../assets/pause.svg';
import resumeIcon from '../../assets/resume.svg';
import { Dialog } from '../components/Dialog';
import { Layout } from '../components/Layout';
import { useCommands, usePrinterStore } from '../stores/usePrinterStore';
import { pct } from '../utils/format';
import { fetchThumbnailUrl } from '../utils/thumbnail';

const Z_STEPS = [0.01, 0.05, 0.1] as const;
const PCT_STEPS = [1, 5, 10, 25] as const;

export function PrintScreen() {
  const commands = useCommands();
  const job = usePrinterStore((state) => state.job);
  const temperatures = usePrinterStore((state) => state.temperatures);
  const speedPercent = usePrinterStore((state) => state.speedPercent);
  const flowPercent = usePrinterStore((state) => state.flowPercent);
  const fanPartPercent = usePrinterStore((state) => state.fanPartPercent);
  const runAction = usePrinterStore((state) => state.runAction);
  const [zStep, setZStep] = useState<(typeof Z_STEPS)[number]>(0.01);
  const [pctStep, setPctStep] = useState<(typeof PCT_STEPS)[number]>(5);
  const zOffset = usePrinterStore((state) => state.zOffset);
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

  if (job.state !== 'printing' && job.state !== 'paused') {
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
        <div className="media-thumb print-media-thumb">
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt={`${job.filename} preview`} />
          ) : (
            <div className="file-thumb-placeholder">No Preview</div>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-label">Progress</div>
        <div className="kv"><span>Time Elapsed</span><strong>{job.elapsed}</strong></div>
        <div className="kv"><span>Time Remaining</span><strong>{remainingLabel}</strong></div>
        <div className="kv"><span>Speed</span><strong>{speedPercent}%</strong></div>
        <div className="kv"><span>Flow</span><strong>{flowPercent}%</strong></div>
      </section>

      <article className="card">
        <div className="card-label">Temperatures</div>
        <div className="kv"><span>Hotend</span><strong>{Math.round(temperatures.nozzle.current)} / {Math.round(temperatures.nozzle.target)}°C</strong></div>
        <div className="kv"><span>Bed</span><strong>{Math.round(temperatures.bed.current)} / {Math.round(temperatures.bed.target)}°C</strong></div>
        <div className="kv"><span>Chamber</span><strong>{Math.round(temperatures.chamber.current)} / {Math.round(temperatures.chamber.target)}°C</strong></div>
      </article>

      <section className="card">
        <div className="card-label">Actions</div>
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
        </div>
      </section>

      <section className="card">
        <div className="card-label">Fine Tune</div>
        <div className="card-title">Live Adjust</div>
        <div className="tune-grid">
          <button type="button" className="tune-btn tune-reset" onClick={() => runAction('Reset Z offset', () => commands.resetZOffset())}>
            <span className="tune-value">{zOffset.toFixed(2)}mm</span>
            <span className="tune-sub">Z Offset · reset</span>
          </button>
          <button type="button" className="tune-btn tune-reset" onClick={() => runAction('Reset speed', () => commands.setPrintSpeed(100))}>
            <span className="tune-value">{speedPercent}%</span>
            <span className="tune-sub">Speed · reset</span>
          </button>
          <button type="button" className="tune-btn tune-reset" onClick={() => runAction('Reset flow', () => commands.setFlow(100))}>
            <span className="tune-value">{flowPercent}%</span>
            <span className="tune-sub">Flow · reset</span>
          </button>

          <button type="button" className="tune-btn" onClick={() => runAction('Z offset up', () => commands.adjustZOffset(zStep))}>
            <img className="tune-icon" src={arrowUpIcon} alt="" aria-hidden="true" />
            <span>Z+</span>
          </button>
          <button type="button" className="tune-btn" onClick={() => runAction('Speed up', () => commands.setPrintSpeed(speedPercent + pctStep))}>
            <img className="tune-icon" src={arrowUpIcon} alt="" aria-hidden="true" />
            <span>Speed +</span>
          </button>
          <button type="button" className="tune-btn" onClick={() => runAction('Flow up', () => commands.setFlow(flowPercent + pctStep))}>
            <img className="tune-icon" src={arrowUpIcon} alt="" aria-hidden="true" />
            <span>Flow +</span>
          </button>

          <button type="button" className="tune-btn" onClick={() => runAction('Z offset down', () => commands.adjustZOffset(-zStep))}>
            <img className="tune-icon" src={arrowDownIcon} alt="" aria-hidden="true" />
            <span>Z-</span>
          </button>
          <button type="button" className="tune-btn" onClick={() => runAction('Speed down', () => commands.setPrintSpeed(speedPercent - pctStep))}>
            <img className="tune-icon" src={arrowDownIcon} alt="" aria-hidden="true" />
            <span>Speed -</span>
          </button>
          <button type="button" className="tune-btn" onClick={() => runAction('Flow down', () => commands.setFlow(flowPercent - pctStep))}>
            <img className="tune-icon" src={arrowDownIcon} alt="" aria-hidden="true" />
            <span>Flow -</span>
          </button>
        </div>

        <div className="tune-steps">
          <div className="tune-step-group">
            {Z_STEPS.map((step) => (
              <button type="button" key={step} className={`tune-step ${zStep === step ? 'active' : ''}`} onClick={() => setZStep(step)}>{step}</button>
            ))}
          </div>
          <div className="tune-step-group">
            {PCT_STEPS.map((step) => (
              <button type="button" key={step} className={`tune-step ${pctStep === step ? 'active' : ''}`} onClick={() => setPctStep(step)}>{step}%</button>
            ))}
          </div>
        </div>

        <div className="kv top-gap"><span>Part Fan</span><strong>{fanPartPercent}%</strong></div>
        <div className="btn-row two">
          <button type="button" className="btn" onClick={() => runAction('Fan down', () => commands.setFan(Math.max(0, fanPartPercent - pctStep), 'fan'))}>Fan -{pctStep}%</button>
          <button type="button" className="btn" onClick={() => runAction('Fan up', () => commands.setFan(Math.min(100, fanPartPercent + pctStep), 'fan'))}>Fan +{pctStep}%</button>
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
