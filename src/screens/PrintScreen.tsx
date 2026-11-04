import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import arrowDownIcon from '../../assets/arrow-down.svg';
import arrowUpIcon from '../../assets/arrow-up.svg';
import pauseIcon from '../../assets/pause.svg';
import resumeIcon from '../../assets/resume.svg';
import stopSquareIcon from '../../assets/stop-square.svg';
import { Dialog } from '../components/Dialog';
import { Layout } from '../components/Layout';
import { useCommands, usePrinterStore } from '../stores/usePrinterStore';
import { pct } from '../utils/format';
import { fetchThumbnailUrl } from '../utils/thumbnail';

const Z_STEPS = [0.01, 0.05, 0.1] as const;
const PCT_STEPS = [1, 5, 10, 25] as const;
const EXCLUDE_VIEW_WIDTH = 320;
const EXCLUDE_VIEW_HEIGHT = 220;
const EXCLUDE_VIEW_PADDING = 12;

type PlateBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

const defaultBounds: PlateBounds = {
  minX: 0,
  minY: 0,
  maxX: 220,
  maxY: 220,
};

const computePlateBounds = (objects: { polygon: [number, number][] }[]): PlateBounds => {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  objects.forEach((item) => {
    item.polygon.forEach(([x, y]) => {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    });
  });

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return defaultBounds;
  }

  if (Math.abs(maxX - minX) < 0.001) {
    minX -= 1;
    maxX += 1;
  }

  if (Math.abs(maxY - minY) < 0.001) {
    minY -= 1;
    maxY += 1;
  }

  return { minX, minY, maxX, maxY };
};

const projectPolygon = (polygon: [number, number][], bounds: PlateBounds) => {
  const width = EXCLUDE_VIEW_WIDTH - EXCLUDE_VIEW_PADDING * 2;
  const height = EXCLUDE_VIEW_HEIGHT - EXCLUDE_VIEW_PADDING * 2;
  const scaleX = width / (bounds.maxX - bounds.minX);
  const scaleY = height / (bounds.maxY - bounds.minY);
  const scale = Math.min(scaleX, scaleY);
  const xOffset = (EXCLUDE_VIEW_WIDTH - (bounds.maxX - bounds.minX) * scale) / 2;
  const yOffset = (EXCLUDE_VIEW_HEIGHT - (bounds.maxY - bounds.minY) * scale) / 2;

  return polygon
    .map(([x, y]) => {
      const px = xOffset + (x - bounds.minX) * scale;
      const py = EXCLUDE_VIEW_HEIGHT - (yOffset + (y - bounds.minY) * scale);
      return `${px.toFixed(2)},${py.toFixed(2)}`;
    })
    .join(' ');
};

export function PrintScreen() {
  const commands = useCommands();
  const job = usePrinterStore((state) => state.job);
  const temperatures = usePrinterStore((state) => state.temperatures);
  const printerSpeedMmS = usePrinterStore((state) => state.printerSpeedMmS);
  const speedPercent = usePrinterStore((state) => state.speedPercent);
  const flowPercent = usePrinterStore((state) => state.flowPercent);
  const fanPartPercent = usePrinterStore((state) => state.fanPartPercent);
  const runAction = usePrinterStore((state) => state.runAction);
  const [zStep, setZStep] = useState<(typeof Z_STEPS)[number]>(0.01);
  const [pctStep, setPctStep] = useState<(typeof PCT_STEPS)[number]>(5);
  const zOffset = usePrinterStore((state) => state.zOffset);
  const [confirmAction, setConfirmAction] = useState<'stop' | 'emergency' | null>(null);
  const connection = usePrinterStore((state) => state.connection);
  const excludeObjects = usePrinterStore((state) => state.excludeObjects);
  const [thumbnailUrl, setThumbnailUrl] = useState<string>();
  const [showExcludeDialog, setShowExcludeDialog] = useState(false);
  const [selectedExcludeObjects, setSelectedExcludeObjects] = useState<string[]>([]);
  const isPaused = job.state === 'paused';
  const plateBounds = useMemo(() => computePlateBounds(excludeObjects.objects), [excludeObjects.objects]);
  const availableObjects = useMemo(
    () => excludeObjects.objects.filter((item) => !item.isExcluded),
    [excludeObjects.objects],
  );
  const drawableObjects = useMemo(
    () => excludeObjects.objects.filter((item) => item.polygon.length > 1),
    [excludeObjects.objects],
  );
  const availableObjectNames = useMemo(
    () => new Set(availableObjects.map((item) => item.name)),
    [availableObjects],
  );

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

  useEffect(() => {
    setSelectedExcludeObjects((current) => {
      const next = current.filter((name) => availableObjectNames.has(name));
      if (next.length === current.length && next.every((name, index) => name === current[index])) {
        return current;
      }
      return next;
    });
  }, [availableObjectNames]);

  if (job.state !== 'printing' && job.state !== 'paused') {
    return <Navigate to="/files" replace />;
  }

  const remainingLabel = job.remaining || job.eta || '00:00';
  const currentSpeedLabel = Number.isFinite(printerSpeedMmS) ? `${printerSpeedMmS.toFixed(1)} mm/s` : '-- mm/s';

  const toggleExcludeObject = (name: string, disabled: boolean) => {
    if (disabled) return;
    setSelectedExcludeObjects((current) => (
      current.includes(name)
        ? current.filter((entry) => entry !== name)
        : [...current, name]
    ));
  };

  return (
    <Layout title="Active Print" subtitle={`Part: ${job.filename}`}>
      <div className="print-columns">
        <div className="print-column print-column-left">
          <section className="card print-time-card">
            <div className="card-label">Time Remaining</div>
            <div className="card-title">{remainingLabel}</div>
            <div
              className="progress-bar print-time-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(job.progress * 100)}
            >
              <div className="progress-fill" style={{ width: pct(Math.min(1, Math.max(0, job.progress))) }} />
            </div>
            <div className="kv"><span>{pct(job.progress)} complete</span><strong>ETA {job.eta}</strong></div>
          </section>

          <section className="card print-thumb-card">
            <div className="card-label">Current Job</div>
            <div className="media-thumb print-media-thumb">
              {thumbnailUrl ? (
                <img src={thumbnailUrl} alt={`${job.filename} preview`} />
              ) : (
                <div className="file-thumb-placeholder">No Preview</div>
              )}
            </div>
          </section>
        </div>

        <div className="print-column print-column-right">
          <section className="card print-progress-card">
            <div className="card-label">Progress</div>
            <div className="kv"><span>Time Elapsed</span><strong>{job.elapsed}</strong></div>
            <div className="kv"><span>Time Remaining</span><strong>{remainingLabel}</strong></div>
            <div className="kv"><span>Speed</span><strong>{currentSpeedLabel}</strong></div>
            <div className="kv"><span>Flow</span><strong>{flowPercent}%</strong></div>
          </section>

          <article className="card print-temps-card">
            <div className="card-label">Temperatures</div>
            <div className="kv"><span>Hotend</span><strong>{Math.round(temperatures.nozzle.current)} / {Math.round(temperatures.nozzle.target)}°C</strong></div>
            <div className="kv"><span>Bed</span><strong>{Math.round(temperatures.bed.current)} / {Math.round(temperatures.bed.target)}°C</strong></div>
            <div className="kv"><span>Chamber</span><strong>{Math.round(temperatures.chamber.current)} / {Math.round(temperatures.chamber.target)}°C</strong></div>
          </article>

          <section className="card print-actions-card">
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
                className="btn with-icon"
                onClick={() => setConfirmAction('stop')}
              >
                <img className="button-icon" src={stopSquareIcon} alt="" aria-hidden="true" />
                Stop
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setSelectedExcludeObjects([]);
                  setShowExcludeDialog(true);
                }}
                disabled={availableObjects.length === 0}
              >
                Exclude Object
              </button>
            </div>
          </section>

          <section className="card print-finetune-card">
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
            <div className="fan-slider-row">
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                className="fan-slider"
                aria-label="Part fan speed"
                value={Math.round(fanPartPercent)}
                onChange={(event) => {
                  const nextPercent = Number(event.currentTarget.value);
                  void runAction(`Set fan ${nextPercent}%`, () => commands.setFan(nextPercent, 'fan'));
                }}
              />
              <button
                type="button"
                className="btn"
                onClick={() => runAction('Fan off', () => commands.setFan(0, 'fan'))}
              >
                OFF
              </button>
            </div>
          </section>
        </div>
      </div>

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

      {showExcludeDialog ? (
        <Dialog
          subtitle="Exclude Object"
          title=""
          actions={[
            {
              label: 'Exclude',
              variant: 'accent',
              disabled: selectedExcludeObjects.length === 0,
              onClick: () => {
                const names = selectedExcludeObjects;
                setShowExcludeDialog(false);
                setSelectedExcludeObjects([]);
                void runAction(
                  `Exclude ${names.length} object${names.length === 1 ? '' : 's'}`,
                  () => commands.excludeObjects(names),
                );
              },
            },
            {
              label: 'Close',
              onClick: () => {
                setShowExcludeDialog(false);
                setSelectedExcludeObjects([]);
              },
            },
          ]}
        >
          <div className="exclude-dialog-content">
            <div className="exclude-plate-wrap">
              {drawableObjects.length > 0 ? (
                <svg
                  className="exclude-plate"
                  viewBox={`0 0 ${EXCLUDE_VIEW_WIDTH} ${EXCLUDE_VIEW_HEIGHT}`}
                  role="img"
                  aria-label="Top-down view of current build plate"
                >
                  <defs>
                    <pattern id="exclude-plate-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                      <path d="M 24 0 L 0 0 0 24" className="exclude-grid-line" />
                    </pattern>
                  </defs>
                  <rect x="0" y="0" width={EXCLUDE_VIEW_WIDTH} height={EXCLUDE_VIEW_HEIGHT} className="exclude-plate-bg" />
                  <rect x="0" y="0" width={EXCLUDE_VIEW_WIDTH} height={EXCLUDE_VIEW_HEIGHT} fill="url(#exclude-plate-grid)" />
                  {excludeObjects.objects.map((item) => {
                    if (item.polygon.length < 2) return null;
                    const isSelected = selectedExcludeObjects.includes(item.name);
                    const isCurrent = excludeObjects.currentObject === item.name;
                    return (
                      <polygon
                        key={item.name}
                        points={projectPolygon(item.polygon, plateBounds)}
                        className={`exclude-polygon ${isCurrent ? 'current' : ''} ${isSelected ? 'selected' : ''} ${item.isExcluded ? 'excluded' : ''}`}
                        onClick={() => toggleExcludeObject(item.name, item.isExcluded)}
                      />
                    );
                  })}
                </svg>
              ) : (
                <div className="exclude-empty">No object outlines available for this print.</div>
              )}
            </div>

          </div>
        </Dialog>
      ) : null}
    </Layout>
  );
}
