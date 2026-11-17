import { useEffect, useRef, useState } from 'react';
import { setHostDisplayPower } from '../services/displayPower';
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
  const dpmsPoweredOff = useRef(false);
  const wakePending = useRef(false);
  const sleepGeneration = useRef(0);
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
      sleepGeneration.current += 1;
      setLastActivity(Date.now());
      if (!sleeping) return;

      setSleeping(false);
      if (!dpmsPoweredOff.current || wakePending.current) return;

      wakePending.current = true;
      void setHostDisplayPower('on')
        .then((available) => {
          if (!available) throw new Error('Display DPMS is no longer available.');
          dpmsPoweredOff.current = false;
        })
        .catch((error: unknown) => {
          console.error('Unable to wake the display with DPMS.', error);
        })
        .finally(() => {
          wakePending.current = false;
        });
    };

    window.addEventListener('pointerdown', recordActivity);
    window.addEventListener('keydown', recordActivity);
    window.addEventListener('wheel', recordActivity);
    return () => {
      window.removeEventListener('pointerdown', recordActivity);
      window.removeEventListener('keydown', recordActivity);
      window.removeEventListener('wheel', recordActivity);
    };
  }, [sleeping]);

  useEffect(() => {
    if (sleepTimeout === 'never') {
      setSleeping(false);
      sleepGeneration.current += 1;
      if (dpmsPoweredOff.current && !wakePending.current) {
        wakePending.current = true;
        void setHostDisplayPower('on')
          .then((available) => {
            if (!available) throw new Error('Display DPMS is no longer available.');
            dpmsPoweredOff.current = false;
          })
          .catch((error: unknown) => {
            console.error('Unable to wake the display with DPMS.', error);
          })
          .finally(() => {
            wakePending.current = false;
          });
      }
      return;
    }

    const timer = window.setTimeout(
      () => {
        const generation = ++sleepGeneration.current;
        setSleeping(true);
        void setHostDisplayPower('off')
          .then((available) => {
            if (!available) return;
            dpmsPoweredOff.current = true;
            if (sleepGeneration.current !== generation) {
              return setHostDisplayPower('on').then((woken) => {
                if (!woken) throw new Error('Display DPMS is no longer available.');
                dpmsPoweredOff.current = false;
              });
            }
          })
          .catch((error: unknown) => {
            console.error('Unable to power off the display with DPMS.', error);
          });
      },
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
        />
      ) : null}
    </main>
  );
}
