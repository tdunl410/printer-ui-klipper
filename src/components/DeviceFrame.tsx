import { useEffect, useRef } from 'react';

interface DeviceFrameProps {
  children: React.ReactNode;
}

export function DeviceFrame({ children }: DeviceFrameProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;

    const aspectWidth = 400;
    const aspectHeight = 1280;

    const lockFrameAspectRatio = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const scale = Math.min(viewportWidth / aspectWidth, viewportHeight / aspectHeight);
      frame.style.width = `${Math.max(1, aspectWidth * scale).toFixed(2)}px`;
      frame.style.height = `${Math.max(1, aspectHeight * scale).toFixed(2)}px`;
    };

    lockFrameAspectRatio();
    window.addEventListener('resize', lockFrameAspectRatio);
    return () => window.removeEventListener('resize', lockFrameAspectRatio);
  }, []);

  return (
    <main className="device" ref={ref}>
      {children}
    </main>
  );
}
