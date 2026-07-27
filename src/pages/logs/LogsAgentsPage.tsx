import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, FileText, Loader2, Plus, RefreshCw, Trash2, XCircle } from 'lucide-react';
import { logSinkLabel, logSourceLabel, logsApi, type LogRouteRuntimeTarget, type LogRouteView } from './api';
import { routeLifecycle, statusPillClass } from './ServicePickerPanel';
import { LogsEmptyState, LogsErrorLine } from './LogsPrimitives';
import { ServiceContextSelector } from '../../components/navigation/ServiceContextSelector';

export function LogsAgentsPage() {
  const queryClient = useQueryClient();
  const { productId = '', serviceId = '' } = useParams();
  const base = `/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}/logs`;
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedRouteId, setSelectedRouteId] = useState(searchParams.get('route_id') ?? '');
  const [onlyExceptions, setOnlyExceptions] = useState(true);
  const [collectorConfigRoute, setCollectorConfigRoute] = useState<LogRouteView | null>(null);
  const [confirmDeleteRouteId, setConfirmDeleteRouteId] = useState('');

  const workspaceQuery = useQuery({
    queryKey: ['logs-onboarding-workspace', productId, serviceId],
    queryFn: () => logsApi.getWorkspace(productId, serviceId),
    enabled: Boolean(productId && serviceId),
  });
  const routes = workspaceQuery.data?.routes ?? [];
  const activeRoute = routes.find((route) => route.route.id === selectedRouteId) ?? routes[0] ?? null;

  useEffect(() => {
    if (!routes.length) {
      if (selectedRouteId) setSelectedRouteId('');
      return;
    }
    if (!routes.some((route) => route.route.id === selectedRouteId)) setSelectedRouteId(routes[0].route.id);
  }, [routes, selectedRouteId]);

  const runtimeQuery = useQuery({
    queryKey: ['logs-route-runtime', activeRoute?.route.id],
    queryFn: () => logsApi.getRouteRuntimeStatus(activeRoute?.route.id ?? ''),
    enabled: Boolean(activeRoute?.route.id),
    refetchInterval: 10000,
  });
  const collectorConfigMutation = useMutation({
    mutationFn: (routeId: string) => logsApi.getRouteCollectorConfig(routeId),
  });
  const deleteMutation = useMutation({
    mutationFn: (routeId: string) => logsApi.deleteRoute(routeId),
    onSuccess: async () => {
      setConfirmDeleteRouteId('');
      setSelectedRouteId('');
      await queryClient.invalidateQueries({ queryKey: ['logs-onboarding-workspace'] });
    },
  });
  const runtime = runtimeQuery.data;
  const visibleTargets = useMemo(
    () => (runtime?.targets ?? []).filter((target) => !onlyExceptions || targetIsException(target)),
    [onlyExceptions, runtime?.targets],
  );
  const lifecycle = activeRoute ? routeLifecycle(activeRoute) : null;

  function selectRoute(routeId: string) {
    setSelectedRouteId(routeId);
    setConfirmDeleteRouteId('');
    const next = new URLSearchParams(searchParams);
    next.set('route_id', routeId);
    setSearchParams(next, { replace: true });
  }

  function openCollectorConfig(route: LogRouteView) {
    setCollectorConfigRoute(route);
    collectorConfigMutation.mutate(route.route.id);
  }

  return (
    <div className="console-workbench logs-routes-workbench flex min-h-[720px] flex-col xl:h-full xl:min-h-0">
      <section className="console-panel flex min-h-0 flex-1 flex-col overflow-hidden" aria-label="采集路由工作区">
        <div className="console-panel-header shrink-0">
          <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid w-full gap-2 lg:max-w-[860px] lg:grid-cols-2">
              <ServiceContextSelector />
              <select className="console-input w-full" aria-label="采集路由" value={activeRoute?.route.id ?? ''} onChange={(event) => selectRoute(event.target.value)}>
                {routes.length === 0 ? <option value="">暂无采集路由</option> : routes.map((route) => (
                  <option key={route.route.id} value={route.route.id}>{route.route.name || route.route.id} · {logSourceLabel(route.route.sourceType)} · {route.endpoint?.name || '-'}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button className="console-button" onClick={() => { void workspaceQuery.refetch(); void runtimeQuery.refetch(); }}>
                <RefreshCw className={`h-3.5 w-3.5 ${workspaceQuery.isFetching || runtimeQuery.isFetching ? 'animate-spin' : ''}`} />刷新
              </button>
              <Link className="console-button console-button-primary" to={`${base}/agents/new`}><Plus className="h-3.5 w-3.5" />创建采集路由</Link>
            </div>
          </div>
        </div>

        {workspaceQuery.error ? <LogsErrorLine message={(workspaceQuery.error as Error).message} /> : deleteMutation.error ? <LogsErrorLine message={(deleteMutation.error as Error).message} /> : null}
        {!activeRoute ? (
          <LogsEmptyState title="暂无采集路由" description="创建路由后可查看预期覆盖、Agent 收敛和数据流入状态。" action={<Link className="console-button console-button-primary" to={`${base}/agents/new`}>创建采集路由</Link>} />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-col gap-3 border-b border-outline px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-base font-semibold">{activeRoute.route.name || activeRoute.route.id}</h2>
                  <span className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold ${statusPillClass(lifecycle?.tone ?? 'muted')}`}>{lifecycle?.label ?? '-'}</span>
                </div>
                <div className="mt-1 truncate text-xs text-muted">{logSourceLabel(activeRoute.route.sourceType)} · {activeRoute.endpoint ? `${activeRoute.endpoint.name} / ${logSinkLabel(activeRoute.endpoint.sinkType)}` : '下游未配置'}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="console-button" onClick={() => openCollectorConfig(activeRoute)}><FileText className="h-3.5 w-3.5" />查看配置</button>
                <Link className="console-button console-button-primary" to={`${base}/agents/${activeRoute.route.id}/edit`}>更新路由</Link>
                <button
                  className={`console-button ${confirmDeleteRouteId === activeRoute.route.id ? 'console-button-danger' : ''}`}
                  disabled={deleteMutation.isPending}
                  onClick={() => confirmDeleteRouteId === activeRoute.route.id ? deleteMutation.mutate(activeRoute.route.id) : setConfirmDeleteRouteId(activeRoute.route.id)}
                >
                  {deleteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  {confirmDeleteRouteId === activeRoute.route.id ? '确认删除' : '删除'}
                </button>
              </div>
            </div>

            {runtimeQuery.error ? <LogsErrorLine message={(runtimeQuery.error as Error).message} /> : runtimeQuery.isLoading ? (
              <div className="console-skeleton m-4 h-44" />
            ) : !runtime ? <LogsEmptyState title="暂无运行状态" /> : (
              <div className="min-h-0 flex-1 overflow-auto">
                <div className="grid border-b border-outline sm:grid-cols-3 xl:grid-cols-6">
                  <CoverageFact label="预期目标" value={runtime.expected} />
                  <CoverageFact label="已注册" value={runtime.registered} good={runtime.expected > 0 && runtime.registered === runtime.expected} />
                  <CoverageFact label="在线" value={runtime.online} good={runtime.expected > 0 && runtime.online === runtime.expected} />
                  <CoverageFact label="进程健康" value={runtime.healthy} good={runtime.expected > 0 && runtime.healthy === runtime.expected} />
                  <CoverageFact label="配置收敛" value={runtime.converged} good={runtime.expected > 0 && runtime.converged === runtime.expected} />
                  <CoverageFact label="日志流入" value={runtime.flowing} good={runtime.expected > 0 && runtime.flowing === runtime.expected} />
                </div>
                {runtime.blockingReason ? <div className="console-notice console-notice-warning m-3">{runtime.blockingReason}</div> : null}
                <div className="flex items-center justify-between gap-3 border-y border-outline bg-surface px-3 py-2">
                  <div className="text-xs font-semibold">目标状态</div>
                  <label className="flex items-center gap-2 text-xs text-muted">
                    <input type="checkbox" checked={onlyExceptions} onChange={(event) => setOnlyExceptions(event.target.checked)} />
                    仅看异常
                  </label>
                </div>
                {visibleTargets.length === 0 ? (
                  <LogsEmptyState title={onlyExceptions ? '当前没有异常目标' : '没有预期运行目标'} description={onlyExceptions ? '取消“仅看异常”可查看全部目标。' : '请先在服务部署中绑定运行目标。'} />
                ) : (
                  <table className="console-table min-w-[1120px] w-full">
                    <thead><tr><th>运行目标</th><th>安装</th><th>连接状态</th><th>进程状态</th><th>配置状态</th><th>数据状态</th><th>阻断原因</th><th>最近状态</th></tr></thead>
                    <tbody>{visibleTargets.map((target) => (
                      <tr key={target.targetId}>
                        <td>
                          {target.instanceUid ? <Link className="font-semibold text-primary hover:underline" to={`/agents/${encodeURIComponent(target.instanceUid)}`}>{target.targetName || target.targetId}</Link> : <span className="font-semibold">{target.targetName || target.targetId}</span>}
                          <div className="mt-1 font-mono text-[11px] text-muted">{target.targetId}</div>
                        </td>
                        <td>{target.installationId ? '已注册' : '未安装'}</td>
                        <td><AxisState value={target.connectionStatus} /></td>
                        <td><AxisState value={target.processStatus} /></td>
                        <td><AxisState value={target.configStatus} /></td>
                        <td><AxisState value={target.dataStatus} /></td>
                        <td className="max-w-[220px] text-xs text-danger">{blockingReasonLabel(target.blockingReason)}</td>
                        <td className="font-mono text-[11px] text-muted">{target.lastLogAt || target.lastSeenAt || '-'}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {collectorConfigRoute && typeof document !== 'undefined' ? createPortal((
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/28 px-4 py-6">
          <section className="grid h-[80vh] w-full max-w-[920px] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-md border border-outline bg-white shadow-[0_24px_80px_rgba(24,52,96,0.28)]">
            <div className="flex items-center justify-between gap-3 border-b border-outline px-4 py-3">
              <div><div className="text-sm font-semibold">采集配置</div><div className="mt-1 font-mono text-[11px] text-muted">{collectorConfigRoute.route.id}</div></div>
              <div className="flex gap-2">
                <button className="console-icon-button" aria-label="复制采集配置" title="复制" disabled={!collectorConfigMutation.data?.collectorYAML} onClick={() => navigator.clipboard?.writeText(collectorConfigMutation.data?.collectorYAML ?? '')}><Copy className="h-4 w-4" /></button>
                <button className="console-icon-button" aria-label="关闭采集配置" title="关闭" onClick={() => { setCollectorConfigRoute(null); collectorConfigMutation.reset(); }}><XCircle className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="min-h-0 overflow-auto bg-surface p-4">
              {collectorConfigMutation.isPending ? <LogsEmptyState title="正在加载采集配置" /> : collectorConfigMutation.error ? <LogsErrorLine message={(collectorConfigMutation.error as Error).message} /> : (
                <pre className="min-h-full overflow-auto rounded border border-outline bg-white p-4 font-mono text-[11px] leading-5 whitespace-pre-wrap">{collectorConfigMutation.data?.collectorYAML || '采集配置为空'}</pre>
              )}
            </div>
          </section>
        </div>),
        document.body,
      ) : null}
    </div>
  );
}

function CoverageFact({ label, value, good = false }: { label: string; value: number; good?: boolean }) {
  return <div className="border-r border-outline px-3 py-3 last:border-r-0"><div className="text-[11px] font-semibold text-muted">{label}</div><div className={`mt-1 font-mono text-sm font-semibold ${good ? 'text-emerald-700' : 'text-on-surface'}`}>{value}</div></div>;
}

function AxisState({ value }: { value: string }) {
  const tone = ['online', 'healthy', 'applied', 'flowing'].includes(value)
    ? 'text-emerald-700'
    : ['unhealthy', 'failed', 'drift', 'stale'].includes(value)
      ? 'text-danger'
      : ['applying'].includes(value) ? 'text-primary' : 'text-muted';
  return <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${tone}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{axisLabel(value)}</span>;
}

function axisLabel(value: string) {
  const labels: Record<string, string> = {
    online: '在线', offline: '离线', revoked: '已吊销',
    healthy: '健康', unhealthy: '异常', unknown: '未知',
    pending: '待下发', applying: '应用中', applied: '已应用', failed: '失败', drift: '配置漂移',
    not_installed: '未安装',
    flowing: '有数据', stale: '数据中断', no_data: '暂无数据',
  };
  return (labels[value] ?? value) || '-';
}

function targetIsException(target: LogRouteRuntimeTarget) {
  return !target.installationId
    || target.connectionStatus !== 'online'
    || target.processStatus !== 'healthy'
    || target.configStatus !== 'applied'
    || target.dataStatus !== 'flowing'
    || Boolean(target.blockingReason);
}

function blockingReasonLabel(reason: string) {
  const labels: Record<string, string> = {
    not_installed: 'Agent 未安装',
    offline: 'Agent 离线',
    process_unhealthy: 'Collector 进程异常',
    config_failed: '配置应用失败',
    config_drift: '配置漂移',
    no_data: '尚无日志数据',
    stale: '日志已中断',
  };
  return (labels[reason] ?? reason) || '-';
}
