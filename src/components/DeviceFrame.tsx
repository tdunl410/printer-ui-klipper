import { useEffect, useRef } from 'react';

interface DeviceFrameProps {
  children: React.ReactNode;
}

export function DeviceFrame({ children }: DeviceFrameProps) {
  const ref = useRef<HTMLElement>(null);

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

  return (
    <main className="device" ref={ref}>
      {children}
    </main>
  );
}
