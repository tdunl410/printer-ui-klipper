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
  { to: '/control', label: 'Control' },
  { to: '/settings', label: 'Settings' },
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
          Home
        </NavLink>
        <NavLink to={printRoute} className={({ isActive }: { isActive: boolean }) => (isActive ? 'active' : '')}>
          Print
        </NavLink>
        {dockItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }: { isActive: boolean }) => (isActive ? 'active' : '')}
            end={item.to === '/'}
          >
            {item.label}
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
