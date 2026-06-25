import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Check, ChevronDown } from 'lucide-react';
import { k8sApi } from './api';
import {
  getK8sNavigationByPath,
  getK8sNavigationGroupItems,
  k8sClusterPath,
  k8sNavigationGroups,
  type K8sNavigationGroup,
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

  function handleFunctionChange(item: K8sNavigationItem) {
    navigate(k8sClusterPath(clusterId, item));
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
          onFunctionChange={handleFunctionChange}
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
  onFunctionChange,
}: {
  activeClusterId: string;
  activeClusterName: string;
  clusters: Array<{ id: string; name: string }>;
  current: K8sNavigationItem | undefined;
  onClusterChange: (clusterId: string) => void;
  onFunctionChange: (item: K8sNavigationItem) => void;
}) {
  const location = useLocation();
  const activeGroupId = current?.group ?? 'overview';
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  useEffect(() => {
    setOpenGroupId(null);
  }, [location.pathname]);

  useEffect(() => {
    if (!openGroupId) return undefined;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenGroupId(null);
      }
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [openGroupId]);

  return (
    <section className="k8s-context-navigation rounded-lg border border-outline bg-surface-lowest shadow-[0_1px_2px_rgba(18,32,51,0.035)]" aria-label="K8s 运维导航">
      <div className="flex flex-col gap-2 px-3 py-2 md:flex-row md:items-center">
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

        <nav className="k8s-context-groups relative hidden min-w-0 flex-1 items-stretch justify-end gap-1 md:flex" aria-label="K8s 功能分组">
          {k8sNavigationGroups.map((group) => {
            const items = getK8sNavigationGroupItems(group.id).filter((item) => item.requiresCluster);
            if (!items.length) return null;
            if (items.length === 1) {
              return (
                <Link
                  key={group.id}
                  className={`${groupTriggerClass(group.id === activeGroupId)} relative z-20`}
                  to={k8sClusterPath(activeClusterId, items[0])}
                >
                  {group.label}
                </Link>
              );
            }
            return (
              <K8sGroupMenu
                key={group.id}
                active={group.id === activeGroupId}
                current={current}
                group={group}
                items={items}
                open={openGroupId === group.id}
                onClose={() => setOpenGroupId(null)}
                onToggle={() => setOpenGroupId((value) => value === group.id ? null : group.id)}
                activeClusterId={activeClusterId}
              />
            );
          })}
        </nav>

        <label className="relative block md:hidden">
          <span className="sr-only">K8s 功能选择</span>
          <select
            className="console-input h-9 w-full appearance-none pr-9 text-xs font-semibold"
            aria-label="K8s 功能选择"
            value={current?.id ?? ''}
            onChange={(event) => {
              const item = k8sNavigationGroups
                .flatMap((group) => getK8sNavigationGroupItems(group.id))
                .find((candidate) => candidate.id === event.target.value);
              if (item) onFunctionChange(item);
            }}
          >
            {k8sNavigationGroups.map((group) => {
              const items = getK8sNavigationGroupItems(group.id).filter((item) => item.requiresCluster);
              if (!items.length) return null;
              return (
                <optgroup key={group.id} label={group.label}>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </optgroup>
              );
            })}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
        </label>
      </div>
    </section>
  );
}

function K8sGroupMenu({
  active,
  activeClusterId,
  current,
  group,
  items,
  open,
  onClose,
  onToggle,
}: {
  active: boolean;
  activeClusterId: string;
  current: K8sNavigationItem | undefined;
  group: K8sNavigationGroup;
  items: K8sNavigationItem[];
  open: boolean;
  onClose: () => void;
  onToggle: () => void;
}) {
  return (
    <div className="relative z-20 shrink-0">
      <button
        type="button"
        className={groupTriggerClass(active || open)}
        aria-expanded={open}
        onClick={onToggle}
      >
        <span>{group.label}</span>
        {active && current ? <span className="text-[11px] font-medium text-primary/75">· {current.label}</span> : null}
        <ChevronDown className={['h-3.5 w-3.5 transition-transform', open ? 'rotate-180' : ''].join(' ')} />
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10 cursor-default"
            aria-label={`关闭${group.label}菜单`}
            onClick={onClose}
          />
          <div className="absolute right-0 top-full z-30 mt-2 w-60 rounded-md border border-outline bg-surface-lowest p-1.5 shadow-[0_16px_36px_-18px_rgba(18,32,51,0.45)]">
            <div className="px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">{group.label}</div>
            {items.map((item) => {
              const Icon = item.icon;
              const selected = current?.id === item.id;
              return (
                <Link
                  key={item.id}
                  className={[
                    'flex min-h-10 items-center gap-2.5 rounded-md px-2.5 py-2 text-xs transition-colors',
                    selected ? 'border-l-[3px] border-primary bg-primary-soft font-semibold text-primary' : 'text-on-surface hover:bg-surface',
                  ].join(' ')}
                  to={k8sClusterPath(activeClusterId, item)}
                  onClick={onClose}
                >
                  <Icon className={['h-4 w-4 shrink-0', selected ? 'text-primary' : 'text-muted'].join(' ')} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {selected ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                </Link>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

function groupTriggerClass(active: boolean) {
  return [
    'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border-b-2 px-3 text-xs font-semibold transition-colors',
    active ? 'border-primary bg-primary-soft text-primary' : 'border-transparent text-muted hover:bg-surface hover:text-on-surface',
  ].join(' ');
}

function fleetTabClass(isActive: boolean) {
  return [
    'module-navigation-link px-3 text-sm font-semibold transition-colors',
    isActive ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-on-surface',
  ].join(' ');
}
