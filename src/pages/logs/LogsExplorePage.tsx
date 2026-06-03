import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, ExternalLink, ListFilter, RefreshCw, Rows3, Search, Table2 } from 'lucide-react';
import { logsApi, logSourceLabel, type LogRouteView } from './api';
import { LogsEmptyState, LogsInfoCell, LogsSection, LogsToolbarButton } from './LogsPrimitives';

function serviceName(route: LogRouteView, services: Array<{ id: string; name: string; displayName: string }>) {
  const service = services.find((item) => item.id === route.route.serviceId);
  return service?.displayName || service?.name || route.route.serviceId;
}

function routeScope(route?: LogRouteView | null) {
  const source = route?.source;
  if (!source) return '-';
  if (source.sourceType === 'vm_file') return `${source.hostGroup || 'VM'} · ${source.pathPattern || '-'}`;
  return `${source.clusterId}/${source.namespace}/${source.workloadKind || 'Workload'}/${source.workloadName || '-'}`;
}

export function LogsExplorePage() {
  const { data: workspace, isLoading, error, refetch } = useQuery({
    queryKey: ['logs-onboarding-workspace'],
    queryFn: logsApi.getWorkspace,
  });
  const routes = workspace?.routes ?? [];
  const services = workspace?.services ?? [];
  const [routeId, setRouteId] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'table'>('list');
  const [query, setQuery] = useState('{service=~".+"}');
  const [routeQuery, setRouteQuery] = useState('');
  const activeRoute = useMemo(() => routes.find((item) => item.route.id === routeId) ?? routes[0] ?? null, [routeId, routes]);
  const visibleRoutes = useMemo(() => {
    const keyword = routeQuery.trim().toLowerCase();
    if (!keyword) return routes;
    return routes.filter((route) => `${serviceName(route, services)} ${route.endpoint?.name ?? ''} ${routeScope(route)}`.toLowerCase().includes(keyword));
  }, [routeQuery, routes, services]);
  const vmuiURL = activeRoute?.endpoint?.vmuiURL ?? '';
  const selectedServiceName = activeRoute ? serviceName(activeRoute, services) : '-';

  return (
    <div className="logs-explore-workbench grid min-h-[760px] gap-3 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
      <LogsSection title="日志路由" meta={isLoading ? 'loading' : `${routes.length} routes`} bodyClassName="p-0">
        {error ? <ErrorLine message={(error as Error).message} /> : null}
        <div className="border-b border-outline/70 p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input className="console-input h-8 w-full pl-8 text-xs" placeholder="过滤 service / endpoint" value={routeQuery} onChange={(event) => setRouteQuery(event.target.value)} />
          </div>
        </div>
        {routes.length === 0 ? (
          <LogsEmptyState
            title="日志路由为空"
            action={<Link className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-semibold text-white" to="/logs/onboarding">接入配置</Link>}
          />
        ) : (
          <div className="max-h-[680px] overflow-y-auto">
            {visibleRoutes.map((route) => {
              const active = route.route.id === (activeRoute?.route.id ?? '');
              return (
                <button
                  key={route.route.id}
                  className={`w-full border-b border-outline/60 px-3 py-2.5 text-left transition-colors ${
                    active ? 'bg-primary-soft/70 text-primary shadow-[inset_3px_0_0_#0d5bd7]' : 'bg-white/46 text-on-surface hover:bg-surface-low/70'
                  }`}
                  onClick={() => setRouteId(route.route.id)}
                >
                  <div className="truncate text-sm font-semibold">{serviceName(route, services)}</div>
                  <div className="mt-1 truncate font-mono text-[11px] text-muted">{route.endpoint?.name || '-'} · {logSourceLabel(route.route.sourceType)}</div>
                  <div className="mt-1 truncate font-mono text-[11px] text-muted">{routeScope(route)}</div>
                </button>
              );
            })}
            {visibleRoutes.length === 0 ? <div className="px-3 py-6 text-sm text-muted">没有匹配的日志路由。</div> : null}
          </div>
        )}
      </LogsSection>

      <LogsSection
        title="Explore"
        meta={activeRoute ? `${selectedServiceName} · ${activeRoute.endpoint?.name || 'endpoint -'}` : 'select route'}
        bodyClassName="p-0"
        action={
          <div className="flex items-center gap-1.5">
            <LogsToolbarButton active={viewMode === 'list'} onClick={() => setViewMode('list')}><Rows3 className="h-3.5 w-3.5" />List</LogsToolbarButton>
            <LogsToolbarButton active={viewMode === 'table'} onClick={() => setViewMode('table')}><Table2 className="h-3.5 w-3.5" />Table</LogsToolbarButton>
            <LogsToolbarButton onClick={() => refetch()}><RefreshCw className="h-3.5 w-3.5" />刷新</LogsToolbarButton>
          </div>
        }
      >
        <div className="border-b border-outline/70 bg-white/62 p-3">
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_180px_auto]">
            <label className="min-w-0">
              <span className="mb-1 block text-[11px] font-semibold text-muted">LogQL / VictoriaLogs query</span>
              <input className="console-input h-9 w-full font-mono text-xs" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <label>
              <span className="mb-1 block text-[11px] font-semibold text-muted">路由</span>
              <select className="console-input h-9 w-full" value={activeRoute?.route.id ?? ''} onChange={(event) => setRouteId(event.target.value)}>
                {routes.length === 0 ? <option value="">暂无路由</option> : null}
                {routes.map((route) => (
                  <option key={route.route.id} value={route.route.id}>{serviceName(route, services)}</option>
                ))}
              </select>
            </label>
            <div className="flex items-end gap-2">
              {vmuiURL ? (
                <a className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-white transition-all active:translate-y-px" href={vmuiURL} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />打开 VMUI
                </a>
              ) : (
                <button className="h-9 rounded-md border border-outline bg-white px-3 text-sm font-semibold text-muted" disabled>VMUI 未登记</button>
              )}
            </div>
          </div>
        </div>

        {vmuiURL ? (
          <iframe className="h-[650px] w-full border-0 bg-white" src={vmuiURL} title="VictoriaLogs VMUI" />
        ) : (
          <LogsEmptyState
            title={routes.length === 0 ? '日志路由为空' : 'VMUI URL 为空'}
          />
        )}
      </LogsSection>

      <LogsSection title="详情" meta={activeRoute?.route.configHash || 'route context'} bodyClassName="p-0">
        <LogsInfoCell label="服务" value={selectedServiceName} tone="primary" />
        <LogsInfoCell label="来源" value={activeRoute ? logSourceLabel(activeRoute.route.sourceType) : '-'} />
        <LogsInfoCell label="范围" value={routeScope(activeRoute)} />
        <LogsInfoCell label="端点" value={activeRoute?.endpoint?.name || '-'} />
        <LogsInfoCell label="配置 Hash" value={activeRoute?.route.configHash || '-'} />
        <LogsInfoCell label="发布状态" value={activeRoute?.route.lastPublishStatus || activeRoute?.route.status || '-'} />
        <div className="border-t border-outline/70 p-3">
          <div className="mb-2 text-xs font-semibold text-on-surface">动作</div>
          <div className="grid gap-2">
            <Link className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-outline bg-white text-xs font-semibold text-muted hover:border-primary/40 hover:text-on-surface" to="/logs/alerts">
              <Bell className="h-3.5 w-3.5" />创建告警
            </Link>
            <Link className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-outline bg-white text-xs font-semibold text-muted hover:border-primary/40 hover:text-on-surface" to={`/logs/agents?agent_group_id=${activeRoute?.route.agentGroupId || ''}&route_id=${activeRoute?.route.id || ''}`}>
              <ListFilter className="h-3.5 w-3.5" />Agent 状态
            </Link>
          </div>
        </div>
      </LogsSection>
    </div>
  );
}

function ErrorLine({ message }: { message: string }) {
  return <div className="m-3 rounded border border-red-500/30 bg-red-50 px-3 py-2 text-sm text-red-600">{message}</div>;
}
