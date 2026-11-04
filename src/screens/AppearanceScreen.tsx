import { useEffect, useState } from 'react';
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
] as const;

export function AppearanceScreen() {
  const profileName = usePrinterStore((state) => state.profileName);
  const setPrinterName = usePrinterStore((state) => state.setPrinterName);
  const theme = usePrinterStore((state) => state.theme);
  const setTheme = usePrinterStore((state) => state.setTheme);
  const printerRender = usePrinterStore((state) => state.printerRender);
  const setPrinterRender = usePrinterStore((state) => state.setPrinterRender);
  const bottomBarItems = usePrinterStore((state) => state.bottomBarItems);
  const setBottomBarItems = usePrinterStore((state) => state.setBottomBarItems);
  const [printerName, setPrinterNameDraft] = useState(profileName);

  useEffect(() => {
    setPrinterNameDraft(profileName);
  }, [profileName]);

  return (
    <Layout title="Appearance" subtitle=" " homeAction>
      <div className="appearance-columns">
        <div className="appearance-column">
          <section className="card appearance-name-card">
            <div className="card-title">Printer Name</div>
            <form
              className="btn-row"
              onSubmit={(event) => {
                event.preventDefault();
                if (printerName.trim()) setPrinterName(printerName);
              }}
            >
              <KeyboardInput label="Printer name" value={printerName} onChange={setPrinterNameDraft} placeholder="Printer name" />
              <button className="btn accent" type="submit" disabled={!printerName.trim() || printerName.trim() === profileName}>
                Save Name
              </button>
            </form>
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
            <div className="card-hint">{bottomBarItems.length} of 5 selected</div>
          </section>
        </div>
        <div className="appearance-column">
          <section className="card appearance-accent-card">
            <div className="card-title">Accent Color</div>
            <div>
              {themeOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`theme-chip button-reset ${theme === option.key ? 'selected' : ''}`}
                  onClick={() => setTheme(option.key)}
                >
                  <span className="swatch" style={{ background: option.swatch }}></span>
                  {option.label}
                </button>
              ))}
            </div>
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
    </Layout>
  );
}
