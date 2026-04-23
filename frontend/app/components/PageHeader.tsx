/**
 * PageHeader — consistent page header for all AppShell pages.
 * Renders an eyebrow label + display title + optional subtitle + optional action slot (top right).
 * Dashboard keeps its own welcome header and does NOT use this component.
 */

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function PageHeader({ eyebrow, title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="mb-6 flex items-end justify-between gap-6">
      <div>
        <p className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-widest text-brand-accent">
          {eyebrow}
        </p>
        <h1 className="m-0 font-display text-[2rem] font-bold leading-tight tracking-heading text-brand-text">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-sm text-brand-muted">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
