import { useState, type CSSProperties, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import emergencyIcon from '../../assets/emergency.svg';
import extrudeIcon from '../../assets/extrude.svg';
import heaterIcon from '../../assets/heater.svg';
import homeIcon from '../../assets/home.svg';
import moveIcon from '../../assets/move.svg';
import printerIcon from '../../assets/printer.svg';
import settingsIcon from '../../assets/settings.svg';
import { Dialog } from './Dialog';
import { useCommands, usePrinterStore } from '../stores/usePrinterStore';
import { type BottomBarItemKey } from '../services/userConfig';

interface LayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  homeAction?: boolean;
  hideMenuBar?: boolean;
}

const dockItems: Record<BottomBarItemKey, { to: string; label: string; icon: string }> = {
  home: { to: '/', label: 'Home', icon: homeIcon },
  print: { to: '/files', label: 'Print', icon: printerIcon },
  control: { to: '/control', label: 'Control', icon: moveIcon },
  preheat: { to: '/preheat', label: 'Preheat', icon: heaterIcon },
  extrude: { to: '/extrude', label: 'Extrude', icon: extrudeIcon },
  settings: { to: '/settings', label: 'Settings', icon: settingsIcon },
};

export function Layout({ title, subtitle, children, homeAction, hideMenuBar = false }: LayoutProps) {
  const commands = useCommands();
  const runAction = usePrinterStore((state) => state.runAction);
  const bottomBarItems = usePrinterStore((state) => state.bottomBarItems);
  const [confirmEmergency, setConfirmEmergency] = useState(false);
  const jobState = usePrinterStore((state: { job: { state: string } }) => state.job.state);
  const printRoute = jobState === 'printing' || jobState === 'paused' ? '/print' : '/files';

  return (
    <section className={`screen${hideMenuBar ? ' menu-hidden' : ''}`}>
      <header className="header">
        <div>
          <div className="printer-title">{title}</div>
          <div className="subline">{subtitle}</div>
        </div>
        {homeAction ? (
          <Link to="/" className="icon-btn">
            <img className="button-icon" src={homeIcon} alt="" aria-hidden="true" />
            Home
          </Link>
        ) : (
          <button type="button" className="icon-btn emergency-btn" onClick={() => setConfirmEmergency(true)}>
            <img className="button-icon" src={emergencyIcon} alt="" aria-hidden="true" />
            Emergency
          </button>
        )}
      </header>

      {children}

      {!hideMenuBar ? (
        <nav className="dock" style={{ '--dock-item-count': bottomBarItems.length } as CSSProperties}>
          {bottomBarItems.map((key) => {
            const item = dockItems[key];
            const to = key === 'print' ? printRoute : item.to;
            return (
              <NavLink
                key={key}
                to={to}
                className={({ isActive }: { isActive: boolean }) => (isActive ? 'active' : '')}
                end
              >
                <img className="dock-icon" src={item.icon} alt="" aria-hidden="true" />
                <span className="dock-label">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      ) : null}

      {confirmEmergency ? (
        <Dialog
          subtitle="Confirm Action"
          title="Emergency stop? This shuts down Klipper immediately."
          actions={[
            {
              label: 'Emergency Stop',
              variant: 'accent',
              onClick: () => {
                void runAction('Emergency Stop', () => commands.emergencyStop());
                setConfirmEmergency(false);
              },
            },
            { label: 'Cancel', onClick: () => setConfirmEmergency(false) },
          ]}
        />
      ) : null}
    </section>
  );
}
