import { useEffect, useId, useRef, useState } from 'react';
import { Layout } from '../components/Layout';
import { type SleepTimeout } from '../services/userConfig';
import { usePrinterStore } from '../stores/usePrinterStore';

const sleepOptions: { value: SleepTimeout; label: string }[] = [
  { value: 5, label: '5 minutes' },
  { value: 10, label: '10 minutes' },
  { value: 20, label: '20 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 'never', label: 'Never' },
];

interface SleepTimeoutDropdownProps {
  label: string;
  value: SleepTimeout;
  onChange: (timeout: SleepTimeout) => void;
}

function SleepTimeoutDropdown({ label, value, onChange }: SleepTimeoutDropdownProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedOption = sleepOptions.find((option) => option.value === value) ?? sleepOptions[sleepOptions.length - 1];

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !containerRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div className={`display-timeout-field${open ? ' open' : ''}`}>
      <span className="display-timeout-label" id={`${id}-label`}>{label}</span>
      <div className="display-dropdown" ref={containerRef}>
        <button
          ref={triggerRef}
          type="button"
          className="display-dropdown-trigger"
          aria-labelledby={`${id}-label ${id}-value`}
          aria-expanded={open}
          aria-controls={`${id}-options`}
          onClick={() => setOpen((current) => !current)}
        >
          <span id={`${id}-value`}>{selectedOption.label}</span>
          <span className={`display-dropdown-chevron${open ? ' expanded' : ''}`} aria-hidden="true" />
        </button>
        {open ? (
          <div className="display-dropdown-options" id={`${id}-options`} role="group" aria-labelledby={`${id}-label`}>
            {sleepOptions.map((option) => {
              const selected = option.value === value;
              return (
                <button
                  key={String(option.value)}
                  type="button"
                  className={`display-dropdown-option${selected ? ' selected' : ''}`}
                  aria-pressed={selected}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                >
                  <span>{option.label}</span>
                  <span className="display-dropdown-indicator" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function DisplayScreen() {
  const brightness = usePrinterStore((state) => state.displayBrightness);
  const setBrightness = usePrinterStore((state) => state.setDisplayBrightness);
  const idleSleepTimeout = usePrinterStore((state) => state.idleSleepTimeout);
  const setIdleSleepTimeout = usePrinterStore((state) => state.setIdleSleepTimeout);
  const printingSleepTimeout = usePrinterStore((state) => state.printingSleepTimeout);
  const setPrintingSleepTimeout = usePrinterStore((state) => state.setPrintingSleepTimeout);
  const [resolution, setResolution] = useState(() => `${window.screen.width} × ${window.screen.height}`);

  useEffect(() => {
    const updateResolution = () => setResolution(`${window.screen.width} × ${window.screen.height}`);
    window.addEventListener('resize', updateResolution);
    return () => window.removeEventListener('resize', updateResolution);
  }, []);

  return (
    <Layout title="Display" subtitle=" " homeAction>
      <section className="card">
        <div className="card-title">Resolution</div>
        <div className="kv">
          <span>Display resolution</span>
          <strong>{resolution}</strong>
        </div>
      </section>

      <section className="card">
        <div className="card-title">Brightness</div>
        <div className="text-size-control">
          <span aria-hidden="true">10%</span>
          <input
            type="range"
            min="10"
            max="100"
            step="1"
            value={brightness}
            aria-label="Display brightness"
            aria-valuetext={`${brightness}%`}
            onChange={(event) => setBrightness(Number(event.currentTarget.value))}
          />
          <span aria-hidden="true">100%</span>
        </div>
        <div className="card-hint">{brightness}%</div>
      </section>

      <section className="card">
        <div className="card-title">Screen Sleep</div>
        <SleepTimeoutDropdown label="When idle" value={idleSleepTimeout} onChange={setIdleSleepTimeout} />
        <SleepTimeoutDropdown label="During print" value={printingSleepTimeout} onChange={setPrintingSleepTimeout} />
        <p className="card-hint">The display wakes when you touch or interact with the screen.</p>
      </section>
    </Layout>
  );
}
