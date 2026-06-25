import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Bell, Search, ServerCog } from 'lucide-react';

const logsNav = [
  { to: '/logs/explore', label: '日志分析', meta: '下游查询', icon: Search },
  { to: '/logs/agents', label: '采集路由', icon: ServerCog },
  { to: '/logs/alerts', label: '日志告警', icon: Bell },
];

function LogsWorkspace() {
  const location = useLocation();

  return (
    <div className="logs-workbench route-transition-page flex h-full min-h-0 flex-col gap-3">
      <div className="module-navigation-bar shrink-0">
        <h1 className="page-title module-navigation-title truncate">Logs</h1>
        <nav className="module-navigation-tabs" aria-label="Logs 模块导航">
          {logsNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `module-navigation-link gap-2 px-3 text-sm font-semibold transition-colors ${
                  isActive ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-on-surface'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
                {'meta' in item ? <span className="hidden font-mono text-[11px] font-medium text-primary/70 2xl:inline">{item.meta}</span> : null}
              </NavLink>
            );
          })}
        </nav>
      </div>
      <div className="route-transition-page min-h-0 flex-1" key={location.pathname}>
        <Outlet />
      </div>
    </div>
  );
}

export default LogsWorkspace;
