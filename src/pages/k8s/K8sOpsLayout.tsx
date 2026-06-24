import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, ChevronDown, RefreshCw } from 'lucide-react';
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
      <>
      <details className="console-panel group overflow-hidden xl:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5">
          <div>
            <div className="text-sm font-semibold text-on-surface">K8s 工作台导航</div>
            <div className="mt-0.5 font-mono text-[11px] text-muted">{activeClusterId} · {current?.label ?? 'Dashboard'}</div>
          </div>
          <ChevronDown className="h-4 w-4 text-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className="max-h-[58vh] overflow-y-auto border-t border-outline p-3">
          <ClusterNavigation activeClusterId={activeClusterId} />
        </div>
      </details>
      <aside className="console-panel relative hidden overflow-hidden p-3 xl:block">
        <div className="relative border-b border-outline/70 px-2 pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="page-title">K8s 运维</div>
              <div className="mt-1 font-mono text-[11px] text-muted">{activeClusterId ? `cluster/${activeClusterId}` : 'Fleet / registered clusters'}</div>
            </div>
            <Link className="console-button px-2" aria-label="切换集群" to="/k8s">
              <ChevronDown className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <StatusCell label="API" value={activeCluster ? activeCluster.status || 'unknown' : isLoadingClusters ? 'loading' : 'fleet'} />
            <StatusCell label="Mode" value={activeCluster ? `${activeCluster.accessMode || 'direct'}${activeCluster.readOnly ? '/ro' : '/rw'}` : `${clusters.length} clusters`} />
          </div>
        </div>

        <ClusterNavigation activeClusterId={activeClusterId} />
      </aside>
      </>
      ) : null}

      <div className="min-w-0 space-y-4">
        <div className="console-panel flex flex-col justify-between gap-3 px-4 py-2.5 md:flex-row md:items-center">
          <div className="min-w-0">
            <h1 className="page-title">{current?.label ?? 'Dashboard'}</h1>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="status-badge border-primary/20 bg-primary-soft text-primary">
              <CheckCircle2 className="h-3.5 w-3.5" />
              权限接入 NovaObs RBAC
            </span>
            <span className="status-badge border-outline bg-surface text-muted">
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

function ClusterNavigation({ activeClusterId }: { activeClusterId: string }) {
  return (
    <nav className="relative mt-1 space-y-5 xl:mt-4">
      {k8sNavigationGroups.map((group) => (
        <div key={group.id}>
          <div className="mb-2 px-2 text-[11px] font-semibold text-muted">{group.label}</div>
          <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-1">
            {getK8sNavigationGroupItems(group.id).filter((item) => item.requiresCluster).map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.id}
                  to={k8sClusterPath(activeClusterId, item)}
                  end={item.id === 'dashboard'}
                  className={({ isActive }) =>
                    [
                      'group flex min-h-9 items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors active:translate-y-px',
                      isActive ? 'atlas-nav-active text-primary' : 'text-muted hover:bg-surface hover:text-on-surface',
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
  );
}

function FleetTabs({ activePath }: { activePath: string }) {
  const tabs = [
    { path: '/k8s', label: '集群总览' },
    { path: '/k8s/access', label: '集群接入' },
  ];
  return (
    <div className="console-panel flex flex-wrap items-center gap-1.5 p-2">
      {tabs.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          className={[
            'inline-flex h-8 min-w-28 items-center justify-center rounded-md border px-3 text-xs font-semibold transition-colors active:translate-y-px',
            activePath === item.path ? 'border-primary bg-primary text-white' : 'border-transparent bg-surface-lowest text-muted hover:border-outline hover:bg-surface hover:text-primary',
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
          <Link className="console-button" to="/k8s">
            <ArrowLeft className="h-3.5 w-3.5" />
            返回集群列表
          </Link>
        </div>
      </div>
      <label className="min-w-56 text-xs font-semibold text-muted">
        切换集群
        <select
          className="console-input mt-2 w-full"
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
    <div className="rounded-md border border-outline bg-surface px-2.5 py-2">
      <div className="text-muted">{label}</div>
      <div className="mt-1 font-mono font-semibold text-on-surface">{value}</div>
    </div>
  );
}
