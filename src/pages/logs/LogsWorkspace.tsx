import { NavLink, Outlet } from 'react-router-dom';
import { Bell, Clock, Database, RadioTower, RefreshCw, Search, ServerCog } from 'lucide-react';

const logsNav = [
  { to: '/logs/explore', label: '日志分析', meta: 'VMUI / VictoriaLogs', icon: Search },
  { to: '/logs/onboarding', label: '接入配置', icon: RadioTower },
  { to: '/logs/agents', label: '采集 Agent', icon: ServerCog },
  { to: '/logs/alerts', label: '日志告警', icon: Bell },
];

function LogsWorkspace() {
  return (
    <div className="logs-workbench space-y-3 route-transition-page">
      <div className="console-panel overflow-hidden">
        <div className="grid gap-3 border-b border-outline/70 bg-white/76 px-3 py-3 xl:grid-cols-[minmax(180px,260px)_1fr_auto] xl:items-center">
          <div className="min-w-0">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Logs</div>
            <h1 className="mt-0.5 truncate text-lg font-semibold tracking-tight text-on-surface">日志工作台</h1>
          </div>
          <nav className="flex min-w-0 gap-1 overflow-x-auto" aria-label="Logs 模块导航">
            {logsNav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `inline-flex h-9 min-w-max items-center gap-2 rounded-md border px-3 text-sm font-semibold transition-all active:translate-y-px ${
                    isActive ? 'border-primary bg-primary-soft text-primary' : 'border-transparent text-muted hover:border-outline hover:bg-white/86 hover:text-on-surface'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                  {'meta' in item ? <span className="hidden font-mono text-[11px] font-medium text-primary/70 2xl:inline">{item.meta}</span> : null}
                </NavLink>
              );
            })}
          </nav>
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
            <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-outline bg-white/85 px-2.5 font-semibold text-muted">
              <Database className="h-3.5 w-3.5 text-primary" />
              VictoriaLogs
            </span>
            <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-outline bg-white/85 px-2.5 font-semibold text-muted">
              <Clock className="h-3.5 w-3.5" />
              15m
            </span>
            <button className="inline-flex h-8 items-center gap-1.5 rounded-md border border-outline bg-white/85 px-2.5 font-semibold text-muted transition hover:border-primary/40 hover:text-on-surface" onClick={() => window.location.reload()}>
              <RefreshCw className="h-3.5 w-3.5" />
              刷新
            </button>
          </div>
        </div>
      </div>
      <div className="route-transition-page">
        <Outlet />
      </div>
    </div>
  );
}

export default LogsWorkspace;
