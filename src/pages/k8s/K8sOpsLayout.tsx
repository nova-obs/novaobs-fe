import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, ChevronDown, CircleDot, RefreshCw } from 'lucide-react';
import { k8sApi } from './api';
import { getK8sNavigationByPath, getK8sNavigationGroupItems, k8sClusterPath, k8sNavigationGroups } from './navigation';

export function K8sOpsLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { clusterId = '' } = useParams();
  const current = getK8sNavigationByPath(location.pathname);
  const { data: clusters = [], isLoading: isLoadingClusters, error } = useQuery({
    queryKey: ['k8s-clusters'],
    queryFn: () => k8sApi.listClusters(),
    retry: false,
  });
  const activeClusterId = clusterId;
  const activeCluster = clusters.find((item) => item.id === activeClusterId);
  const clusterError = error instanceof Error ? error : error ? new Error('集群列表读取失败') : null;
  const context = { activeClusterId, activeCluster, clusters, isLoadingClusters, clusterError };
  const hasClusterContext = Boolean(activeClusterId);
  const isAccessView = location.pathname === '/k8s/access';

  function handleClusterChange(nextClusterId: string) {
    if (!nextClusterId) {
      return;
    }
    const nextRoute = current?.requiresCluster ? k8sClusterPath(nextClusterId, current) : `/k8s/clusters/${encodeURIComponent(nextClusterId)}`;
    navigate(nextRoute);
  }

  return (
    <div className={hasClusterContext ? 'grid gap-4 xl:grid-cols-[248px_minmax(0,1fr)]' : 'space-y-4'}>
      {hasClusterContext ? (
      <aside className="console-panel relative overflow-hidden p-3">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[radial-gradient(ellipse_at_20%_10%,rgba(13,91,215,0.13),transparent_58%),radial-gradient(ellipse_at_86%_20%,rgba(0,164,255,0.12),transparent_48%)]" />
        <div className="relative rounded-lg bg-white/42 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-display text-lg font-semibold tracking-tight text-on-surface">K8s 运维</div>
              <div className="mt-1 font-mono text-[11px] text-muted">{activeClusterId ? `cluster/${activeClusterId}` : 'Fleet / registered clusters'}</div>
            </div>
            <Link className="quiet-button h-8 px-2 text-xs text-muted hover:bg-white/70 hover:text-primary" aria-label="切换集群" to="/k8s">
              <ChevronDown className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <StatusCell label="API" value={activeCluster ? activeCluster.status || 'unknown' : isLoadingClusters ? 'loading' : 'fleet'} />
            <StatusCell label="Mode" value={activeCluster ? `${activeCluster.accessMode || 'direct'}${activeCluster.readOnly ? '/ro' : '/rw'}` : `${clusters.length} clusters`} />
          </div>
        </div>

        <nav className="relative mt-4 space-y-5">
          {k8sNavigationGroups.map((group) => (
            <div key={group.id}>
              <div className="mb-2 px-2 text-[11px] font-semibold text-muted">{group.label}</div>
              <div className="space-y-1">
                {getK8sNavigationGroupItems(group.id).filter((item) => item.requiresCluster).map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.id}
                      to={k8sClusterPath(activeClusterId, item)}
                      end={item.id === 'dashboard'}
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
      ) : null}

      <div className="min-w-0 space-y-4">
        <div className="console-panel flex flex-col justify-between gap-3 px-4 py-3 md:flex-row md:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              <CircleDot className="h-3.5 w-3.5" />
              Kubernetes Operations
            </div>
            <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-on-surface">{current?.label ?? 'Dashboard'}</h1>
            <p className="mt-1 text-sm text-muted">
              {activeCluster ? `${activeCluster.name || activeCluster.id} · ${current?.description ?? '集群态势与资源变更入口。'}` : current?.description ?? '选择集群后展开资源、访问控制和交付运维能力。'}
            </p>
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

        {hasClusterContext ? (
          <ClusterWorkspaceBar
            activeClusterId={activeClusterId}
            activeClusterName={activeCluster?.name || activeClusterId}
            clusters={clusters}
            currentLabel={current?.label ?? 'Dashboard'}
            onClusterChange={handleClusterChange}
          />
        ) : (
          <FleetTabs activePath={isAccessView ? '/k8s/access' : '/k8s'} />
        )}

        <Outlet context={context} />
      </div>
    </div>
  );
}

function FleetTabs({ activePath }: { activePath: string }) {
  const tabs = [
    { path: '/k8s', label: '集群总览' },
    { path: '/k8s/access', label: '集群接入' },
  ];
  return (
    <div className="console-panel flex flex-wrap items-center gap-2 px-3 py-3">
      {tabs.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          className={[
            'inline-flex h-10 min-w-32 items-center justify-center rounded-lg px-4 text-sm font-semibold shadow-[inset_0_0_0_1px_rgba(216,226,239,0.9)] transition-all active:translate-y-px',
            activePath === item.path ? 'bg-primary text-white shadow-[0_10px_24px_rgba(13,91,215,0.18)]' : 'bg-white/70 text-muted hover:bg-white hover:text-primary',
          ].join(' ')}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

function ClusterWorkspaceBar({
  activeClusterId,
  activeClusterName,
  clusters,
  currentLabel,
  onClusterChange,
}: {
  activeClusterId: string;
  activeClusterName: string;
  clusters: Array<{ id: string; name: string }>;
  currentLabel: string;
  onClusterChange: (clusterId: string) => void;
}) {
  return (
    <div className="console-panel flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <Link className="font-semibold text-primary hover:underline" to="/k8s">K8s 运维</Link>
          <span>/</span>
          <span className="font-mono font-semibold text-on-surface">{activeClusterName}</span>
          <span>/</span>
          <span>{currentLabel}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Link className="quiet-button h-9 bg-white/65 px-3 text-xs text-muted hover:text-primary" to="/k8s">
            <ArrowLeft className="h-3.5 w-3.5" />
            返回集群列表
          </Link>
        </div>
      </div>
      <label className="min-w-56 text-xs font-semibold text-muted">
        切换集群
        <select
          className="console-input mt-2 h-9 w-full bg-white/70"
          value={activeClusterId}
          onChange={(event) => onClusterChange(event.target.value)}
        >
          {clusters.map((cluster) => (
            <option key={cluster.id} value={cluster.id}>{cluster.name || cluster.id}</option>
          ))}
        </select>
      </label>
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
