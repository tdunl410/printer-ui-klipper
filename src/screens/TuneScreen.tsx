import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import arrowDownIcon from '../../assets/arrow-down.png';
import arrowUpIcon from '../../assets/arrow-up.png';
import { CoolingControls } from '../components/CoolingControls';
import { Layout } from '../components/Layout';
import { MotionTuneControls } from '../components/MotionTuneControls';
import { useCommands, usePrinterStore } from '../stores/usePrinterStore';

const Z_STEPS = [0.01, 0.05, 0.1] as const;
const PCT_STEPS = [1, 5, 10, 25] as const;

export function TuneScreen() {
  const commands = useCommands();
  const job = usePrinterStore((state) => state.job);
  const zOffset = usePrinterStore((state) => state.zOffset);
  const speedPercent = usePrinterStore((state) => state.speedPercent);
  const flowPercent = usePrinterStore((state) => state.flowPercent);
  const runAction = usePrinterStore((state) => state.runAction);
  const [zStep, setZStep] = useState<(typeof Z_STEPS)[number]>(0.01);
  const [pctStep, setPctStep] = useState<(typeof PCT_STEPS)[number]>(5);

  if (job.state !== 'printing' && job.state !== 'paused') {
    return <Navigate to="/files" replace />;
  }

  return (
    <Layout title="Live Tune" subtitle={`Part: ${job.filename}`} hideMenuBar>
      <div className="live-tune-columns">
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
              <img className="tune-icon" src={arrowUpIcon} alt="" aria-hidden="true" /><span>Z+</span>
            </button>
            <button type="button" className="tune-btn" onClick={() => runAction('Speed up', () => commands.setPrintSpeed(speedPercent + pctStep))}>
              <img className="tune-icon" src={arrowUpIcon} alt="" aria-hidden="true" /><span>Speed +</span>
            </button>
            <button type="button" className="tune-btn" onClick={() => runAction('Flow up', () => commands.setFlow(flowPercent + pctStep))}>
              <img className="tune-icon" src={arrowUpIcon} alt="" aria-hidden="true" /><span>Flow +</span>
            </button>
            <button type="button" className="tune-btn" onClick={() => runAction('Z offset down', () => commands.adjustZOffset(-zStep))}>
              <img className="tune-icon" src={arrowDownIcon} alt="" aria-hidden="true" /><span>Z-</span>
            </button>
            <button type="button" className="tune-btn" onClick={() => runAction('Speed down', () => commands.setPrintSpeed(speedPercent - pctStep))}>
              <img className="tune-icon" src={arrowDownIcon} alt="" aria-hidden="true" /><span>Speed -</span>
            </button>
            <button type="button" className="tune-btn" onClick={() => runAction('Flow down', () => commands.setFlow(flowPercent - pctStep))}>
              <img className="tune-icon" src={arrowDownIcon} alt="" aria-hidden="true" /><span>Flow -</span>
            </button>
          </div>
          <div className="tune-steps">
            <div className="tune-step-group" role="group" aria-label="Z offset step in millimeters">
              {Z_STEPS.map((step) => (
                <button type="button" key={step} className={`tune-step ${zStep === step ? 'active' : ''}`} aria-pressed={zStep === step} onClick={() => setZStep(step)}>{step}</button>
              ))}
            </div>
            <div className="tune-step-group" role="group" aria-label="Speed and flow step">
              {PCT_STEPS.map((step) => (
                <button type="button" key={step} className={`tune-step ${pctStep === step ? 'active' : ''}`} aria-pressed={pctStep === step} onClick={() => setPctStep(step)}>{step}%</button>
              ))}
            </div>
          </div>
        </section>
        <div className="live-tune-side">
          <MotionTuneControls />
          <CoolingControls />
          <Link className="btn button-link" to="/print">Back to Print</Link>
        </div>
      </div>
    </Layout>
  );
}
