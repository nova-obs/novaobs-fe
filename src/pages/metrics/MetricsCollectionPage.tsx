import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, RadioTower, RefreshCw, Rocket } from 'lucide-react';
import { metricsApi, type MetricRoute } from './api';

function statusTone(status: string) {
  if (['active', 'applied', 'ready', 'deployed'].includes(status)) return 'border-emerald-600/20 bg-emerald-50 text-emerald-700';
  if (['failed', 'error', 'blocked'].includes(status)) return 'border-danger/20 bg-red-50 text-danger';
  if (['pending', 'pending_publish', 'previewed', 'degraded'].includes(status)) return 'border-warning/25 bg-amber-50 text-warning';
  return 'border-outline bg-surface-lowest text-muted';
}

function publishLabel(route: MetricRoute) {
  if (route.lastPublishStatus === 'applied' && route.appliedConfigHash === route.desiredConfigHash) return '已部署';
  if (route.lastPublishStatus === 'failed') return '部署失败';
  if (route.appliedConfigHash) return '待更新';
  return '待部署';
}

export function MetricsCollectionPage() {
  const { productId = '', serviceId = '' } = useParams();
  const base = `/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}/metrics`;
  const routesQuery = useQuery({
    queryKey: ['metrics-routes', productId, serviceId],
    queryFn: () => metricsApi.listRoutes(productId, serviceId),
    enabled: Boolean(productId && serviceId),
    retry: false,
  });
  const routes = routesQuery.data ?? [];

  return (
    <section className="console-panel overflow-hidden">
      <div className="console-panel-header">
        <div className="min-w-0">
          <h2 className="console-section-title">采集路由</h2>
          <p className="console-section-meta">K8s Service → vmagent → VictoriaMetrics</p>
        </div>
        <div className="flex items-center gap-2">
          <Link className="console-button console-button-primary gap-1.5" to={`${base}/routes/new`}>
            <Plus className="h-3.5 w-3.5" />新建路由
          </Link>
          <button type="button" className="console-icon-button border-outline bg-white" aria-label="刷新采集路由" title="刷新采集路由" onClick={() => void routesQuery.refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {routesQuery.error ? <div className="console-notice console-notice-danger m-3 mb-0">{(routesQuery.error as Error).message}</div> : null}
      <div className="console-panel-body overflow-auto">
        <table className="console-table w-full min-w-[980px]">
          <thead>
            <tr>
              <th>路由 / 采集目标</th>
              <th>集群 / 命名空间</th>
              <th>指标端点</th>
              <th>采集策略</th>
              <th>路由状态</th>
              <th>部署状态</th>
              <th className="w-[188px]">操作</th>
            </tr>
          </thead>
          <tbody>
            {routesQuery.isLoading ? (
              <tr><td colSpan={7}><div className="console-skeleton h-10" /></td></tr>
            ) : routesQuery.error ? (
              <tr><td colSpan={7}><div className="console-empty-state my-2 min-h-[220px]"><div className="text-sm font-semibold text-danger">采集路由加载失败</div><div className="text-xs text-muted">请检查权限或网络后重试。</div></div></td></tr>
            ) : routes.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="console-empty-state my-2 min-h-[300px]">
                    <RadioTower className="h-5 w-5 text-muted/80" />
                    <div className="text-sm font-semibold text-on-surface">暂无指标采集路由</div>
                    <div className="max-w-md text-xs leading-5 text-muted">登记集群内的 K8s Service 指标端点后，再到观测接入预览并部署对应 vmagent 运行时。</div>
                    <Link className="console-button console-button-primary" to={`${base}/routes/new`}>新建采集路由</Link>
                  </div>
                </td>
              </tr>
            ) : routes.map((route) => {
              const deploymentStatus = publishLabel(route);
              const runtimeURL = `/k8s/observability?runtime=metrics&cluster_id=${encodeURIComponent(route.clusterId)}&route_id=${encodeURIComponent(route.id)}`;
              return (
                <tr key={route.id}>
                  <td>
                    <div className="font-semibold text-on-surface">{route.name}</div>
                    <div className="mt-1 font-mono text-xs text-muted">{route.k8sServiceName}:{route.port}{route.metricsPath}</div>
                  </td>
                  <td>
                    <div className="font-mono text-xs">{route.clusterId}</div>
                    <div className="mt-1 font-mono text-xs text-muted">{route.namespace}</div>
                  </td>
                  <td className="font-mono text-xs">{route.endpoint?.name || route.endpointId || '-'}</td>
                  <td className="font-mono text-xs">{route.scheme} · {route.scrapeInterval} / {route.scrapeTimeout}</td>
                  <td><span className={`status-badge ${statusTone(route.status)}`}><span className="status-dot" aria-hidden />{route.status || '-'}</span></td>
                  <td>
                    <span className={`status-badge ${statusTone(deploymentStatus === '已部署' ? 'applied' : route.lastPublishStatus)}`}><span className="status-dot" aria-hidden />{deploymentStatus}</span>
                    <div className="mt-1 max-w-[210px] truncate text-[11px] text-muted" title={route.lastPublishMessage}>{route.lastPublishedAt || route.lastPublishMessage || '-'}</div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <Link className="console-button text-xs" to={`${base}/routes/${encodeURIComponent(route.id)}/edit`}>编辑</Link>
                      <Link className="console-button gap-1 text-xs" to={runtimeURL}><Rocket className="h-3 w-3" />部署</Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
