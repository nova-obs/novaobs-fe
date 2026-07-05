import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface ModuleRailItem {
  to: string;
  label: string;
  description?: string;
  icon: LucideIcon;
}

interface ModuleRailProps {
  items: ModuleRailItem[];
  ariaLabel: string;
  storageKey: string;
}

export function ModuleRail({ items, ariaLabel, storageKey }: ModuleRailProps) {
  const [expanded, setExpanded] = useState<boolean>(() => readExpandedPreference(storageKey));
  const railRef = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, expanded ? '1' : '0');
    } catch {
      // ignore quota / privacy errors
    }
  }, [expanded, storageKey]);

  useEffect(() => {
    if (!expanded) return undefined;
    function onOutsidePointer(event: MouseEvent) {
      if (!railRef.current) return;
      if (railRef.current.contains(event.target as Node)) return;
      setExpanded(false);
    }
    const timer = window.setTimeout(() => {
      document.addEventListener('mousedown', onOutsidePointer);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mousedown', onOutsidePointer);
    };
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return undefined;
    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setExpanded(false);
    }
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [expanded]);

  const ToggleIcon = expanded ? ChevronsLeft : ChevronsRight;

  return (
    <aside
      ref={railRef}
      className={`module-rail ${expanded ? 'module-rail-expanded' : 'module-rail-collapsed'}`}
      aria-label={ariaLabel}
      data-expanded={expanded ? 'true' : 'false'}
    >
      <nav className="module-rail-nav" aria-label={ariaLabel}>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `module-rail-link ${isActive ? 'is-active' : ''}`}
              end={false}
            >
              <Icon className="module-rail-link-icon" aria-hidden />
              <span className="module-rail-link-label">{item.label}</span>
              <span className="module-rail-link-tip" role="tooltip" aria-hidden>
                <span className="module-rail-link-tip-label">{item.label}</span>
                {item.description ? (
                  <span className="module-rail-link-tip-desc">{item.description}</span>
                ) : null}
              </span>
            </NavLink>
          );
        })}
      </nav>
      <button
        type="button"
        className="module-rail-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-label={expanded ? '收起模块导航' : '展开模块导航'}
        aria-expanded={expanded}
      >
        <ToggleIcon className="h-4 w-4" aria-hidden />
        <span className="module-rail-toggle-label">收起</span>
      </button>
    </aside>
  );
}

function readExpandedPreference(storageKey: string): boolean {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw === '0') return false;
    if (raw === '1') return true;
    return true;
  } catch {
    return true;
  }
}
