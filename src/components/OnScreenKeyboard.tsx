import { useState } from 'react';

type Layer = 'lower' | 'upper' | 'symbols' | 'more';

const layers: Record<Layer, string[][]> = {
  lower: [
    'qwertyuiop'.split(''),
    'asdfghjkl'.split(''),
    'zxcvbnm'.split(''),
  ],
  upper: [
    'QWERTYUIOP'.split(''),
    'ASDFGHJKL'.split(''),
    'ZXCVBNM'.split(''),
  ],
  symbols: [
    '1234567890'.split(''),
    '-/:;()$&@"'.split(''),
    '.,?!\''.split(''),
  ],
  more: [
    '[]{}#%^*+='.split(''),
    '_\\|~<>€£¥•'.split(''),
    '.,?!\''.split(''),
  ],
};

interface OnScreenKeyboardProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  secret?: boolean;
}

export function OnScreenKeyboard({ label, value, onChange, onClose, secret = false }: OnScreenKeyboardProps) {
  const [layer, setLayer] = useState<Layer>('lower');
  const [reveal, setReveal] = useState(false);
  const isLetters = layer === 'lower' || layer === 'upper';

  const type = (key: string) => {
    onChange(`${value}${key}`);
    if (layer === 'upper') setLayer('lower');
  };

  const shown = secret && !reveal ? '•'.repeat(value.length) : value;

  return (
    <div className="modal-overlay keyboard-overlay" role="dialog" aria-modal="true">
      <section className="keyboard-sheet">
        <div className="keyboard-header">
          <div className="card-label">{label}</div>
          {secret ? (
            <button type="button" className="keyboard-link button-reset" onClick={() => setReveal((prev) => !prev)}>
              {reveal ? 'Hide' : 'Show'}
            </button>
          ) : null}
        </div>
        <div className="keyboard-preview">{shown}<span className="keyboard-caret" /></div>

        <div className="keyboard-rows">
          {layers[layer].map((row, rowIndex) => (
            <div className="keyboard-row" key={rowIndex}>
              {rowIndex === 2 ? (
                <button
                  type="button"
                  className="key key-wide"
                  onClick={() => setLayer(isLetters ? (layer === 'lower' ? 'upper' : 'lower') : layer === 'symbols' ? 'more' : 'symbols')}
                >
                  {isLetters ? '⇧' : layer === 'symbols' ? '#+=' : '123'}
                </button>
              ) : null}
              {row.map((key) => (
                <button type="button" className="key" key={key} onClick={() => type(key)}>{key}</button>
              ))}
              {rowIndex === 2 ? (
                <button type="button" className="key key-wide" onClick={() => onChange(value.slice(0, -1))} aria-label="Backspace">⌫</button>
              ) : null}
            </div>
          ))}
          <div className="keyboard-row">
            <button type="button" className="key key-wide" onClick={() => setLayer(isLetters ? 'symbols' : 'lower')}>
              {isLetters ? '123' : 'ABC'}
            </button>
            <button type="button" className="key key-space" onClick={() => type(' ')}>space</button>
            <button type="button" className="key key-done" onClick={onClose}>Done</button>
          </div>
        </div>
      </section>
    </div>
  );
}

interface KeyboardInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  secret?: boolean;
  placeholder?: string;
}

// Tap-to-edit field that opens the on-screen keyboard instead of the system one
export function KeyboardInput({ label, value, onChange, secret = false, placeholder }: KeyboardInputProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="input input-button button-reset" onClick={() => setOpen(true)}>
        {value ? (secret ? '•'.repeat(value.length) : value) : <span className="input-placeholder">{placeholder ?? 'Tap to edit'}</span>}
      </button>
      {open ? (
        <OnScreenKeyboard label={label} value={value} onChange={onChange} onClose={() => setOpen(false)} secret={secret} />
      ) : null}
    </>
  );
}
