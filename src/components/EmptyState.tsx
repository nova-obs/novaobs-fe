import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

export function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg bg-white/45 px-4 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
      <Inbox className="h-5 w-5 text-muted" />
      <div className="text-sm font-semibold text-on-surface">{title}</div>
      {action ?? null}
    </div>
  );
}
