import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, CheckCircle2, Database, Link2, RadioTower, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { metricsApi } from './api';

function healthTone(status: string) {
  if (['active', 'healthy', 'verified'].includes(status)) return 'text-emerald-600';
  if (['failed', 'error', 'disabled'].includes(status)) return 'text-danger';
  return 'text-warning';
}

function HealthIcon({ status }: { status: string }) {
  if (['active', 'healthy', 'verified'].includes(status)) return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (['failed', 'error', 'disabled'].includes(status)) return <AlertTriangle className="h-4 w-4 text-danger" />;
  return <Activity className="h-4 w-4 text-warning" />;
}

export function MetricsOverviewPage() {
	const { productId = '', serviceId = '' } = useParams();
	const base = `/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}/metrics`;
  const workspaceQuery = useQuery({
	queryKey: ['metrics-workspace', productId, serviceId],
	queryFn: () => metricsApi.getWorkspace(productId, serviceId),
	enabled: Boolean(productId && serviceId),
    retry: false,
    refetchInterval: 30_000,
  });
  const alertsQuery = useQuery({
    queryKey: ['metrics-alert-rules'],
    queryFn: () => api.getMetricsAlertRules(),
    retry: false,
    refetchInterval: 30_000,
  });

  const endpoints = workspaceQuery.data?.endpoints ?? [];
  const routes = workspaceQuery.data?.routes ?? [];
  const alertRules = alertsQuery.data ?? [];

  const isLoading = workspaceQuery.isLoading || alertsQuery.isLoading;
  const error = workspaceQuery.error || alertsQuery.error;

  const activeRoutes = routes.filter((route) => route.status === 'active');
  const deployedRoutes = activeRoutes.filter((route) => route.lastPublishStatus === 'applied' && route.desiredConfigHash === route.appliedConfigHash);
  const failedRoutes = routes.filter((route) => route.lastPublishStatus === 'failed');
  const pendingRoutes = activeRoutes.filter((route) => route.lastPublishStatus !== 'failed' && !(route.lastPublishStatus === 'applied' && route.desiredConfigHash === route.appliedConfigHash));
  const enabledAlerts = alertRules.filter((r) => r.state === 'enabled');
  const failedAlerts = alertRules.filter((r) => r.applyStatus === 'failed');

  function refetchAll() {
    void workspaceQuery.refetch();
    void alertsQuery.refetch();
  }

  return (
    <div className="space-y-3">
      <section className="console-panel overflow-hidden">
        <div className="console-panel-header">
          <div className="min-w-0">
            <h2 className="console-section-title">监控总览</h2>
            <p className="console-section-meta">服务指标状态 · 30s 自动刷新</p>
          </div>
          <button type="button" className="console-icon-button border-outline bg-white" aria-label="刷新监控总览" title="刷新监控总览" onClick={refetchAll}>
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
        {error ? <div className="console-notice console-notice-danger m-3 mb-0">{(error as Error).message}</div> : null}
        <div className="console-panel-body">
          {isLoading ? (
            <div className="grid gap-3 p-1 md:grid-cols-3">
              <div className="console-skeleton h-40" />
              <div className="console-skeleton h-40" />
              <div className="console-skeleton h-40" />
            </div>
          ) : error ? (
            <div className="console-empty-state min-h-[320px]"><div className="text-sm font-semibold text-danger">监控总览加载失败</div><div className="text-xs text-muted">请检查指标与告警读取权限后重试。</div></div>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              <OverviewCard
                icon={Database}
                title="接入端点"
				link={`${base}/endpoints`}
                linkLabel="查看端点"
              >
                <Stat label="总端点" value={endpoints.length} />
                {endpoints.length > 0 ? (
                  <div className="mt-3 grid gap-1.5">
                    {endpoints.map((ep) => (
                      <div key={ep.id} className="flex items-center gap-2 rounded border border-outline/70 bg-surface-lowest px-2.5 py-2">
                        <HealthIcon status={ep.status} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-semibold text-on-surface">{ep.name || ep.id}</div>
                          <div className="truncate font-mono text-[11px] text-muted">{ep.endpointType}</div>
                        </div>
                        <span className={`text-xs font-semibold ${healthTone(ep.status)}`}>{ep.status || 'unknown'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
				  <div className="mt-3 text-xs text-muted">暂无端点。<Link className="font-semibold text-primary" to={`${base}/endpoints`}>配置端点</Link></div>
                )}
              </OverviewCard>

              <OverviewCard
                icon={RadioTower}
                title="采集路由"
				link={`${base}/routes`}
                linkLabel="查看路由"
              >
                <div className="grid grid-cols-2 gap-2">
                  <Stat label="总路由" value={routes.length} />
                  <Stat label="已部署" value={deployedRoutes.length} tone="success" />
                  <Stat label="待发布" value={pendingRoutes.length} />
                  <Stat label="失败" value={failedRoutes.length} tone={failedRoutes.length > 0 ? 'danger' : undefined} />
                </div>
                {failedRoutes.length > 0 ? (
                  <div className="mt-3 rounded border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-700">
                    {failedRoutes.length} 条路由部署失败，请进入观测接入检查。
                  </div>
                ) : pendingRoutes.length > 0 ? (
                  <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-700">
                    {pendingRoutes.length} 条路由等待预览或重新部署。
                  </div>
                ) : routes.length > 0 ? (
                  <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-700">
                    所有启用路由均已部署且配置一致。
                  </div>
                ) : (
				  <div className="mt-3 text-xs text-muted">暂无采集路由。<Link className="font-semibold text-primary" to={`${base}/routes/new`}>新建路由</Link></div>
                )}
              </OverviewCard>

              <OverviewCard
                icon={Link2}
                title="指标告警"
				link={`${base}/alerts`}
                linkLabel="查看告警"
              >
                <div className="grid grid-cols-2 gap-2">
                  <Stat label="总规则" value={alertRules.length} />
                  <Stat label="启用" value={enabledAlerts.length} tone="success" />
                  <Stat label="发布失败" value={failedAlerts.length} tone={failedAlerts.length > 0 ? 'danger' : undefined} />
                </div>
                {failedAlerts.length > 0 ? (
                  <div className="mt-3 rounded border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-700">
                    {failedAlerts.length} 条规则发布失败。
                  </div>
                ) : alertRules.length > 0 ? (
                  <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-700">
                    所有告警规则状态正常。
                  </div>
                ) : (
				  <div className="mt-3 text-xs text-muted">暂无告警。<Link className="font-semibold text-primary" to={`${base}/alerts/new`}>创建告警</Link></div>
                )}
              </OverviewCard>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function OverviewCard({ icon: Icon, title, link, linkLabel, children }: { icon: typeof Database; title: string; link: string; linkLabel: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-outline bg-white">
      <div className="flex items-center justify-between border-b border-outline/70 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted" />
          <span className="text-sm font-semibold text-on-surface">{title}</span>
        </div>
        <Link className="text-xs font-semibold text-primary" to={link}>{linkLabel} →</Link>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'danger' }) {
  const valueClass = tone === 'success' ? 'text-emerald-700' : tone === 'danger' ? 'text-danger' : 'text-on-surface';
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-semibold text-muted">{label}</div>
      <div className={`mt-0.5 text-lg font-bold tabular-nums ${valueClass}`}>{value}</div>
    </div>
  );
}
