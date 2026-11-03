import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { usePrinterStore } from '../stores/usePrinterStore';
import { printerRenders } from '../utils/printerRenders';

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
  const [printerName, setPrinterNameDraft] = useState(profileName);

  useEffect(() => {
    setPrinterNameDraft(profileName);
  }, [profileName]);

  return (
    <Layout title="Appearance" subtitle=" " homeAction>
      <section className="card">
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
      <section className="card">
        <div className="card-title">Printer Name</div>
        <form
          className="btn-row"
          onSubmit={(event) => {
            event.preventDefault();
            if (printerName.trim()) setPrinterName(printerName);
          }}
        >
          <input
            className="input"
            type="text"
            aria-label="Printer name"
            value={printerName}
            onChange={(event) => setPrinterNameDraft(event.target.value)}
            maxLength={60}
            required
          />
          <button className="btn accent" type="submit" disabled={!printerName.trim() || printerName.trim() === profileName}>
            Save Name
          </button>
        </form>
      </section>
      <section className="card">
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
    </Layout>
  );
}
