import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { k8sApi } from './api';
import {
  getK8sNavigationByPath,
  getK8sNavigationGroupItems,
  k8sClusterPath,
  k8sNavigationGroups,
  type K8sNavigationItem,
} from './navigation';

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
  const activeCluster = clusters.find((item) => item.id === clusterId);
  const clusterError = error instanceof Error ? error : error ? new Error('集群列表读取失败') : null;
  const context = {
    activeClusterId: clusterId,
    activeCluster,
    clusters,
    isLoadingClusters,
    clusterError,
  };
  const hasClusterContext = Boolean(clusterId);

  function handleClusterChange(nextClusterId: string) {
    if (!nextClusterId) return;
    const nextRoute = current?.requiresCluster
      ? k8sClusterPath(nextClusterId, current)
      : `/k8s/clusters/${encodeURIComponent(nextClusterId)}`;
    navigate(nextRoute);
  }

  return (
    <div className="min-w-0 space-y-3">
      {hasClusterContext ? (
        <ClusterContextNavigation
          activeClusterId={clusterId}
          activeClusterName={activeCluster?.name || clusterId}
          clusters={clusters}
          current={current}
          onClusterChange={handleClusterChange}
        />
      ) : (
        <FleetNavigation />
      )}
      <Outlet context={context} />
    </div>
  );
}

function FleetNavigation() {
  return (
    <div className="module-navigation-bar">
      <h1 className="page-title module-navigation-title">K8s 运维</h1>
      <nav className="module-navigation-tabs" aria-label="K8s 运维导航">
        <NavLink
          className={({ isActive }) => fleetTabClass(isActive)}
          end
          to="/k8s"
        >
          集群总览
        </NavLink>
        <NavLink
          className={({ isActive }) => fleetTabClass(isActive)}
          to="/k8s/access"
        >
          集群接入
        </NavLink>
      </nav>
    </div>
  );
}

function ClusterContextNavigation({
  activeClusterId,
  activeClusterName,
  clusters,
  current,
  onClusterChange,
}: {
  activeClusterId: string;
  activeClusterName: string;
  clusters: Array<{ id: string; name: string }>;
  current: K8sNavigationItem | undefined;
  onClusterChange: (clusterId: string) => void;
}) {
  const activeGroupId = current?.group ?? 'overview';
  const activeItems = getK8sNavigationGroupItems(activeGroupId).filter((item) => item.requiresCluster);

  return (
    <section className="k8s-context-navigation border-b border-outline bg-surface-lowest" aria-label="K8s 运维导航">
      <div className="flex flex-col gap-2 px-1 py-2 xl:flex-row xl:items-center">
        <div className="flex min-w-0 items-center gap-2">
          <Link className="console-button h-8 shrink-0 px-2.5 text-xs" to="/k8s">
            <ArrowLeft className="h-3.5 w-3.5" />
            返回集群列表
          </Link>
          <div className="relative min-w-0 max-w-64">
            <select
              className="console-input h-8 w-full min-w-40 appearance-none pr-8 text-xs font-semibold"
              aria-label="切换集群"
              value={activeClusterId}
              onChange={(event) => onClusterChange(event.target.value)}
            >
              {clusters.map((cluster) => (
                <option key={cluster.id} value={cluster.id}>{cluster.name || cluster.id}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          </div>
          <span className="hidden truncate font-mono text-[11px] text-muted sm:block" title={activeClusterName}>
            cluster/{activeClusterName}
          </span>
        </div>

        <nav className="k8s-context-groups flex min-w-0 flex-1 items-center gap-1 overflow-x-auto xl:justify-end" aria-label="K8s 功能分组">
          {k8sNavigationGroups.map((group) => {
            const target = getK8sNavigationGroupItems(group.id).find((item) => item.requiresCluster);
            if (!target) return null;
            return (
              <Link
                key={group.id}
                className={[
                  'shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                  group.id === activeGroupId ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-surface hover:text-on-surface',
                ].join(' ')}
                to={k8sClusterPath(activeClusterId, target)}
              >
                {group.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <nav className="k8s-context-items flex min-w-0 gap-1 overflow-x-auto border-t border-outline/70 px-1" aria-label="K8s 当前分组功能">
        {activeItems.map((item) => {
          const Icon = item.icon;
          const selected = current?.id === item.id;
          return (
            <Link
              key={item.id}
              className={[
                'inline-flex h-9 shrink-0 items-center gap-2 border-b-2 px-3 text-xs font-semibold transition-colors',
                selected ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-on-surface',
              ].join(' ')}
              to={k8sClusterPath(activeClusterId, item)}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </section>
  );
}

function fleetTabClass(isActive: boolean) {
  return [
    'module-navigation-link px-3 text-sm font-semibold transition-colors',
    isActive ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-on-surface',
  ].join(' ');
}
