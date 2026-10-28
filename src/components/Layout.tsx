import { Link, NavLink } from 'react-router-dom';

interface LayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  homeAction?: boolean;
}

const dockItems = [
  { to: '/', label: 'Home' },
  { to: '/print', label: 'Print' },
  { to: '/control', label: 'Control' },
  { to: '/settings', label: 'Settings' },
];

export function Layout({ title, subtitle, children, homeAction }: LayoutProps) {
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
        {dockItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => (isActive ? 'active' : '')}
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
  return (
    <Link to={to} className="back-btn">
      ← Back
    </Link>
  );
}
