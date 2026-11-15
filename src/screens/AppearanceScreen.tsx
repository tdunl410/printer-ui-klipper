import { useEffect, useState } from 'react';
import { ColorPicker } from '../components/ColorPicker';
import { Layout } from '../components/Layout';
import { KeyboardInput } from '../components/OnScreenKeyboard';
import { usePrinterStore } from '../stores/usePrinterStore';
import { type BottomBarItemKey } from '../services/userConfig';
import { printerRenders } from '../utils/printerRenders';

const bottomBarOptions: { key: BottomBarItemKey; label: string }[] = [
  { key: 'print', label: 'Print' },
  { key: 'control', label: 'Control' },
  { key: 'preheat', label: 'Preheat' },
  { key: 'extrude', label: 'Extrude' },
];

const themeOptions = [
  { key: 'purple', label: 'Purple (default)', swatch: '#7b4dff' },
  { key: 'blue', label: 'Blue', swatch: '#1d8bff' },
  { key: 'green', label: 'Green', swatch: '#1fbf5b' },
  { key: 'rose', label: 'Rose', swatch: '#d15ca2' },
  { key: 'red', label: 'Red', swatch: '#ef4444' },
  { key: 'orange', label: 'Orange', swatch: '#f97316' },
  { key: 'white', label: 'White', swatch: '#ffffff' },
] as const;

export function AppearanceScreen() {
  const profileName = usePrinterStore((state) => state.profileName);
  const setPrinterName = usePrinterStore((state) => state.setPrinterName);
  const theme = usePrinterStore((state) => state.theme);
  const setTheme = usePrinterStore((state) => state.setTheme);
  const customAccentColor = usePrinterStore((state) => state.customAccentColor);
  const setAccentColor = usePrinterStore((state) => state.setAccentColor);
  const textScale = usePrinterStore((state) => state.textScale);
  const setTextScale = usePrinterStore((state) => state.setTextScale);
  const printerRender = usePrinterStore((state) => state.printerRender);
  const setPrinterRender = usePrinterStore((state) => state.setPrinterRender);
  const bottomBarItems = usePrinterStore((state) => state.bottomBarItems);
  const setBottomBarItems = usePrinterStore((state) => state.setBottomBarItems);
  const [printerName, setPrinterNameDraft] = useState(profileName);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  const savePrinterName = (value: string) => {
    const trimmedName = value.trim();
    if (!trimmedName) return;
    setPrinterName(trimmedName);
    setPrinterNameDraft(trimmedName);
  };

  useEffect(() => {
    setPrinterNameDraft(profileName);
  }, [profileName]);

  return (
    <Layout title="Appearance" subtitle=" " homeAction>
      <div className="appearance-columns">
        <div className="appearance-column">
          <section className="card appearance-name-card">
            <div className="card-title">Printer Name</div>
            <KeyboardInput
              label="Printer name"
              value={printerName}
              onChange={setPrinterNameDraft}
              onDone={savePrinterName}
              placeholder="Printer name"
            />
          </section>
          <section className="card appearance-bottom-bar-card">
            <div className="card-title">Bottom Bar</div>
            <p className="card-hint">Choose 2–5 items. Home and Settings are always included.</p>
            <div className="bottom-bar-options">
              {bottomBarOptions.map((option) => {
                const selected = bottomBarItems.includes(option.key);
                const disabled = !selected && bottomBarItems.length >= 5;
                return (
                  <button
                    key={option.key}
                    type="button"
                    className={`bottom-bar-option button-reset ${selected ? 'selected' : ''}`}
                    role="checkbox"
                    aria-checked={selected}
                    disabled={disabled}
                    onClick={() => setBottomBarItems(
                      selected ? bottomBarItems.filter((item) => item !== option.key) : [...bottomBarItems, option.key],
                    )}
                  >
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
        <div className="appearance-column">
          <section className="card appearance-accent-card">
            <div className="card-title">Accent Color</div>
            <div className="accent-options">
              {themeOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`accent-swatch button-reset ${theme === option.key ? 'selected' : ''}`}
                  aria-label={`${option.label} accent`}
                  aria-pressed={theme === option.key}
                  onClick={() => setTheme(option.key)}
                >
                  <span className="swatch" style={{ background: option.swatch }}></span>
                </button>
              ))}
              <button
                type="button"
                className={`accent-custom-button button-reset ${theme === 'custom' ? 'selected' : ''}`}
                aria-label="Choose custom accent color"
                aria-pressed={theme === 'custom'}
                onClick={() => setColorPickerOpen(true)}
              >
                <span className="swatch" style={{ background: theme === 'custom' ? customAccentColor : 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }}></span>
                <span>Custom</span>
              </button>
            </div>
            <div className="card-hint">{theme === 'custom' ? `Custom color: ${customAccentColor.toUpperCase()}` : ' '}</div>
          </section>
          <section className="card appearance-text-size-card">
            <div className="card-title">Text Size</div>
            <div className="text-size-control">
              <span className="text-size-small" aria-hidden="true">A</span>
              <input
                type="range"
                min="0.8"
                max="1.3"
                step="0.1"
                value={textScale}
                aria-label="Text size"
                aria-valuetext={`${Math.round(textScale * 100)} percent`}
                onChange={(event) => setTextScale(Number(event.currentTarget.value))}
              />
              <span className="text-size-large" aria-hidden="true">A</span>
            </div>
            <div className="card-hint">{Math.round(textScale * 100)}%</div>
          </section>
          <section className="card appearance-render-card">
            <div className="card-title">Printer Render</div>
            <div className="printer-render-options">
              {printerRenders.map((option) => (
                <button
                  key={option.name}
                  type="button"
                  className={`printer-render-option button-reset ${printerRender === option.name ? 'selected' : ''}`}
                  aria-pressed={printerRender === option.name}
                  onClick={() => setPrinterRender(option.name)}
                >
                  <img src={option.src} alt="" aria-hidden="true" />
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
      {colorPickerOpen ? (
        <ColorPicker initialColor={customAccentColor} onSave={setAccentColor} onClose={() => setColorPickerOpen(false)} />
      ) : null}
    </Layout>
  );
}
