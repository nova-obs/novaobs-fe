import type { PropsWithChildren } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Bell, CheckCircle2, ChevronDown, CircleHelp, Clock3, RadioTower, Search, Settings, Sparkles, UserCircle2 } from 'lucide-react';
import { getNavigationByPath, primaryNavigation } from './navigation';

export function AppShell({ children }: PropsWithChildren) {
  const location = useLocation();
  const current = getNavigationByPath(location.pathname);

  return (
    <div className="relative flex min-h-[100dvh] overflow-hidden bg-app-radial text-on-surface">
      <div className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:linear-gradient(115deg,transparent_0%,rgba(31,122,118,0.14)_38%,transparent_64%),linear-gradient(25deg,transparent_12%,rgba(88,127,67,0.12)_46%,transparent_72%)]" />
      <aside className="relative hidden w-64 shrink-0 flex-col p-4 md:flex">
        <div className="atlas-sidebar-panel flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-80 opacity-70 [background-image:radial-gradient(ellipse_at_16%_92%,rgba(31,122,118,0.18),transparent_42%),radial-gradient(ellipse_at_78%_96%,rgba(88,127,67,0.1),transparent_38%)]" />
          <div className="pointer-events-none absolute -bottom-16 -left-14 h-72 w-72 rounded-full border border-primary/10 opacity-70" />
          <div className="pointer-events-none absolute bottom-10 left-2 h-40 w-52 rotate-[-12deg] rounded-[55%] bg-primary/[0.055] blur-2xl" />
          <div className="relative px-5 py-6">
            <div className="inline-flex items-center gap-2 rounded-lg bg-primary-soft/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Telemetry Atlas
            </div>
            <div className="mt-4 font-display text-xl font-semibold tracking-tight text-on-surface">NovaObs</div>
            <div className="mt-1 text-xs font-medium text-muted">统一可观测性控制面</div>
          </div>
          <div className="relative mx-4 mb-4 rounded-lg bg-white/35 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <span className="h-2 w-2 rounded-full bg-primary/70" />
              生产观测域
            </div>
            <div className="mt-1 font-mono text-[11px] text-muted">Prod / CN-SHANGHAI-A</div>
          </div>
          <nav className="relative flex-1 space-y-1 overflow-y-auto px-3">
            {primaryNavigation.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  className={({ isActive }) =>
                    [
                      'group flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-all active:translate-y-px',
                      isActive
                        ? 'atlas-nav-active text-primary'
                        : 'text-muted hover:bg-white/45 hover:text-on-surface',
                    ].join(' ')
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
          <div className="relative mx-4 mb-4 rounded-lg bg-white/40 px-4 py-3 text-xs text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
            <div className="font-semibold text-on-surface">System Health</div>
            <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[11px]">
              <span>API 42ms</span>
              <span>1.2k/s</span>
            </div>
          </div>
        </div>
      </aside>
      <main className="relative flex min-w-0 flex-1 flex-col p-3 md:pl-0">
        <header className="console-panel mb-3 grid min-h-14 shrink-0 grid-cols-[minmax(220px,420px)_1fr] items-center gap-4 px-4 py-2 md:px-6">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              className="h-9 w-full rounded-lg border border-outline/60 bg-white/55 pl-9 pr-12 text-sm text-on-surface outline-none transition-all placeholder:text-muted/60 focus:border-primary/50 focus:bg-white/85 focus:ring-2 focus:ring-primary/10"
              placeholder="搜索服务、指标、日志、告警"
              aria-label="搜索服务、指标、日志、告警"
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-surface-low px-1.5 py-0.5 font-mono text-[11px] text-muted">⌘K</span>
          </div>
          <div className="flex min-w-0 items-center justify-end gap-2 text-muted">
            <StatusPill tone="green"><span className="h-1.5 w-1.5 rounded-full bg-primary" />平台运行正常</StatusPill>
            <StatusPill><CheckCircle2 className="h-3.5 w-3.5 text-primary" />配置已同步</StatusPill>
            <StatusPill><Clock3 className="h-3.5 w-3.5" />最近 15 分钟<ChevronDown className="h-3.5 w-3.5" /></StatusPill>
            <IconButton label="采集状态"><RadioTower className="h-4 w-4 text-primary" /></IconButton>
            <IconButton label="帮助"><CircleHelp className="h-4 w-4" /></IconButton>
            <IconButton label="通知"><Bell className="h-4 w-4" /></IconButton>
            <IconButton label="设置"><Settings className="h-4 w-4" /></IconButton>
            <button className="hidden items-center gap-2 rounded-lg bg-white/60 px-2.5 py-1.5 text-xs font-semibold text-on-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] transition-all hover:bg-white/85 lg:inline-flex" aria-label="系统管理员">
              <UserCircle2 className="h-4 w-4 text-muted" />
              <span>系统管理员</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted" />
            </button>
          </div>
        </header>
        <nav className="mb-2 flex gap-2 overflow-x-auto px-1 md:hidden">
          {primaryNavigation.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) =>
                [
                  'shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition-all',
                  isActive ? 'atlas-nav-active text-primary' : 'bg-white/55 text-muted',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <section className="min-h-0 flex-1 overflow-y-auto rounded-lg px-1 py-2 md:px-3 md:py-4">{children}</section>
      </main>
    </div>
  );
}

function StatusPill({ children, tone }: PropsWithChildren<{ tone?: 'green' }>) {
  return (
    <span className={`hidden h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] xl:inline-flex ${
      tone === 'green'
        ? 'border-primary/20 bg-primary-soft/60 text-primary'
        : 'border-outline/60 bg-white/55 text-on-surface'
    }`}
    >
      {children}
    </span>
  );
}

function IconButton({ label, children }: PropsWithChildren<{ label: string }>) {
  return (
    <button className="quiet-button h-9 w-9 p-0 text-muted hover:bg-white/70 hover:text-primary" title={label} aria-label={label}>
      {children}
    </button>
  );
}
