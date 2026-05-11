import type { PropsWithChildren } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Bell, CircleHelp, RadioTower, Search, Settings } from 'lucide-react';
import { getNavigationByPath, primaryNavigation } from './navigation';

export function AppShell({ children }: PropsWithChildren) {
  const location = useLocation();
  const current = getNavigationByPath(location.pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-on-surface">
      <aside className="flex w-60 shrink-0 flex-col border-r border-outline bg-surface-container">
        <div className="px-6 py-7">
          <div className="font-display text-lg font-semibold text-on-surface">Observability Hub</div>
          <div className="mt-1 text-xs font-medium text-muted">Enterprise Edition</div>
        </div>
        <div className="mx-4 mb-4 rounded-lg border border-outline bg-surface-low px-3 py-3">
          <div className="text-xs font-semibold text-primary">生产观测域</div>
          <div className="mt-1 text-xs text-muted">Prod / CN-SHANGHAI-A</div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {primaryNavigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.id}
                to={item.path}
                className={({ isActive }) =>
                  [
                    'flex h-10 items-center gap-3 rounded-lg border-l-4 px-3 text-sm transition-colors',
                    isActive
                      ? 'border-primary bg-primary-soft font-semibold text-primary'
                      : 'border-transparent text-muted hover:bg-surface-low hover:text-on-surface',
                  ].join(' ')
                }
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="border-t border-outline px-4 py-3 text-xs text-muted">
          <div className="font-semibold text-on-surface">System Health: API Latency 42ms</div>
          <div className="mt-1">Ingest Rate 1.2k/s</div>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-outline bg-surface-container px-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input className="console-input w-80 pl-9" placeholder="搜索服务、trace_id、request_id..." />
            </div>
            <span className="hidden text-xs font-medium text-muted lg:inline">{current?.description ?? '平台控制面'}</span>
          </div>
          <div className="flex items-center gap-4 text-muted">
            <RadioTower className="h-4 w-4 text-primary" />
            <CircleHelp className="h-4 w-4 hover:text-primary" />
            <Bell className="h-4 w-4 hover:text-primary" />
            <Settings className="h-4 w-4 hover:text-primary" />
          </div>
        </header>
        <section className="min-h-0 flex-1 overflow-y-auto p-6">{children}</section>
      </main>
    </div>
  );
}
