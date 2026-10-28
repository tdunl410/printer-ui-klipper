import { Link } from 'react-router-dom';
import { BackButton, Layout } from '../components/Layout';
import { useCommands, usePrinterStore } from '../stores/usePrinterStore';

const themeOptions = [
  { key: 'purple', label: 'Purple (default)', swatch: '#7b4dff' },
  { key: 'blue', label: 'Blue', swatch: '#1d8bff' },
  { key: 'green', label: 'Green', swatch: '#1fbf5b' },
  { key: 'rose', label: 'Rose', swatch: '#d15ca2' },
] as const;

export function SettingsScreen() {
  const commands = useCommands();
  const runAction = usePrinterStore((state) => state.runAction);
  const theme = usePrinterStore((state) => state.theme);
  const setTheme = usePrinterStore((state) => state.setTheme);

  return (
    <Layout title="Settings" subtitle="Navigation + Network + System" homeAction>
      <section className="status-row">
        <article className="status-chip"><div className="k">Profile</div><div className="v">Voron 2.4</div></article>
        <article className="status-chip"><div className="k">Firmware</div><div className="v">Online</div></article>
        <article className="status-chip"><div className="k">Theme</div><div className="v">{theme}</div></article>
      </section>

      <section className="card">
        <div className="card-label">Navigation</div>
        <div className="card-title">Pages</div>
        <div className="settings-nav">
          <Link className="action-link" to="/">Dashboard →</Link>
          <Link className="action-link" to="/print">Print →</Link>
          <Link className="action-link" to="/files">Files →</Link>
          <Link className="action-link" to="/move">Move →</Link>
          <Link className="action-link" to="/preheat">Preheat →</Link>
          <Link className="action-link" to="/extrude">Extrude →</Link>
          <Link className="action-link" to="/control">Console →</Link>
          <Link className="action-link" to="/connectivity">Connectivity →</Link>
          <Link className="action-link" to="/updates">Updates →</Link>
        </div>
      </section>

      <section className="card">
        <div className="card-label">Appearance</div>
        <div className="card-title">Theme</div>
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
        <div className="card-label">Interface</div>
        <div className="card-title">Screen & Input</div>
        <div className="kv"><span>Language</span><strong>English</strong></div>
        <div className="kv"><span>Touch Sounds</span><strong>On</strong></div>
        <div className="kv"><span>Lock During Print</span><strong>Enabled</strong></div>
        <div className="kv"><span>Auto Dim</span><strong>2 min</strong></div>
        <div className="btn-row">
          <button type="button" className="btn" disabled>Brightness</button>
          <button type="button" className="btn" disabled>Screensaver</button>
          <button type="button" className="btn" disabled>Calibrate Touch</button>
        </div>
      </section>

      <section className="card">
        <div className="card-label">Maintenance</div>
        <div className="card-title">System Actions</div>
        <div className="btn-row">
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (window.confirm('Restart Klipper service?')) {
                void runAction('Restart Klipper', () => commands.systemAction('restart-klipper'));
              }
            }}
          >
            Restart Klipper
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (window.confirm('Reboot host machine?')) {
                void runAction('Restart Host', () => commands.systemAction('restart-host'));
              }
            }}
          >
            Restart Host
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (window.confirm('Shutdown host machine?')) {
                void runAction('Shutdown Host', () => commands.systemAction('shutdown'));
              }
            }}
          >
            Shutdown
          </button>
        </div>
      </section>

      <BackButton to="/" />
    </Layout>
  );
}
