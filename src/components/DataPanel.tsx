import type { PropsWithChildren, ReactNode } from 'react';

interface DataPanelProps extends PropsWithChildren {
  title?: string;
  meta?: string;
  action?: ReactNode;
}

export function DataPanel({ title, meta, action, children }: DataPanelProps) {
  const hasTitleBlock = Boolean(title || meta);
  const hasHeader = hasTitleBlock || Boolean(action);

  return (
    <section className="console-panel overflow-hidden">
      {hasHeader ? (
        <div className={`console-panel-header ${hasTitleBlock ? '' : 'justify-end'}`}>
          {hasTitleBlock ? (
            <div className="min-w-0">
              {title ? <h2 className="console-section-title">{title}</h2> : null}
              {meta ? <p className="console-section-meta">{meta}</p> : null}
            </div>
          ) : null}
          {action}
        </div>
      ) : null}
      <div className="console-panel-body">{children}</div>
    </section>
  );
}
