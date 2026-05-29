import { NavLink, Outlet } from 'react-router-dom';
import { Activity, Bell, Clock, Database, RadioTower, Search, ServerCog } from 'lucide-react';

const logsNav = [
  { to: '/logs/explore', label: '日志分析', meta: 'VMUI / VictoriaLogs', icon: Search },
  { to: '/logs/onboarding', label: '接入配置', icon: RadioTower },
  { to: '/logs/agents', label: '采集 Agent', icon: ServerCog },
  { to: '/logs/alerts', label: '日志告警', icon: Bell },
];

function LogsWorkspace() {
  return (
    <div className="space-y-4 route-transition-page">
      <div className="console-panel overflow-hidden">
        <div className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Logs</div>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-on-surface">日志控制台</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded border border-primary/20 bg-primary-soft px-2.5 py-1.5 font-semibold text-primary">
              <Activity className="h-3.5 w-3.5" />
              采集策略同步
            </span>
            <span className="inline-flex items-center gap-1.5 rounded border border-outline bg-white/85 px-2.5 py-1.5 font-semibold text-muted">
              <Database className="h-3.5 w-3.5" />
              VictoriaLogs
            </span>
            <span className="inline-flex items-center gap-1.5 rounded border border-outline bg-white/85 px-2.5 py-1.5 font-semibold text-muted">
              <Clock className="h-3.5 w-3.5" />
              最近 15 分钟
            </span>
          </div>
        </div>
        <div className="border-t border-outline/70 bg-white/62 px-2">
          <nav className="flex gap-1 overflow-x-auto" aria-label="Logs 模块导航">
          {logsNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `relative inline-flex min-w-max items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-all active:translate-y-px ${
                  isActive ? 'border-primary bg-primary-soft/70 text-primary' : 'border-transparent text-muted hover:bg-surface-low/80 hover:text-on-surface'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
                {'meta' in item ? <span className="hidden font-mono text-[11px] font-medium text-primary/70 md:inline">{item.meta}</span> : null}
              </NavLink>
            );
          })}
          </nav>
        </div>
      </div>
      <div className="route-transition-page">
        <Outlet />
      </div>
    </div>
  );
}

export default LogsWorkspace;
