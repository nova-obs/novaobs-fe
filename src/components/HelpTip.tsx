import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle } from 'lucide-react';

interface HelpTipProps {
  content: ReactNode;
  label?: string;
  className?: string;
}

export function HelpTip({ content, label = '查看说明', className = '' }: HelpTipProps) {
  const tooltipId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ above: false, left: 8, top: 8 });

  function show() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const maxLeft = Math.max(8, window.innerWidth - 328);
      const spaceBelow = window.innerHeight - rect.bottom;
      const above = spaceBelow < 240 && rect.top > spaceBelow;
      setPosition({ above, left: Math.max(8, Math.min(rect.left, maxLeft)), top: above ? rect.top - 6 : rect.bottom + 6 });
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  const tooltip = (
    <span
      id={tooltipId}
      role="tooltip"
      style={{
        left: position.left,
        top: position.top,
        transform: position.above ? 'translateY(-100%)' : undefined,
      }}
      className={`pointer-events-none fixed z-[120] max-h-[calc(100vh-1rem)] w-80 max-w-[calc(100vw-1rem)] overflow-auto rounded-md border border-outline bg-surface-lowest px-3 py-2 text-left text-xs font-normal leading-5 text-on-surface shadow-[0_16px_36px_-18px_rgba(18,32,51,0.45)] transition ${open ? 'visible opacity-100' : 'invisible opacity-0'}`}
    >
      {content}
    </span>
  );

  return (
    <span
      className={`group relative inline-flex ${className}`}
      onMouseEnter={() => {
        if (window.matchMedia('(hover: hover)').matches) show();
      }}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-outline bg-surface-lowest text-muted transition group-hover:border-primary/40 group-hover:text-primary group-focus-within:border-primary/40 group-focus-within:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        aria-label={label}
        aria-describedby={tooltipId}
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : show())}
        onFocus={(event) => {
          if (event.currentTarget.matches(':focus-visible')) show();
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
      >
        <HelpCircle className="h-3 w-3" aria-hidden />
      </button>
      {typeof document === 'undefined' ? tooltip : createPortal(tooltip, document.body)}
    </span>
  );
}
