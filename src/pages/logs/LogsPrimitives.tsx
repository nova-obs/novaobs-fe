import type { PropsWithChildren, ReactNode } from 'react';
import { Search } from 'lucide-react';

interface LogsSectionProps extends PropsWithChildren {
  title: string;
  meta?: string;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function LogsSection({ title, meta, action, className = '', bodyClassName = 'p-3', children }: LogsSectionProps) {
  return (
    <section className={`console-panel overflow-hidden ${className}`}>
      <div className="console-panel-header shrink-0">
        <div className="min-w-0">
          <h2 className="console-section-title">{title}</h2>
          {meta ? <p className="console-section-meta">{meta}</p> : null}
        </div>
        {action}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
export function LogsInfoCell({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'primary' | 'warning' }) {
  return (
    <div className={`border-t px-3 py-2 ${tone === 'primary' ? 'border-primary/20 bg-primary-soft/40' : tone === 'warning' ? 'border-warning/20 bg-amber-50' : 'border-outline/70 bg-surface-lowest'}`}>
      <div className="text-[11px] font-medium text-muted">{label}</div>
      <div className={`mt-1 break-all font-mono text-xs ${tone === 'primary' ? 'text-primary' : tone === 'warning' ? 'text-warning' : 'text-on-surface'}`}>{value || '-'}</div>
    </div>
  );
}

export function LogsEmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="console-empty-state min-h-40">
      <div className="max-w-md">
        <Search className="mx-auto h-5 w-5 text-muted" />
        <div className="mt-3 text-sm font-semibold text-on-surface">{title}</div>
        {description ? <div className="mt-1 text-xs leading-5 text-muted">{description}</div> : null}
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}

export function LogsToolbarButton({ children, active = false, disabled = false, onClick }: PropsWithChildren<{ active?: boolean; disabled?: boolean; onClick?: () => void }>) {
  return (
    <button
      className={`console-button ${
        active ? 'border-primary/30 bg-primary-soft text-primary' : ''
      }`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function LogsTaskPageHeader({
  title,
  description,
  meta,
  context,
  action,
}: {
  title: string;
  description: string;
  meta?: string;
  context?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="logs-task-page-header shrink-0 border-b border-outline pb-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-on-surface">{title}</h2>
              {meta ? <span className="font-mono text-[11px] font-medium text-muted">{meta}</span> : null}
            </div>
            <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
            {context ? <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">{context}</div> : null}
          </div>
        </div>
        {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
      </div>
    </header>
  );
}
