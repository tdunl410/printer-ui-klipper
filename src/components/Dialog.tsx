interface DialogAction {
  label: string;
  variant?: 'default' | 'accent';
  onClick: () => void;
  disabled?: boolean;
}

interface DialogProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  actions: DialogAction[];
}

export function Dialog({ title, subtitle, children, actions }: DialogProps) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <section className="modal-card">
        {subtitle ? <div className="card-label">{subtitle}</div> : null}
        <div className="card-title">{title}</div>
        {children ? <div>{children}</div> : null}
        <div className={`btn-row top-gap ${actions.length === 2 ? 'two' : ''}`}>
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={`btn ${action.variant === 'accent' ? 'accent' : ''}`}
              onClick={action.onClick}
              disabled={action.disabled}
            >
              {action.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
