import { NavLink, Outlet } from 'react-router-dom';
import { ActivitySquare, ClipboardList, RadioTower, ShieldCheck, SlidersHorizontal } from 'lucide-react';

const platformNav = [
  { to: '/platform/access', label: '访问控制', meta: 'IAM / RBAC', icon: ShieldCheck },
  { to: '/platform/observability', label: '观测接入配置', meta: '日志下游', icon: RadioTower },
  { to: '/platform/agent-policies', label: 'Agent 部署策略', meta: '后续', icon: SlidersHorizontal, disabled: true },
  { to: '/platform/cluster-policies', label: '集群平台策略', meta: '后续', icon: ActivitySquare, disabled: true },
  { to: '/platform/audit', label: '审计记录', meta: '后续', icon: ClipboardList, disabled: true },
];

export function PlatformLayout() {
  const activeItems = platformNav.filter((item) => !item.disabled);
  const plannedItems = platformNav.filter((item) => item.disabled);

  return (
    <div className="grid gap-4 xl:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="console-panel relative overflow-hidden p-3">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[linear-gradient(135deg,rgba(13,91,215,0.12),transparent_58%),radial-gradient(ellipse_at_80%_12%,rgba(0,164,255,0.12),transparent_45%)]" />
        <div className="relative rounded-lg bg-white/52 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Platform</div>
          <h1 className="mt-1 font-display text-lg font-semibold tracking-tight text-on-surface">平台管理</h1>
          <div className="mt-2 font-mono text-[11px] text-muted">IAM · Settings · Audit</div>
        </div>
        <nav className="relative mt-4 space-y-1" aria-label="平台管理导航">
          {activeItems.map((item) => {
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
        <div className="relative mt-5 rounded-lg border border-outline bg-white/48 p-2">
          <div className="px-1 pb-2 text-[11px] font-semibold text-muted">后续配置域</div>
          <div className="space-y-1">
            {plannedItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.to} className="grid min-h-9 grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted/75">
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  <span className="rounded border border-outline bg-white/68 px-1.5 py-0.5 font-mono text-[10px]">{item.meta}</span>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      <div className="min-w-0 space-y-4">
        <div className="console-panel flex flex-col justify-between gap-3 px-4 py-3 md:flex-row md:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              Platform Control Plane
            </div>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-on-surface">平台管理</h2>
            <p className="mt-1 text-sm text-muted">集中维护访问控制、观测接入和平台运行策略。</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary-soft/70 px-3 font-semibold text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
              <ShieldCheck className="h-3.5 w-3.5" />
              RBAC enabled
            </span>
            <span className="inline-flex h-9 items-center gap-2 rounded-lg bg-white/55 px-3 font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
              <RadioTower className="h-3.5 w-3.5" />
              Observability settings
            </span>
          </div>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
