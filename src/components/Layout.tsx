import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { usePrinterStore } from '../stores/usePrinterStore';

interface LayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  homeAction?: boolean;
}

const dockItems = [
  { to: '/control', label: 'Control', icon: '🎛' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

export function Layout({ title, subtitle, children, homeAction }: LayoutProps) {
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
            ⌂ Home
          </Link>
        ) : (
          <Link to="/settings" className="icon-btn">
            ⚙ Settings
          </Link>
        )}
      </header>

      {children}

      <nav className="dock">
        <NavLink to="/" className={({ isActive }: { isActive: boolean }) => (isActive ? 'active' : '')} end>
          <span className="dock-icon" aria-hidden="true">⌂</span>
          <span className="dock-label">Home</span>
        </NavLink>
        <NavLink to={printRoute} className={({ isActive }: { isActive: boolean }) => (isActive ? 'active' : '')}>
          <span className="dock-icon" aria-hidden="true">🖨</span>
          <span className="dock-label">Print</span>
        </NavLink>
        {dockItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }: { isActive: boolean }) => (isActive ? 'active' : '')}
            end={item.to === '/'}
          >
            <span className="dock-icon" aria-hidden="true">{item.icon}</span>
            <span className="dock-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </section>
  );
}

export function BackButton({ to = '/' }: { to?: string }) {
  void to;
  return null;
}
