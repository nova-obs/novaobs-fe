import { useEffect, useState, type RefObject } from 'react';

export interface PopoverPosition {
  top: number;
  left: number;
  width: number;
}

interface Options {
  triggerRef: RefObject<HTMLElement | null>;
  open: boolean;
  itemCount: number;
  rowHeight?: number;
  minWidth?: number;
  maxHeight?: number;
  viewportPadding?: number;
}

export function usePopoverPosition({
  triggerRef,
  open,
  itemCount,
  rowHeight = 66,
  minWidth = 360,
  maxHeight = 320,
  viewportPadding = 12,
}: Options): PopoverPosition {
  const [style, setStyle] = useState<PopoverPosition>({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (!open) return undefined;

    let frame = 0;
    const compute = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(Math.max(rect.width, minWidth), window.innerWidth - viewportPadding * 2);
      const left = Math.min(Math.max(viewportPadding, rect.left), window.innerWidth - width - viewportPadding);
      const estimatedHeight = Math.min(Math.max(itemCount, 1) * rowHeight + 8, maxHeight);
      const below = rect.bottom + 6;
      const top = below + estimatedHeight <= window.innerHeight - viewportPadding
        ? below
        : Math.max(viewportPadding, rect.top - estimatedHeight - 6);
      setStyle({ top, left, width });
    };
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        compute();
      });
    };
    compute();
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [open, itemCount, rowHeight, minWidth, maxHeight, viewportPadding, triggerRef]);

  return style;
}
