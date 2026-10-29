import { useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import emergencyIcon from '../../assets/emergency.svg';
import homeIcon from '../../assets/home.svg';
import moveIcon from '../../assets/move.svg';
import printerIcon from '../../assets/printer.svg';
import settingsIcon from '../../assets/settings.svg';
import { Dialog } from './Dialog';
import { useCommands, usePrinterStore } from '../stores/usePrinterStore';

interface LayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  homeAction?: boolean;
}

const dockItems = [
  { to: '/control', label: 'Control', icon: moveIcon },
  { to: '/settings', label: 'Settings', icon: settingsIcon },
];

export function Layout({ title, subtitle, children, homeAction }: LayoutProps) {
  const commands = useCommands();
  const runAction = usePrinterStore((state) => state.runAction);
  const [confirmEmergency, setConfirmEmergency] = useState(false);
  const jobState = usePrinterStore((state: { job: { state: string } }) => state.job.state);
  const printRoute = jobState === 'printing' || jobState === 'paused' ? '/print' : '/files';

  return (
    <section className="screen">
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

      <nav className="dock">
        <NavLink to="/" className={({ isActive }: { isActive: boolean }) => (isActive ? 'active' : '')} end>
          <img className="dock-icon" src={homeIcon} alt="" aria-hidden="true" />
          <span className="dock-label">Home</span>
        </NavLink>
        <NavLink to={printRoute} className={({ isActive }: { isActive: boolean }) => (isActive ? 'active' : '')}>
          <img className="dock-icon" src={printerIcon} alt="" aria-hidden="true" />
          <span className="dock-label">Print</span>
        </NavLink>
        {dockItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }: { isActive: boolean }) => (isActive ? 'active' : '')}
            end={item.to === '/'}
          >
            <img className="dock-icon" src={item.icon} alt="" aria-hidden="true" />
            <span className="dock-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {confirmEmergency ? (
        <Dialog
          subtitle="Confirm Action"
          title="Send emergency stop (M112)?"
          actions={[
            {
              label: 'Emergency Stop',
              variant: 'accent',
              onClick: () => {
                void runAction('Emergency Stop', () => commands.runMacro('M112'));
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

export function BackButton({ to = '/' }: { to?: string }) {
  void to;
  return null;
}
