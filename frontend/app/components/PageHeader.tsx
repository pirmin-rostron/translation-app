/**
 * PageHeader — consistent page header for all AppShell pages.
 * Renders an eyebrow label + serif title + optional subtitle + optional action slot (top right).
 * Dashboard keeps its own welcome message and does NOT use this component.
 */

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function PageHeader({ eyebrow, title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="mb-8 flex items-start justify-between">
      <div>
        <p className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-widest text-brand-accent">
          {eyebrow}
        </p>
        <h1 className="font-display text-2xl font-bold text-brand-text">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-brand-muted">{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
