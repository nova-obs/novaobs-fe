import type { PropsWithChildren, ReactNode } from 'react';
import { Search, XCircle } from 'lucide-react';

export function shortIdentity(value?: string, length = 16): string {
  if (!value) return '-';
  return value.length > length ? value.slice(0, length) : value;
}

export function LogsErrorLine({ message }: { message: string }) {
  return (
    <div className="m-3 flex items-center gap-2 rounded border border-red-500/30 bg-red-50 px-3 py-2 text-sm text-red-600">
      <XCircle className="h-4 w-4" />
      {message}
    </div>
  );
}

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
    <header className="logs-task-page-header flex shrink-0 flex-col gap-2 border-b border-outline pb-2 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
        <h2 className="shrink-0 text-base font-semibold text-on-surface">{title}</h2>
        {meta ? <span className="shrink-0 font-mono text-[11px] font-medium text-muted">{meta}</span> : null}
        {context ? <div className="shrink-0">{context}</div> : null}
        <span className="hidden min-w-0 truncate text-xs leading-5 text-muted 2xl:inline">{description}</span>
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </header>
  );
}
