import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { usePopoverPosition } from './usePopoverPosition';

export interface LogsEntitySelectorProps<T> {
  items: T[];
  activeItem: T | null;
  onSelect: (item: T) => void;
  getId: (item: T) => string;
  triggerIcon: LucideIcon;
  triggerTitle: string;
  triggerMeta: string;
  placeholder: string;
  ariaLabel: string;
  disabled?: boolean;
  renderOption: (item: T, selected: boolean) => ReactNode;
  rowHeight?: number;
  minWidth?: number;
  triggerHeight?: 'h-12' | 'h-14';
  emptyMessage?: string;
}

export function LogsEntitySelector<T>({
  items,
  activeItem,
  onSelect,
  getId,
  triggerIcon: TriggerIcon,
  triggerTitle,
  triggerMeta,
  placeholder,
  ariaLabel,
  disabled = false,
  renderOption,
  rowHeight,
  minWidth,
  triggerHeight = 'h-12',
  emptyMessage,
}: LogsEntitySelectorProps<T>) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const popoverStyle = usePopoverPosition({
    triggerRef,
    open,
    itemCount: items.length,
    rowHeight,
    minWidth,
  });
  const activeId = activeItem ? getId(activeItem) : null;

  // Keep the latest callbacks in refs so effect deps don't churn on every parent render.
  // The parents pass inline arrows for getId/onSelect/renderOption — without this ref indirection
  // the focus/keyboard effects would re-run every parent render and reset focusIndex mid-navigation.
  const getIdRef = useRef(getId);
  const onSelectRef = useRef(onSelect);
  const itemsRef = useRef(items);
  useEffect(() => {
    getIdRef.current = getId;
    onSelectRef.current = onSelect;
    itemsRef.current = items;
  });

  const close = useCallback(() => {
    setOpen(false);
    setFocusIndex(-1);
    triggerRef.current?.focus();
  }, []);

  // Focus reset runs ONLY on the false→true open transition. Reading refs avoids taking
  // items/getId as deps, which would cause resets on unrelated parent re-renders.
  useEffect(() => {
    if (!open) return;
    const currentItems = itemsRef.current;
    const currentGetId = getIdRef.current;
    const activeIdx = activeId ? currentItems.findIndex((item) => currentGetId(item) === activeId) : -1;
    setFocusIndex(activeIdx >= 0 ? activeIdx : 0);
  }, [open, activeId]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event: KeyboardEvent) {
      const currentItems = itemsRef.current;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setFocusIndex((idx) => (currentItems.length ? (idx + 1) % currentItems.length : -1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setFocusIndex((idx) => (currentItems.length ? (idx <= 0 ? currentItems.length - 1 : idx - 1) : -1));
        return;
      }
      if (event.key === 'Home') {
        event.preventDefault();
        setFocusIndex(currentItems.length ? 0 : -1);
        return;
      }
      if (event.key === 'End') {
        event.preventDefault();
        setFocusIndex(currentItems.length ? currentItems.length - 1 : -1);
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setFocusIndex((idx) => {
          if (idx >= 0 && idx < currentItems.length) {
            onSelectRef.current(currentItems[idx]);
            close();
          }
          return idx;
        });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open || focusIndex < 0) return;
    const el = listboxRef.current?.querySelector<HTMLElement>(`[data-index="${focusIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [open, focusIndex]);

  const canOpen = !disabled && (items.length > 0 || Boolean(emptyMessage));

  return (
    <div className="rounded-md">
      <button
        ref={triggerRef}
        type="button"
        className={`flex ${triggerHeight} w-full items-center gap-3 rounded-md border border-outline/80 bg-white px-3 text-left shadow-[0_2px_6px_rgba(24,52,96,0.06)] transition-colors hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-60`}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={!canOpen}
        onClick={() => setOpen((value) => !value)}
      >
        <TriggerIcon className="h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-on-surface">{triggerTitle || placeholder}</div>
          <div className="mt-1 truncate font-mono text-[11px] text-muted">{triggerMeta}</div>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && typeof document !== 'undefined' ? createPortal((
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default border-0 bg-transparent"
            aria-label={`关闭${ariaLabel}`}
            onClick={close}
          />
          <div
            ref={listboxRef}
            className="fixed z-50 max-h-80 overflow-y-auto rounded-md border border-outline bg-white p-1 shadow-[0_14px_36px_rgba(24,52,96,0.2)]"
            style={popoverStyle}
            role="listbox"
            aria-label={ariaLabel}
            tabIndex={-1}
          >
            {items.length === 0 ? (
              <div className="px-3 py-5 text-center text-xs text-muted">{emptyMessage}</div>
            ) : items.map((item, index) => {
              const id = getId(item);
              const selected = id === activeId;
              const focused = index === focusIndex;
              return (
                <button
                  key={id}
                  data-index={index}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`w-full rounded px-3 py-2.5 text-left transition-colors ${
                    selected ? 'bg-primary-soft/70' : focused ? 'bg-surface-low' : 'hover:bg-surface-low'
                  }`}
                  onClick={() => {
                    onSelect(item);
                    close();
                  }}
                  onMouseEnter={() => setFocusIndex(index)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">{renderOption(item, selected)}</div>
                    {selected ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      ), document.body) : null}
    </div>
  );
}
