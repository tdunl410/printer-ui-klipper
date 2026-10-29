import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Dialog } from '../components/Dialog';
import { Layout } from '../components/Layout';
import { useCommands, usePrinterStore } from '../stores/usePrinterStore';

const themeOptions = [
  { key: 'purple', label: 'Purple (default)', swatch: '#7b4dff' },
  { key: 'blue', label: 'Blue', swatch: '#1d8bff' },
  { key: 'green', label: 'Green', swatch: '#1fbf5b' },
  { key: 'rose', label: 'Rose', swatch: '#d15ca2' },
] as const;

export function SettingsScreen() {
  const commands = useCommands();
  const profileName = usePrinterStore((state) => state.profileName);
  const connectionState = usePrinterStore((state) => state.connectionState);
  const jobState = usePrinterStore((state) => state.job.state);
  const runAction = usePrinterStore((state) => state.runAction);
  const theme = usePrinterStore((state) => state.theme);
  const setTheme = usePrinterStore((state) => state.setTheme);
  const [confirmAction, setConfirmAction] = useState<'restart-klipper' | 'restart-host' | 'shutdown' | null>(null);

  const printRoute = jobState === 'printing' || jobState === 'paused' ? '/print' : '/files';

  return (
    <Layout title="Settings" subtitle=" " homeAction>
      <section className="status-row">
        <article className="status-chip"><div className="k">Profile</div><div className="v">{profileName}</div></article>
        <article className="status-chip"><div className="k">Firmware</div><div className="v">{connectionState === 'online' ? 'Online' : 'Offline'}</div></article>
        <article className="status-chip"><div className="k">Theme</div><div className="v">{theme}</div></article>
      </section>

      <section className="card">
        <div className="card-label">Navigation</div>
        <div className="card-title">Pages</div>
        <div className="settings-nav">
          <Link className="action-link" to="/">Dashboard →</Link>
          <Link className="action-link" to={printRoute}>Print →</Link>
          <Link className="action-link" to="/files">Files →</Link>
          <Link className="action-link" to="/preheat">Preheat →</Link>
          <Link className="action-link" to="/extrude">Extrude →</Link>
          <Link className="action-link" to="/control">Control →</Link>
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
        <div className="card-label">Maintenance</div>
        <div className="card-title">System Actions</div>
        <div className="btn-row">
          <button
            type="button"
            className="btn"
            onClick={() => setConfirmAction('restart-klipper')}
          >
            Restart Klipper
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setConfirmAction('restart-host')}
          >
            Restart Host
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setConfirmAction('shutdown')}
          >
            Shutdown
          </button>
        </div>
      </section>


      {confirmAction ? (
        <Dialog
          subtitle="Confirm Action"
          title={
            confirmAction === 'restart-klipper'
              ? 'Restart Klipper service?'
              : confirmAction === 'restart-host'
                ? 'Reboot host machine?'
                : 'Shutdown host machine?'
          }
          actions={[
            {
              label: 'Confirm',
              variant: 'accent',
              onClick: () => {
                if (confirmAction === 'restart-klipper') {
                  void runAction('Restart Klipper', () => commands.systemAction('restart-klipper'));
                }
                if (confirmAction === 'restart-host') {
                  void runAction('Restart Host', () => commands.systemAction('restart-host'));
                }
                if (confirmAction === 'shutdown') {
                  void runAction('Shutdown Host', () => commands.systemAction('shutdown'));
                }
                setConfirmAction(null);
              },
            },
            { label: 'Cancel', onClick: () => setConfirmAction(null) },
          ]}
        />
      ) : null}
    </Layout>
  );
}
