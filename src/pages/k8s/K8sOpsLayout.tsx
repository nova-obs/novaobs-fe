import { NavLink, useLocation } from 'react-router-dom';
import { CheckCircle2, ChevronDown, CircleDot, RefreshCw } from 'lucide-react';
import { DashboardPage } from './DashboardPage';
import { getK8sNavigationByPath, getK8sNavigationGroupItems, k8sNavigationGroups } from './navigation';

export function K8sOpsLayout() {
  const location = useLocation();
  const current = getK8sNavigationByPath(location.pathname);

  return (
    <div className="grid gap-4 xl:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="console-panel relative overflow-hidden p-3">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[radial-gradient(ellipse_at_20%_10%,rgba(31,122,118,0.13),transparent_58%),radial-gradient(ellipse_at_86%_20%,rgba(88,127,67,0.12),transparent_48%)]" />
        <div className="relative rounded-lg bg-white/42 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-display text-lg font-semibold tracking-tight text-on-surface">K8s 运维</div>
              <div className="mt-1 font-mono text-[11px] text-muted">Prod / CN-SHANGHAI-A</div>
            </div>
            <button className="quiet-button h-8 px-2 text-xs text-muted hover:bg-white/70 hover:text-primary" aria-label="切换集群">
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <StatusCell label="API" value="unknown" />
            <StatusCell label="Sync" value="pending" />
          </div>
        </div>

        <nav className="relative mt-4 space-y-5">
          {k8sNavigationGroups.map((group) => (
            <div key={group.id}>
              <div className="mb-2 px-2 text-[11px] font-semibold text-muted">{group.label}</div>
              <div className="space-y-1">
                {getK8sNavigationGroupItems(group.id).map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.id}
                      to={item.path}
                      end={item.path === '/k8s'}
                      className={({ isActive }) =>
                        [
                          'group flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all active:translate-y-px',
                          isActive ? 'atlas-nav-active text-primary' : 'text-muted hover:bg-white/45 hover:text-on-surface',
                        ].join(' ')
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 space-y-4">
        <div className="console-panel flex flex-col justify-between gap-3 px-4 py-3 md:flex-row md:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              <CircleDot className="h-3.5 w-3.5" />
              Kubernetes Operations
            </div>
            <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-on-surface">{current?.label ?? 'Dashboard'}</h1>
            <p className="mt-1 text-sm text-muted">{current?.description ?? '集群态势与资源变更入口。'}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary-soft/70 px-3 font-semibold text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              权限接入 NovaObs RBAC
            </span>
            <span className="inline-flex h-9 items-center gap-2 rounded-lg bg-white/55 px-3 font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
              <RefreshCw className="h-3.5 w-3.5" />
              最近 15 分钟
            </span>
          </div>
        </div>

        {current?.id === 'dashboard' ? <DashboardPage /> : <ComingSoon title={current?.label ?? '模块'} />}
      </div>
    </div>
  );
}

function StatusCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/48 px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
      <div className="text-muted">{label}</div>
      <div className="mt-1 font-mono font-semibold text-on-surface">{value}</div>
    </div>
  );
}

function ComingSoon({ title }: { title: string }) {
  return (
    <section className="console-panel min-h-[420px] p-5">
      <div className="max-w-xl">
        <h2 className="font-display text-lg font-semibold tracking-tight text-on-surface">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          当前入口已纳入统一导航，后续会按 startorch 功能矩阵逐项迁移，接入 NovaObs RBAC、Secret、Audit 与统一 API envelope。
        </p>
      </div>
    </section>
  );
}
