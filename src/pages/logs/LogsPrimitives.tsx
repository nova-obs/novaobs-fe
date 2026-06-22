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
      <div className="flex min-h-11 shrink-0 items-center justify-between gap-3 border-b border-outline/70 bg-white/72 px-3 py-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-on-surface">{title}</h2>
          {meta ? <p className="mt-0.5 truncate font-mono text-[11px] text-muted">{meta}</p> : null}
        </div>
        {action}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
export function LogsInfoCell({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'primary' | 'warning' }) {
  return (
    <div className={`border-t px-3 py-2 ${tone === 'primary' ? 'border-primary/20 bg-primary-soft/40' : tone === 'warning' ? 'border-amber-500/20 bg-amber-50/70' : 'border-outline/70 bg-white/58'}`}>
      <div className="text-[11px] font-medium text-muted">{label}</div>
      <div className={`mt-1 break-all font-mono text-xs ${tone === 'primary' ? 'text-primary' : tone === 'warning' ? 'text-amber-700' : 'text-on-surface'}`}>{value || '-'}</div>
    </div>
  );
}

export function LogsEmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-40 items-center justify-center border border-dashed border-outline bg-white/42 px-4 py-8 text-center">
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
      className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-all active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 ${
        active ? 'border-primary bg-primary-soft text-primary' : 'border-outline bg-white/82 text-muted hover:border-primary/40 hover:text-on-surface'
      }`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
