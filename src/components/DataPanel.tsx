import type { PropsWithChildren, ReactNode } from 'react';
import { HelpTip } from './HelpTip';

interface DataPanelProps extends PropsWithChildren {
  title?: string;
  meta?: string;
  help?: string;
  action?: ReactNode;
  className?: string;
}

export function DataPanel({ title, meta, help, action, className = '', children }: DataPanelProps) {
  const hasTitleBlock = Boolean(title || meta || help);
  const hasHeader = hasTitleBlock || Boolean(action);

  return (
    <section className={`console-panel overflow-hidden ${className}`}>
      {hasHeader ? (
        <div className={`console-panel-header ${hasTitleBlock ? '' : 'justify-end'}`}>
          {hasTitleBlock ? (
            <div className="min-w-0">
              {title ? (
                <div className="flex items-center gap-1.5">
                  <h2 className="console-section-title">{title}</h2>
                  {help ? <HelpTip content={help} label={`${title}说明`} /> : null}
                </div>
              ) : help ? <HelpTip content={help} /> : null}
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
