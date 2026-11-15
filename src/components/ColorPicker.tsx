import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { hexToRgb, hsvToRgb, rgbToHex, rgbToHsv } from '../utils/color';

interface ColorPickerProps {
  initialColor: string;
  onSave: (color: string) => void;
  onClose: () => void;
}

export function ColorPicker({ initialColor, onSave, onClose }: ColorPickerProps) {
  const [color, setColor] = useState(() => rgbToHsv(hexToRgb(initialColor)));
  const cancelButton = useRef<HTMLButtonElement>(null);
  const rgb = hsvToRgb(color);
  const hex = rgbToHex(rgb);
  const angle = color.hue * Math.PI / 180;
  const markerStyle = {
    left: `${50 + Math.sin(angle) * color.saturation * 50}%`,
    top: `${50 - Math.cos(angle) * color.saturation * 50}%`,
  };

  useEffect(() => {
    cancelButton.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const updateWheel = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left - bounds.width / 2) / (bounds.width / 2);
    const y = (event.clientY - bounds.top - bounds.height / 2) / (bounds.height / 2);
    const saturation = Math.min(1, Math.hypot(x, y));
    setColor((current) => ({
      ...current,
      hue: saturation < 0.001 ? current.hue : (Math.atan2(x, -y) * 180 / Math.PI + 360) % 360,
      saturation,
    }));
  };

  const updateChannel = (index: number, value: number) => {
    const next = [...rgb];
    next[index] = value;
    setColor(rgbToHsv(next));
  };

  return (
    <div className="modal-overlay color-picker-overlay" role="dialog" aria-modal="true" aria-labelledby="color-picker-title">
      <section className="color-picker-sheet">
        <div className="color-picker-header">
          <div>
            <div className="card-label">Accent Color</div>
            <div id="color-picker-title" className="card-title">Custom Color</div>
          </div>
          <button ref={cancelButton} type="button" className="keyboard-link button-reset" onClick={onClose}>Cancel</button>
        </div>
        <div className="color-picker-content">
          <div
            className="color-wheel"
            aria-hidden="true"
            onPointerDown={(event) => {
              if (!event.isPrimary) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              updateWheel(event);
            }}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) updateWheel(event);
            }}
          >
            <span className="color-wheel-marker" style={markerStyle} />
          </div>
          <div className="color-picker-controls">
            <div className="color-picker-preview">
              <span className="color-picker-sample" style={{ backgroundColor: hex }} />
              <div><strong>{hex.toUpperCase()}</strong><div className="card-hint">RGB {rgb.join(', ')}</div></div>
            </div>
            <label className="color-slider-row">
              <span>Brightness</span>
              <input
                type="range"
                aria-label="Brightness"
                min="0"
                max="100"
                value={Math.round(color.value * 100)}
                style={{ '--color-slider-end': rgbToHex(hsvToRgb({ ...color, value: 1 })) } as CSSProperties}
                onChange={(event) => setColor({ ...color, value: Number(event.currentTarget.value) / 100 })}
              />
              <output>{Math.round(color.value * 100)}%</output>
            </label>
            {(['Red', 'Green', 'Blue'] as const).map((label, index) => (
              <label className="color-slider-row" key={label}>
                <span>{label}</span>
                <input
                  type="range"
                  aria-label={label}
                  min="0"
                  max="255"
                  value={rgb[index]}
                  style={{ '--color-slider-end': ['#ff4d4d', '#4bdb78', '#5a9cff'][index] } as CSSProperties}
                  onChange={(event) => updateChannel(index, Number(event.currentTarget.value))}
                />
                <output>{rgb[index]}</output>
              </label>
            ))}
            <button type="button" className="btn accent color-picker-save" onClick={() => { onSave(hex); onClose(); }}>
              Save Color
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
