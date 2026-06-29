import type { PropsWithChildren, ReactNode } from 'react';

interface DataPanelProps extends PropsWithChildren {
  title: string;
  meta?: string;
  action?: ReactNode;
}

export function DataPanel({ title, meta, action, children }: DataPanelProps) {
  return (
    <section className="console-panel overflow-hidden">
      <div className="console-panel-header">
        <div className="min-w-0">
          <h2 className="console-section-title">{title}</h2>
          {meta ? <p className="console-section-meta">{meta}</p> : null}
        </div>
        {action}
      </div>
      <div className="console-panel-body">{children}</div>
    </section>
  );
}
