import type { PropsWithChildren, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { ModuleRail, moduleRailStorageKey, type ModuleRailItem, type ModuleRailModuleId } from './ModuleRail';

interface ModuleWorkbenchProps extends PropsWithChildren {
  module: ModuleRailModuleId;
  title: string;
  ariaLabel: string;
  items: ModuleRailItem[];
  showRail?: boolean;
  toolbar?: ReactNode;
  /**
   * When true, the outlet subtree is unmounted+remounted on every pathname change
   * (so per-page transient state resets). Off by default — only Logs opts in for its
   * route-transition animation. Other modules must preserve sub-page state across
   * intra-layout navigation.
   */
  remountOnPathChange?: boolean;
}

export function ModuleWorkbench({
  module,
  title,
  ariaLabel,
  items,
  showRail = true,
  toolbar,
  remountOnPathChange = false,
  children,
}: ModuleWorkbenchProps) {
  const location = useLocation();
  const outletKey = remountOnPathChange ? location.pathname : undefined;

  return (
    <div
      className="module-workbench route-transition-page relative flex h-full min-h-0"
      data-module={module}
      data-rail={showRail ? 'true' : 'false'}
    >
      <h1 className="sr-only">{title}</h1>
      {showRail ? (
        <ModuleRail items={items} ariaLabel={ariaLabel} storageKey={moduleRailStorageKey(module)} />
      ) : null}
      <div
        className={`module-workbench-outlet route-transition-page min-h-0 flex-1 ${toolbar ? 'flex flex-col gap-3' : ''}`}
        key={outletKey}
      >
        {toolbar}
        {children}
      </div>
    </div>
  );
}
