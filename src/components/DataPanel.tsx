import type { PropsWithChildren, ReactNode } from 'react';

interface DataPanelProps extends PropsWithChildren {
  title: string;
  meta?: string;
  action?: ReactNode;
}

export function DataPanel({ title, meta, action, children }: DataPanelProps) {
  return (
    <section className="console-panel">
      <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary/65 shadow-[0_0_0_4px_rgba(31,122,118,0.08)]" />
            <h2 className="truncate font-display text-base font-semibold tracking-tight text-on-surface">{title}</h2>
          </div>
          {meta ? <p className="mt-1 truncate pl-3.5 text-xs font-medium text-muted">{meta}</p> : null}
        </div>
        {action}
      </div>
      <div className="px-4 pb-4">{children}</div>
    </section>
  );
}
