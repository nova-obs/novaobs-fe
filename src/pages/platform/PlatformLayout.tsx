import { NavLink, Outlet } from 'react-router-dom';
import { RadioTower, ShieldCheck } from 'lucide-react';

const platformNav = [
  { to: '/platform/access', label: '访问控制', meta: 'IAM / RBAC', icon: ShieldCheck },
  { to: '/platform/observability', label: '观测接入配置', meta: '日志下游', icon: RadioTower },
];

export function PlatformLayout() {
  return (
    <div className="grid gap-4 xl:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="console-panel relative overflow-hidden p-3">
        <div className="relative rounded-lg bg-white/52 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Platform</div>
          <h1 className="mt-1 font-display text-lg font-semibold tracking-tight text-on-surface">平台管理</h1>
          <div className="mt-2 font-mono text-[11px] text-muted">IAM · Settings · Audit</div>
        </div>
        <nav className="relative mt-4 space-y-1" aria-label="平台管理导航">
          {platformNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    'group flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all active:translate-y-px',
                    isActive ? 'atlas-nav-active text-primary' : 'text-muted hover:bg-white/45 hover:text-on-surface',
                  ].join(' ')
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <span className="hidden rounded border border-outline bg-white/60 px-1.5 py-0.5 font-mono text-[10px] text-muted 2xl:inline">{item.meta}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0 space-y-4">
        <div className="console-panel px-4 py-3">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-on-surface">平台管理</h2>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
