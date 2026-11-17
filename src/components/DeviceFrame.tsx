import { useEffect, useRef, useState } from 'react';
import { usePrinterStore } from '../stores/usePrinterStore';

interface DeviceFrameProps {
  children: React.ReactNode;
}

export function DeviceFrame({ children }: DeviceFrameProps) {
  const ref = useRef<HTMLElement>(null);
  const brightness = usePrinterStore((state) => state.displayBrightness);
  const jobState = usePrinterStore((state) => state.job.state);
  const idleSleepTimeout = usePrinterStore((state) => state.idleSleepTimeout);
  const printingSleepTimeout = usePrinterStore((state) => state.printingSleepTimeout);
  const [lastActivity, setLastActivity] = useState(() => Date.now());
  const [sleeping, setSleeping] = useState(false);
  const activePrint = jobState === 'printing' || jobState === 'paused';
  const sleepTimeout = activePrint ? printingSleepTimeout : idleSleepTimeout;

  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;

    const fitToViewport = () => {
      frame.style.width = `${window.innerWidth}px`;
      frame.style.height = `${window.innerHeight}px`;
    };

    fitToViewport();
    window.addEventListener('resize', fitToViewport);
    return () => window.removeEventListener('resize', fitToViewport);
  }, []);

  useEffect(() => {
    const recordActivity = () => {
      setLastActivity(Date.now());
      setSleeping(false);
    };

    window.addEventListener('pointerdown', recordActivity);
    window.addEventListener('keydown', recordActivity);
    window.addEventListener('wheel', recordActivity);
    return () => {
      window.removeEventListener('pointerdown', recordActivity);
      window.removeEventListener('keydown', recordActivity);
      window.removeEventListener('wheel', recordActivity);
    };
  }, []);

  useEffect(() => {
    if (sleepTimeout === 'never') {
      setSleeping(false);
      return;
    }

    const timer = window.setTimeout(
      () => setSleeping(true),
      sleepTimeout * 60_000 - (Date.now() - lastActivity),
    );
    return () => window.clearTimeout(timer);
  }, [lastActivity, sleepTimeout]);

  return (
    <main className="device" ref={ref} style={{ filter: `brightness(${brightness / 100})` }}>
      {children}
      {sleeping ? (
        <button
          type="button"
          className="display-sleep-overlay"
          aria-label="Wake display"
          onPointerDown={(event) => {
            event.preventDefault();
            setLastActivity(Date.now());
            setSleeping(false);
          }}
        />
      ) : null}
    </main>
  );
}
