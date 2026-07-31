import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Copy,
  FileClock,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  XCircle,
} from 'lucide-react';
import { ServiceContextSelector } from '../../components/navigation/ServiceContextSelector';
import { accessAllows, usePlatformAccess } from '../../layouts/access';
import { api } from '../../services/api';
import type { CollectorEnrollmentCredential, ServiceDeployment } from '../../services/types';
import {
  logSinkLabel,
  logSourceLabel,
  logsApi,
  defaultLogsCollectorNamespace,
  type LogsCollectorRuntimeStatus,
  type LogRouteRuntimeTarget,
  type LogRouteRuntimeStatus,
  type LogRouteView,
} from './api';
import {
  buildAgentDetailURL,
  buildLogsRuntimeURL,
  buildRouteOptionLabel,
  issueHostEnrollmentToken,
  summarizeK8sRuntimeStatus,
} from './logsRuntimeViewModel';
import { LogsEmptyState, LogsErrorLine } from './LogsPrimitives';
import { routeLifecycle, statusPillClass } from './ServicePickerPanel';

export function LogsAgentsPage() {
  const queryClient = useQueryClient();
  const { productId = '', serviceId = '' } = useParams();
  const { data: accessContext } = usePlatformAccess();
  const canMaintain = Boolean(accessContext && accessAllows(accessContext, {
    kind: 'product',
    productId,
    minimum: 'product-maintainer',
  }));
  const base = `/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}/logs`;
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedRouteId, setSelectedRouteId] = useState(searchParams.get('route_id') ?? '');
  const [onlyExceptions, setOnlyExceptions] = useState(true);
  const [collectorConfigRoute, setCollectorConfigRoute] = useState<LogRouteView | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmDeleteRouteId, setConfirmDeleteRouteId] = useState('');
  const [confirmRollbackId, setConfirmRollbackId] = useState('');
  const [enrollment, setEnrollment] = useState<CollectorEnrollmentCredential | null>(null);

  const workspaceQuery = useQuery({
    queryKey: ['logs-onboarding-workspace', productId, serviceId],
    queryFn: () => logsApi.getWorkspace(productId, serviceId),
    enabled: Boolean(productId && serviceId),
  });
  const deploymentsQuery = useQuery({
    queryKey: ['service-deployments', productId, serviceId],
    queryFn: () => api.getServiceDeployments(productId, serviceId),
    enabled: Boolean(productId && serviceId),
  });
  const routes = workspaceQuery.data?.routes ?? [];
  const deployments = deploymentsQuery.data ?? [];
  const requestedDeploymentId = searchParams.get('deployment_id') ?? '';
  const activeRoute = routes.find((route) => route.route.id === selectedRouteId)
    ?? routes.find((route) => route.route.serviceDeploymentId === requestedDeploymentId)
    ?? routes[0]
    ?? null;
  const activeDeployment = deployments.find((deployment) => deployment.id === activeRoute?.route.serviceDeploymentId) ?? null;
  const deploymentMissing = Boolean(
    activeRoute
    && !deploymentsQuery.isLoading
    && !deploymentsQuery.error
    && !activeDeployment,
  );
  const isVMRoute = activeRoute?.route.sourceType === 'vm_file';

  useEffect(() => {
    if (!routes.length) {
      if (selectedRouteId) setSelectedRouteId('');
      return;
    }
    if (routes.some((route) => route.route.id === selectedRouteId)) return;
    const deploymentRoute = routes.find((route) => route.route.serviceDeploymentId === requestedDeploymentId);
    setSelectedRouteId(deploymentRoute?.route.id ?? routes[0].route.id);
  }, [requestedDeploymentId, routes, selectedRouteId]);

  useEffect(() => {
    if (!activeRoute) return;
    const next = new URLSearchParams(searchParams);
    next.set('deployment_id', activeRoute.route.serviceDeploymentId);
    next.set('route_id', activeRoute.route.id);
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [activeRoute, searchParams, setSearchParams]);

  const vmRuntimeQuery = useQuery<LogRouteRuntimeStatus>({
    queryKey: ['logs-route-runtime', activeRoute?.route.id],
    queryFn: () => logsApi.getRouteRuntimeStatus(activeRoute?.route.id ?? ''),
    enabled: Boolean(activeRoute?.route.id && isVMRoute),
    refetchInterval: 30000,
  });
  const k8sRuntimeQuery = useQuery<LogsCollectorRuntimeStatus>({
    queryKey: [
      'logs-collector-runtime-status',
      activeDeployment?.k8sRef?.clusterId,
      defaultLogsCollectorNamespace,
    ],
    queryFn: () => {
      const clusterId = activeDeployment?.k8sRef?.clusterId ?? '';
      return logsApi.getLogsCollectorRuntimeStatus({
        clusterId,
        namespace: defaultLogsCollectorNamespace,
      });
    },
    enabled: Boolean(
      activeRoute?.route.id
      && !isVMRoute
      && activeDeployment?.k8sRef?.clusterId,
    ),
  });
  const rolloutsQuery = useQuery({
    queryKey: ['logs-route-rollouts', activeRoute?.route.id],
    queryFn: () => logsApi.getRouteRollouts(activeRoute?.route.id ?? ''),
    enabled: Boolean(activeRoute?.route.id && isVMRoute && historyOpen),
  });
  const collectorConfigMutation = useMutation({
    mutationFn: (routeId: string) => logsApi.getRouteCollectorConfig(routeId),
  });
  const retryMutation = useMutation({
    mutationFn: (targetId: string) => logsApi.retryRouteTarget(activeRoute?.route.id ?? '', targetId),
    onSuccess: () => {
      void vmRuntimeQuery.refetch();
      void rolloutsQuery.refetch();
    },
  });
  const enrollmentMutation = useMutation({
    mutationFn: (target: LogRouteRuntimeTarget) => issueHostEnrollmentToken(api, target.targetId),
    onSuccess: (credential) => {
      setEnrollment(credential);
      void vmRuntimeQuery.refetch();
    },
  });
  const rollbackMutation = useMutation({
    mutationFn: (rolloutId: string) => logsApi.rollbackRoute(activeRoute?.route.id ?? '', rolloutId),
    onSuccess: () => {
      setConfirmRollbackId('');
      void vmRuntimeQuery.refetch();
      void rolloutsQuery.refetch();
      void workspaceQuery.refetch();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (routeId: string) => logsApi.deleteRoute(routeId),
    onSuccess: async () => {
      setConfirmDeleteRouteId('');
      setSelectedRouteId('');
      await queryClient.invalidateQueries({ queryKey: ['logs-onboarding-workspace'] });
    },
  });

  const runtime = vmRuntimeQuery.data;
  const k8sRuntime = k8sRuntimeQuery.data;
  const runtimeLoading = isVMRoute ? vmRuntimeQuery.isLoading : k8sRuntimeQuery.isLoading;
  const runtimeError = isVMRoute ? vmRuntimeQuery.error : k8sRuntimeQuery.error;
  const visibleTargets = useMemo(
    () => (runtime?.targets ?? []).filter((target) => !onlyExceptions || targetIsException(target)),
    [onlyExceptions, runtime?.targets],
  );
  const lifecycle = activeRoute ? routeLifecycle(activeRoute) : null;
  const runtimeURL = activeRoute
    ? buildLogsRuntimeURL(productId, serviceId, {
      deploymentId: activeRoute.route.serviceDeploymentId,
      routeId: activeRoute.route.id,
    })
    : buildLogsRuntimeURL(productId, serviceId);
  const deploymentName = (deployment: ServiceDeployment | null) => deployment?.name || '未命名部署';

  function selectRoute(routeId: string) {
    const route = routes.find((item) => item.route.id === routeId);
    setSelectedRouteId(routeId);
    setConfirmDeleteRouteId('');
    setEnrollment(null);
    const next = new URLSearchParams(searchParams);
    if (route?.route.serviceDeploymentId) next.set('deployment_id', route.route.serviceDeploymentId);
    next.set('route_id', routeId);
    setSearchParams(next, { replace: true });
  }

  function openCollectorConfig(route: LogRouteView) {
    setCollectorConfigRoute(route);
    collectorConfigMutation.mutate(route.route.id);
  }

  const error = workspaceQuery.error
    ?? deploymentsQuery.error
    ?? vmRuntimeQuery.error
    ?? k8sRuntimeQuery.error
    ?? rolloutsQuery.error
    ?? deleteMutation.error
    ?? retryMutation.error
    ?? enrollmentMutation.error
    ?? rollbackMutation.error;

  return (
    <div className="console-workbench logs-routes-workbench flex min-h-[720px] flex-col xl:h-full xl:min-h-0">
      <section className="console-panel flex min-h-0 flex-1 flex-col overflow-hidden" aria-label="采集路由工作区">
        <div className="console-panel-header shrink-0">
          <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid w-full gap-2 lg:max-w-[940px] lg:grid-cols-2">
              <ServiceContextSelector />
              <label className="min-w-0">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted">采集路由</span>
                <select className="console-input h-9 w-full truncate text-xs font-semibold" aria-label="采集路由" value={activeRoute?.route.id ?? ''} onChange={(event) => selectRoute(event.target.value)}>
                  {routes.length === 0 ? <option value="">暂无采集路由</option> : routes.map((route) => {
                    const deployment = deployments.find((item) => item.id === route.route.serviceDeploymentId) ?? null;
                    return (
                      <option key={route.route.id} value={route.route.id}>
                        {buildRouteOptionLabel({
                          routeName: route.route.name || route.route.id,
                          deploymentName: deploymentName(deployment),
                          sourceType: route.route.sourceType,
                          endpointName: route.endpoint?.name || '下游未配置',
                        })}
                      </option>
                    );
                  })}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button className="console-button" onClick={() => {
                void workspaceQuery.refetch();
                void deploymentsQuery.refetch();
                if (isVMRoute) void vmRuntimeQuery.refetch();
                else void k8sRuntimeQuery.refetch();
              }}>
                <RefreshCw className={`h-3.5 w-3.5 ${workspaceQuery.isFetching || vmRuntimeQuery.isFetching || k8sRuntimeQuery.isFetching ? 'animate-spin' : ''}`} />刷新
              </button>
              {canMaintain ? <Link className="console-button console-button-primary" to={`${base}/agents/new`}><Plus className="h-3.5 w-3.5" />创建采集路由</Link> : null}
            </div>
          </div>
        </div>

        {error ? <LogsErrorLine message={(error as Error).message} /> : null}
        {!activeRoute ? (
          <LogsEmptyState
            title="暂无采集路由"
            description="创建路由后可查看预期覆盖、Agent 或 DaemonSet 运行状态。"
            action={canMaintain ? <Link className="console-button console-button-primary" to={`${base}/agents/new`}>创建采集路由</Link> : undefined}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-col gap-3 border-b border-outline px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-base font-semibold">{activeRoute.route.name || activeRoute.route.id}</h2>
                  <span className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold ${statusPillClass(lifecycle?.tone ?? 'muted')}`}>{lifecycle?.label ?? '-'}</span>
                </div>
                <div className="mt-1 truncate text-xs text-muted">
                  {deploymentName(activeDeployment)} · {logSourceLabel(activeRoute.route.sourceType)} · {activeRoute.endpoint ? `${activeRoute.endpoint.name} / ${logSinkLabel(activeRoute.endpoint.sinkType)}` : '下游未配置'}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {isVMRoute ? <button className="console-button" onClick={() => setHistoryOpen(true)}><FileClock className="h-3.5 w-3.5" />发布历史</button> : null}
                <button className="console-button" onClick={() => openCollectorConfig(activeRoute)}><FileText className="h-3.5 w-3.5" />查看配置</button>
                {canMaintain ? (
                  <>
                    <Link className="console-button console-button-primary" to={`${base}/agents/${activeRoute.route.id}/edit`}>更新路由</Link>
                    <button
                      className={`console-button ${confirmDeleteRouteId === activeRoute.route.id ? 'console-button-danger' : ''}`}
                      disabled={deleteMutation.isPending}
                      onClick={() => confirmDeleteRouteId === activeRoute.route.id ? deleteMutation.mutate(activeRoute.route.id) : setConfirmDeleteRouteId(activeRoute.route.id)}
                    >
                      {deleteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      {confirmDeleteRouteId === activeRoute.route.id ? '确认删除' : '删除'}
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            {deploymentMissing ? (
              <div className="console-notice console-notice-warning m-3">
                <div>
                  <div className="font-semibold">路由引用的服务部署不存在或尚未绑定</div>
                  <p className="mt-1">运行范围必须来自 ServiceDeployment，平台不会回退使用路由中的旧集群或主机字段。</p>
                  <Link className="mt-2 inline-flex font-semibold text-primary hover:underline" to={`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}`}>
                    返回服务详情修复部署
                  </Link>
                </div>
              </div>
            ) : runtimeError ? <LogsErrorLine message={(runtimeError as Error).message} /> : runtimeLoading ? (
              <div className="console-skeleton m-4 h-44" />
            ) : !isVMRoute ? (
              k8sRuntime
                ? <K8sRuntimePanel status={k8sRuntime} />
                : <LogsEmptyState title="暂无集群运行时状态" />
            ) : !runtime ? <LogsEmptyState title="暂无运行状态" /> : (
              <div className="min-h-0 flex-1 overflow-auto">
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 border-b border-outline">
                  <CoverageFact label="预期目标" value={runtime.expected} />
                  <CoverageFact label="已注册" value={runtime.registered} good={runtime.expected > 0 && runtime.registered === runtime.expected} />
                  <CoverageFact label="在线" value={runtime.online} good={runtime.expected > 0 && runtime.online === runtime.expected} />
                  <CoverageFact label="进程健康" value={runtime.healthy} good={runtime.expected > 0 && runtime.healthy === runtime.expected} />
                  <CoverageFact label="配置收敛" value={runtime.converged} good={runtime.expected > 0 && runtime.converged === runtime.expected} />
                </div>
                {runtime.blockingReason ? <div className="console-notice console-notice-warning m-3">{runtime.blockingReason}</div> : null}
                <div className="flex items-center justify-between gap-3 border-y border-outline bg-surface px-3 py-2">
                  <div className="text-xs font-semibold">目标状态 · {visibleTargets.length} 项</div>
                  <label className="flex items-center gap-2 text-xs text-muted">
                    <input type="checkbox" checked={onlyExceptions} onChange={(event) => setOnlyExceptions(event.target.checked)} />
                    仅看异常
                  </label>
                </div>
                {visibleTargets.length === 0 ? (
                  <LogsEmptyState title={onlyExceptions ? '当前没有异常目标' : '没有预期运行目标'} description={onlyExceptions ? '取消“仅看异常”可查看全部目标。' : '请先在服务部署中绑定运行目标。'} />
                ) : (
                  <>
                    <div className="space-y-2 p-3 md:hidden">
                      {visibleTargets.map((target) => (
                        <div key={target.targetId} className="runtime-target-mobile-card rounded border border-outline bg-white p-3">
                          <TargetHeading target={target} routeId={activeRoute.route.id} runtimeURL={runtimeURL} />
                          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
                            <MobileAxis label="连接" value={target.connectionStatus} />
                            <MobileAxis label="进程" value={target.processStatus} />
                            <MobileAxis label="配置" value={target.configStatus} />
                          </div>
                          {target.blockingReason ? <div className="mt-3 text-xs text-danger">{blockingReasonLabel(target.blockingReason)}</div> : null}
                          <TargetActions
                            canMaintain={canMaintain}
                            isVMRoute={isVMRoute}
                            target={target}
                            enrollmentPending={enrollmentMutation.isPending}
                            retryPending={retryMutation.isPending}
                            onEnroll={() => enrollmentMutation.mutate(target)}
                            onRetry={() => retryMutation.mutate(target.targetId)}
                          />
                        </div>
                      ))}
                    </div>
                    <table className="console-table hidden md:table min-w-[1040px] w-full">
                      <thead><tr><th>运行目标</th><th>安装</th><th>连接</th><th>进程</th><th>配置</th><th>阻断原因</th><th>最后心跳</th><th>健康观测</th><th className="text-right">操作</th></tr></thead>
                      <tbody>{visibleTargets.map((target) => (
                        <tr key={target.targetId}>
                          <td><TargetHeading target={target} routeId={activeRoute.route.id} runtimeURL={runtimeURL} /></td>
                          <td>{target.installationId ? '已注册' : '未安装'}</td>
                          <td><AxisState value={target.connectionStatus} /></td>
                          <td><AxisState value={target.processStatus} /></td>
                          <td><AxisState value={target.configStatus} /></td>
                          <td className="max-w-[220px] text-xs text-danger">{blockingReasonLabel(target.blockingReason)}</td>
                          <td className="font-mono text-[11px] text-muted">{formatTime(target.lastSeenAt)}</td>
                          <td className="font-mono text-[11px] text-muted">{formatTime(target.lastHealthAt)}</td>
                          <td className="text-right">
                            <TargetActions
                              canMaintain={canMaintain}
                              isVMRoute={isVMRoute}
                              target={target}
                              enrollmentPending={enrollmentMutation.isPending}
                              retryPending={retryMutation.isPending}
                              onEnroll={() => enrollmentMutation.mutate(target)}
                              onRetry={() => retryMutation.mutate(target.targetId)}
                            />
                          </td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {collectorConfigRoute ? (
        <ConfigDialog
          route={collectorConfigRoute}
          loading={collectorConfigMutation.isPending}
          error={collectorConfigMutation.error}
          collectorYAML={collectorConfigMutation.data?.collectorYAML ?? ''}
          onClose={() => { setCollectorConfigRoute(null); collectorConfigMutation.reset(); }}
        />
      ) : null}
      {historyOpen && activeRoute && isVMRoute ? (
        <HistoryDialog
          loading={rolloutsQuery.isLoading}
          error={rolloutsQuery.error ?? rollbackMutation.error}
          rollouts={rolloutsQuery.data ?? []}
          confirmRollbackId={confirmRollbackId}
          rollbackPending={rollbackMutation.isPending}
          canRollback={canMaintain}
          onRefresh={() => rolloutsQuery.refetch()}
          onRollback={(rolloutId) => {
            if (confirmRollbackId === rolloutId) rollbackMutation.mutate(rolloutId);
            else setConfirmRollbackId(rolloutId);
          }}
          onClose={() => { setHistoryOpen(false); setConfirmRollbackId(''); }}
        />
      ) : null}
      {enrollment ? <EnrollmentDialog enrollment={enrollment} onClose={() => setEnrollment(null)} /> : null}
    </div>
  );
}

function TargetHeading({ target, routeId, runtimeURL }: { target: LogRouteRuntimeTarget; routeId: string; runtimeURL: string }) {
  return (
    <div>
      {target.instanceUid ? (
        <Link className="font-semibold text-primary hover:underline" to={buildAgentDetailURL(target.instanceUid, runtimeURL, routeId)}>
          {target.targetName || target.targetId}
        </Link>
      ) : <span className="font-semibold" title={target.targetId}>{target.targetName || target.targetId}</span>}
    </div>
  );
}

function TargetActions({ canMaintain, isVMRoute, target, enrollmentPending, retryPending, onEnroll, onRetry }: {
  canMaintain: boolean;
  isVMRoute: boolean;
  target: LogRouteRuntimeTarget;
  enrollmentPending: boolean;
  retryPending: boolean;
  onEnroll: () => void;
  onRetry: () => void;
}) {
  if (!isVMRoute || !canMaintain) return null;
  if (!target.installationId) {
    return <button className="console-button mt-3 md:mt-0" disabled={enrollmentPending} onClick={onEnroll}>签发安装令牌</button>;
  }
  if (['failed', 'drift'].includes(target.configStatus)) {
    return <button className="console-button mt-3 md:mt-0" disabled={retryPending} onClick={onRetry}>重试下发</button>;
  }
  return <span className="text-xs text-muted">无需操作</span>;
}

function ConfigDialog({ route, loading, error, collectorYAML, onClose }: {
  route: LogRouteView;
  loading: boolean;
  error: Error | null;
  collectorYAML: string;
  onClose: () => void;
}) {
  if (typeof document === 'undefined') return null;
  return createPortal((
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/28 px-4 py-6">
      <section className="grid h-[80vh] w-full max-w-[920px] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-md border border-outline bg-white shadow-[0_24px_80px_rgba(24,52,96,0.28)]">
        <div className="flex items-center justify-between gap-3 border-b border-outline px-4 py-3">
          <div><div className="text-sm font-semibold" title={route.route.id}>采集配置</div></div>
          <div className="flex gap-2">
            <button className="console-icon-button" aria-label="复制采集配置" title="复制" disabled={!collectorYAML} onClick={() => navigator.clipboard?.writeText(collectorYAML)}><Copy className="h-4 w-4" /></button>
            <button className="console-icon-button" aria-label="关闭采集配置" title="关闭" onClick={onClose}><XCircle className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="min-h-0 overflow-auto bg-surface p-4">
          {loading ? <LogsEmptyState title="正在加载采集配置" /> : error ? <LogsErrorLine message={error.message} /> : (
            <pre className="min-h-full overflow-auto rounded border border-outline bg-white p-4 font-mono text-[11px] leading-5 whitespace-pre-wrap">{collectorYAML || '采集配置为空'}</pre>
          )}
        </div>
      </section>
    </div>
  ), document.body);
}

function HistoryDialog({ loading, error, rollouts, confirmRollbackId, rollbackPending, canRollback, onRefresh, onRollback, onClose }: {
  loading: boolean;
  error: Error | null;
  rollouts: Awaited<ReturnType<typeof logsApi.getRouteRollouts>>;
  confirmRollbackId: string;
  rollbackPending: boolean;
  canRollback: boolean;
  onRefresh: () => void;
  onRollback: (rolloutId: string) => void;
  onClose: () => void;
}) {
  if (typeof document === 'undefined') return null;
  return createPortal((
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/28 px-4 py-6">
      <section className="flex max-h-[82vh] w-full max-w-[960px] flex-col overflow-hidden rounded-md border border-outline bg-white shadow-[0_24px_80px_rgba(24,52,96,0.28)]">
        <div className="flex items-center justify-between gap-3 border-b border-outline px-4 py-3">
          <div><div className="text-sm font-semibold">发布历史</div><div className="mt-1 text-xs text-muted">回滚会复用历史产物创建新 generation，不修改已有发布记录。</div></div>
          <div className="flex gap-2">
            <button className="console-icon-button" aria-label="刷新发布历史" onClick={onRefresh}><RefreshCw className="h-4 w-4" /></button>
            <button className="console-icon-button" aria-label="关闭发布历史" onClick={onClose}><XCircle className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="min-h-0 overflow-auto">
          {error ? <LogsErrorLine message={error.message} /> : loading ? <div className="console-skeleton m-4 h-32" /> : rollouts.length === 0 ? <LogsEmptyState title="尚无发布记录" /> : (
            <table className="console-table min-w-[760px] w-full">
              <thead><tr><th>Generation</th><th>状态</th><th>目标收敛</th><th>发布时间</th><th>来源</th><th className="text-right">操作</th></tr></thead>
              <tbody>{rollouts.map((rollout, index) => (
                <tr key={rollout.rolloutId}>
                  <td><div className="font-semibold" title={rollout.rolloutId}>#{rollout.generation}</div></td>
                  <td><AxisState value={rollout.status} /></td>
                  <td>{rollout.convergedTargets} / {rollout.expectedTargets}</td>
                  <td>{formatTime(rollout.createdAt)}</td>
                  <td>{rollout.rollbackOf ? `回滚自 #${rollout.rollbackOf.slice(-6)}` : '发布'}</td>
                  <td className="text-right">
                    {index === 0 || !canRollback ? <span className="text-xs text-muted">{index === 0 ? '当前期望' : '只读'}</span> : (
                      <button className={confirmRollbackId === rollout.rolloutId ? 'console-button console-button-danger' : 'console-button'} disabled={rollbackPending} onClick={() => onRollback(rollout.rolloutId)}>
                        <RotateCcw className="h-3.5 w-3.5" />{confirmRollbackId === rollout.rolloutId ? '确认回滚' : '回滚到此版本'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  ), document.body);
}

function EnrollmentDialog({ enrollment, onClose }: { enrollment: CollectorEnrollmentCredential; onClose: () => void }) {
  if (typeof document === 'undefined') return null;
  return createPortal((
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/28 px-4 py-6">
      <section className="w-full max-w-[680px] rounded-md border border-outline bg-white p-4 shadow-[0_24px_80px_rgba(24,52,96,0.28)]">
        <div className="flex items-start justify-between gap-3">
          <div><div className="text-sm font-semibold text-primary">一次性安装令牌</div><p className="mt-1 text-xs text-muted">仅展示一次。请在有效期内输入安装流程，禁止保存到脚本仓库或日志。</p></div>
          <button className="console-icon-button" aria-label="关闭安装令牌" onClick={onClose}><XCircle className="h-4 w-4" /></button>
        </div>
        <pre className="mt-3 overflow-auto rounded border border-outline bg-surface p-3 font-mono text-xs">{enrollment.token}</pre>
        <div className="console-notice console-notice-warning mt-3 text-xs">
          <div className="font-semibold">下一步在目标主机完成 Supervisor 注册</div>
          <p className="mt-1">
            Enrollment 与 OpAMP 必须使用 Collector 控制面的内网地址。K8S 基础清单为
            {' '}<span className="font-mono">http://&lt;节点 IP&gt;:30081</span>，不能使用前端 30080。
          </p>
          <p className="mt-1">
            令牌过期但尚未注册时，可关闭弹窗后对该主机重新签发；已注册后请轮换安装凭据，不能重复 Enrollment。
          </p>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="font-mono text-[11px] text-muted">installation_id: {enrollment.installation.installationId}</span>
          <button className="console-button console-button-primary" onClick={() => navigator.clipboard?.writeText(enrollment.token)}><Copy className="h-3.5 w-3.5" />复制令牌</button>
        </div>
      </section>
    </div>
  ), document.body);
}

function K8sRuntimePanel({ status }: { status: LogsCollectorRuntimeStatus }) {
  const summary = summarizeK8sRuntimeStatus(status);
  const stateTone = status.ready
    ? 'text-emerald-700'
    : status.status === 'degraded'
      ? 'text-warning'
      : status.status === 'unavailable'
        ? 'text-danger'
        : 'text-muted';
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="grid border-b border-outline sm:grid-cols-2 xl:grid-cols-4">
        <RuntimeFact label="共享运行时" value={status.runtime ? '已发布' : '未部署'} />
        <RuntimeFact label="DaemonSet 状态" value={summary.label} valueClassName={stateTone} />
        <RuntimeFact label="节点就绪" value={summary.nodes} />
        <RuntimeFact label="配置状态" value={axisLabel(summary.configStatus)} />
      </div>
      {summary.reason ? <div className="console-notice console-notice-warning m-3">{summary.reason}</div> : null}
      <div className="border-y border-outline bg-surface px-3 py-2 text-xs font-semibold">
        集群级共享状态
      </div>
      <div className="overflow-x-auto">
        <table className="console-table min-w-[820px] w-full">
          <thead>
            <tr>
              <th>集群运行时</th>
              <th>DaemonSet</th>
              <th>节点</th>
              <th>配置</th>
              <th>观测时间</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div className="font-semibold text-primary">{status.clusterId}</div>
                <div className="mt-1 font-mono text-[11px] text-muted">{status.namespace}</div>
              </td>
              <td><span className={`text-xs font-semibold ${stateTone}`}>{summary.label}</span></td>
              <td className="font-mono text-xs">{status.readyNodes}/{status.desiredNodes || '-'}</td>
              <td><AxisState value={status.configStatus} /></td>
              <td className="font-mono text-[11px] text-muted">{formatTime(status.observedAt)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="px-3 py-2 text-[11px] text-muted">
        同一 K8s 集群中的服务共用该 DaemonSet 快照；普通页面刷新只读取平台快照，不访问目标集群。
      </p>
    </div>
  );
}

function RuntimeFact({ label, value, valueClassName = 'text-on-surface' }: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="border-b border-r border-outline px-3 py-3">
      <div className="text-[11px] font-semibold text-muted">{label}</div>
      <div className={`mt-1 text-sm font-semibold ${valueClassName}`}>{value}</div>
    </div>
  );
}

function CoverageFact({ label, value, good = false }: { label: string; value: number; good?: boolean }) {
  return <div className="border-b border-r border-outline px-3 py-2.5 sm:py-3"><div className="text-[11px] font-semibold text-muted">{label}</div><div className={`mt-1 font-mono text-sm font-semibold ${good ? 'text-emerald-700' : 'text-on-surface'}`}>{value}</div></div>;
}

function MobileAxis({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[10px] text-muted">{label}</div><AxisState value={value} /></div>;
}

function AxisState({ value }: { value: string }) {
  const tone = ['online', 'healthy', 'applied', 'converged', 'ready'].includes(value)
    ? 'text-emerald-700'
    : ['unhealthy', 'failed', 'drift', 'stale', 'blocked', 'degraded'].includes(value)
      ? 'text-danger'
      : value === 'applying' ? 'text-primary' : 'text-muted';
  return <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${tone}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{axisLabel(value)}</span>;
}

function axisLabel(value: string) {
  const labels: Record<string, string> = {
    online: '在线', offline: '离线', revoked: '已吊销',
    healthy: '健康', unhealthy: '异常', unknown: '未知',
    pending: '待下发', applying: '应用中', applied: '已应用', failed: '失败', drift: '配置漂移',
    not_installed: '未安装', blocked: '已阻塞', degraded: '部分异常', converged: '已收敛',
    ready: '已就绪', stale: '状态过期', unavailable: '不可用',
  };
  return (labels[value] ?? value) || '-';
}

function targetIsException(target: LogRouteRuntimeTarget) {
  return !target.installationId
    || target.connectionStatus !== 'online'
    || target.processStatus !== 'healthy'
    || target.configStatus !== 'applied'
    || Boolean(target.blockingReason);
}

function blockingReasonLabel(reason: string) {
  const labels: Record<string, string> = {
    not_installed: 'Agent 未安装',
    offline: 'Agent 离线',
    process_unhealthy: 'Collector 进程异常',
    config_failed: '配置应用失败',
    config_drift: '配置漂移',
  };
  return (labels[reason] ?? reason) || '-';
}

function formatTime(value: string) {
  return value ? new Date(value).toLocaleString() : '-';
}
