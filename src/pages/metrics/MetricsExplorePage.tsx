import { useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, Database, RefreshCw, Route, Server } from 'lucide-react';
import { buildVictoriaMetricsVMUIURL, metricsApi, type MetricRoute } from './api';
import { ServiceContextSelector } from '../../components/navigation/ServiceContextSelector';

function statusTone(status: string) {
  if (['active', 'applied', 'ready', 'healthy'].includes(status)) return 'border-emerald-600/20 bg-emerald-50 text-emerald-700';
  if (['failed', 'error', 'blocked'].includes(status)) return 'border-danger/20 bg-red-50 text-danger';
  return 'border-warning/25 bg-amber-50 text-warning';
}

function routeTarget(route?: MetricRoute | null) {
  return route ? `${route.namespace}/${route.k8sServiceName}:${route.port}${route.metricsPath}` : '-';
}

export function MetricsExplorePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { productId = '', serviceId = '' } = useParams();
  const base = `/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}/metrics`;
  const workspaceQuery = useQuery({
    queryKey: ['metrics-workspace', productId, serviceId],
    queryFn: () => metricsApi.getWorkspace(productId, serviceId),
    enabled: Boolean(productId && serviceId), retry: false,
  });
  const workspace = workspaceQuery.data;
  const service = workspace?.services.find((item) => item.id === serviceId) ?? null;
  const activeBinding = workspace?.serviceBindings.find((binding) => binding.status === 'active') ?? null;
  const deployedRoutes = useMemo(
    () => (workspace?.routes ?? []).filter((route) => route.status === 'active' && route.lastPublishStatus === 'applied' && route.appliedConfigHash === route.desiredConfigHash),
    [workspace?.routes],
  );
  const requestedRouteId = searchParams.get('route_id') ?? '';
  const activeRoute = deployedRoutes.find((route) => route.id === requestedRouteId) ?? deployedRoutes[0] ?? null;
  const activeEndpoint = activeRoute?.endpoint ?? workspace?.endpoints.find((endpoint) => endpoint.id === activeRoute?.endpointId) ?? null;
  const activeTenant = service ? `${service.accountId || '0'}:${service.projectId || '-'}` : '未初始化';
  const activeVMUIURL = buildVictoriaMetricsVMUIURL(activeEndpoint?.vmuiURL ?? '', activeRoute?.basePromQL ?? '');

  function selectRoute(routeId: string) {
    const next = new URLSearchParams(searchParams);
    next.set('route_id', routeId);
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="metrics-explore-workbench grid min-h-[720px] gap-3 xl:h-full xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_320px] xl:overflow-hidden">
      <section className="console-panel flex min-h-0 flex-col overflow-hidden" aria-label="Metrics Explore 工作区">
        <div className="console-panel-header shrink-0">
          <ServiceContextSelector className="w-full max-w-[420px]" />
          <div className="flex items-center gap-2">
            {deployedRoutes.length > 1 ? (
              <select className="console-input h-8 min-w-[220px] text-xs" value={activeRoute?.id ?? ''} onChange={(event) => selectRoute(event.target.value)} aria-label="选择已部署采集路由">
                {deployedRoutes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}
              </select>
            ) : null}
            <button type="button" className="console-icon-button border-outline bg-white" aria-label="刷新指标工作区" title="刷新指标工作区" onClick={() => void workspaceQuery.refetch()}><RefreshCw className="h-3.5 w-3.5" /></button>
          </div>
        </div>
        {workspaceQuery.error ? <div className="console-notice console-notice-danger m-3 mb-0">{(workspaceQuery.error as Error).message}</div> : null}
        <div className="min-h-0 flex-1 bg-surface-low p-3">
          {workspaceQuery.isLoading ? <div className="console-skeleton h-full min-h-[520px]" /> : !activeRoute ? (
            <div className="console-empty-state h-full min-h-[520px]">
              <Route className="h-5 w-5 text-muted/80" />
              <div className="text-sm font-semibold text-on-surface">尚无已部署采集路由</div>
              <div className="max-w-md text-xs leading-5 text-muted">先创建针对 K8s Service 的指标采集路由，再到 K8s 观测接入预览并部署 vmagent 运行时。</div>
              <div className="flex gap-2">
                <Link className="console-button console-button-primary" to={`${base}/routes/new`}>新建采集路由</Link>
                <Link className="console-button" to={`${base}/routes`}>查看采集路由</Link>
              </div>
            </div>
          ) : !activeVMUIURL ? (
            <div className="console-empty-state h-full min-h-[520px]">
              <Database className="h-5 w-5 text-muted/80" />
              <div className="text-sm font-semibold text-on-surface">指标端点未配置 vmuiURL</div>
              <div className="text-xs text-muted">完善 VictoriaMetrics 查询端点后即可在服务作用域内嵌入 Explore。</div>
              <Link className="console-button" to={`${base}/endpoints`}>查看接入端点</Link>
            </div>
          ) : (
            <section className="flex h-full min-h-[600px] flex-col overflow-hidden rounded-md border border-outline bg-surface-lowest">
              <div className="flex items-center justify-between border-b border-outline px-3 py-2">
                <div><span className="text-xs font-semibold text-on-surface">vmui 查询面板</span><span className="ml-2 font-mono text-[11px] text-muted">{activeRoute.basePromQL}</span></div>
                <a className="text-xs font-semibold text-primary" href={activeVMUIURL} target="_blank" rel="noopener noreferrer">新窗口打开 ↗</a>
              </div>
              <iframe className="min-h-0 flex-1 border-0" src={activeVMUIURL} title="VictoriaMetrics vmui" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
            </section>
          )}
        </div>
      </section>

      <aside className="console-panel flex min-h-0 flex-col overflow-hidden" aria-label="Metrics Explore 详情">
        <div className="console-panel-header shrink-0"><h2 className="console-section-title">采集作用域</h2></div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Detail icon={Server} label="服务" value={service?.displayName || service?.name || service?.id || '-'} />
          <Detail icon={Route} label="采集路由" value={activeRoute?.name || '-'} />
          <Detail label="K8s 目标" value={routeTarget(activeRoute)} mono />
          <Detail icon={Database} label="Endpoint" value={activeEndpoint?.name || activeRoute?.endpointId || '-'} />
          <Detail label="Base PromQL" value={activeRoute?.basePromQL || '-'} mono />
          <Detail label="租户" value={activeTenant} mono />
          <Detail label="部署状态" value={activeRoute?.lastPublishStatus || '-'} badge />
          <div className="border-t border-outline/70 p-3">
            <button type="button" className="console-button console-button-primary w-full" disabled={!activeBinding} title={activeBinding ? '从当前服务查询作用域创建指标告警' : '请先建立指标查询绑定'} onClick={() => navigate(`${base}/alerts/new`)}>
              <Bell className="h-3.5 w-3.5" />创建指标告警
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Detail({ icon: Icon, label, value, mono, badge }: { icon?: typeof Server; label: string; value: string; mono?: boolean; badge?: boolean }) {
  return <div className="border-b border-outline/70 px-3 py-3"><div className="flex items-center gap-2 text-[11px] font-semibold text-muted">{Icon ? <Icon className="h-3.5 w-3.5" /> : null}{label}</div>{badge ? <span className={`status-badge mt-1 ${statusTone(value)}`}><span className="status-dot" aria-hidden />{value}</span> : <div className={`mt-1 break-words text-sm font-semibold text-on-surface ${mono ? 'font-mono text-xs' : ''}`}>{value}</div>}</div>;
}
