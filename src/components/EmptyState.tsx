import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

export function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="console-empty-state">
      <Inbox className="h-5 w-5 text-muted/80" />
      <div className="text-sm font-semibold text-on-surface">{title}</div>
      {action ?? null}
    </div>
  );
}
