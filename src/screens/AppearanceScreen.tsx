import { Layout } from '../components/Layout';
import { usePrinterStore } from '../stores/usePrinterStore';

const themeOptions = [
  { key: 'purple', label: 'Purple (default)', swatch: '#7b4dff' },
  { key: 'blue', label: 'Blue', swatch: '#1d8bff' },
  { key: 'green', label: 'Green', swatch: '#1fbf5b' },
  { key: 'rose', label: 'Rose', swatch: '#d15ca2' },
] as const;

export function AppearanceScreen() {
  const theme = usePrinterStore((state) => state.theme);
  const setTheme = usePrinterStore((state) => state.setTheme);

  return (
    <Layout title="Appearance" subtitle=" " homeAction>
      <section className="card">
        <div className="card-label">Themes</div>
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
    </Layout>
  );
}
