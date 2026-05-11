import type { PropsWithChildren, ReactNode } from 'react';

interface DataPanelProps extends PropsWithChildren {
  title: string;
  meta?: string;
  action?: ReactNode;
}

export function DataPanel({ title, meta, action, children }: DataPanelProps) {
  return (
    <section className="console-panel">
      <div className="flex min-h-12 items-center justify-between border-b border-outline bg-surface-low px-4 py-3">
        <div>
          <h2 className="font-display text-base font-semibold text-on-surface">{title}</h2>
          {meta ? <p className="mt-0.5 text-xs font-medium text-muted">{meta}</p> : null}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
