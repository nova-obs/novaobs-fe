import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, FileCode2, Loader2, RefreshCw, Rocket, Server, ServerCog } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { StatusBadge } from '../../components/StatusBadge';
import { api } from '../../services/api';
import { LogsPublishPreviewPanel } from '../logs/LogsPublishPreviewPanel';
import { defaultLogsCollectorNamespace, logsApi, normalizeLogsCollectorNamespace, type LogRouteView, type LogsCollectorRuntimePublishResult, type LogsCollectorRuntimeResourceStatus, type LogsCollectorRuntimeStatus, type LogsServiceSummary } from '../logs/api';
import { metricsApi, type MetricRoute, type MetricsCollectorRuntimePublishResult, type MetricsCollectorRuntimeResourceStatus } from '../metrics/api';
import { useK8sOpsContext } from './context';

type PublishTaskType = 'base' | 'incremental';

interface RuntimeRow {
  id: string;
  status: string;
  namespace: string;
}

interface MetricsPublishContext {
  routeId: string;
  clusterId: string;
  namespace: string;
  previewId?: string;
  confirmationToken?: string;
}

function metricsPublishContextKey(input: Pick<MetricsPublishContext, 'routeId' | 'clusterId' | 'namespace'>) {
  return `${input.clusterId}\u0000${input.namespace}\u0000${input.routeId}`;
}

export function K8sObservabilityAccessPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const runtime = searchParams.get('runtime') === 'metrics' ? 'metrics' : 'logs';

  function switchRuntime(nextRuntime: 'logs' | 'metrics') {
    const next = new URLSearchParams(searchParams);
    next.set('runtime', nextRuntime);
    next.delete('route_id');
    next.delete('task');
    setSearchParams(next);
  }

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-md border border-outline bg-white p-1" aria-label="选择观测接入运行时">
        <button type="button" className={`console-button h-8 border-0 text-xs ${runtime === 'logs' ? 'bg-primary text-white hover:bg-primary' : ''}`} onClick={() => switchRuntime('logs')}>日志采集运行时</button>
        <button type="button" className={`console-button h-8 border-0 text-xs ${runtime === 'metrics' ? 'bg-primary text-white hover:bg-primary' : ''}`} onClick={() => switchRuntime('metrics')}>指标采集运行时</button>
      </div>
      {runtime === 'metrics' ? <MetricsCollectorAccessPanel /> : <LogsCollectorAccessPanel />}
    </div>
  );
}

function LogsCollectorAccessPanel() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeClusterId, activeCluster, clusters, isLoadingClusters, clusterError } = useK8sOpsContext();
  const requestedClusterId = activeClusterId || searchParams.get('cluster_id') || '';
  const requestedNamespace = normalizeLogsCollectorNamespace(searchParams.get('namespace'));
  const requestedTaskType = searchParams.get('task') === 'incremental' ? 'incremental' : searchParams.get('task') === 'base' ? 'base' : '';
  const [selectedClusterId, setSelectedClusterId] = useState(requestedClusterId);
  const [namespace, setNamespace] = useState(requestedNamespace);
  const [pendingPublish, setPendingPublish] = useState<LogsCollectorRuntimePublishResult | null>(null);
  const [lastResult, setLastResult] = useState<LogsCollectorRuntimePublishResult | null>(null);
  const [showResourceDetails, setShowResourceDetails] = useState(false);
  const [publishingServiceId, setPublishingServiceId] = useState<string | null>(null);
  const effectiveClusterId = activeClusterId || selectedClusterId;
  const selectedCluster = activeClusterId
    ? activeCluster
    : clusters.find((cluster) => cluster.id === effectiveClusterId);

  const runtimeStatusQuery = useQuery({
    queryKey: ['logs-collector-runtime-status', effectiveClusterId, namespace],
    queryFn: () => logsApi.getLogsCollectorRuntimeStatus({ clusterId: effectiveClusterId, namespace }),
    enabled: Boolean(effectiveClusterId && namespace.trim() && selectedCluster),
    retry: false,
  });

  const workspaceQuery = useQuery({
	queryKey: ['logs-service-workspaces'],
	queryFn: async () => {
		const services = await api.getServices();
		const workspaces = await Promise.all(services.filter((service) => service.productId).map((service) => logsApi.getWorkspace(service.productId, service.id)));
		return { services: workspaces.flatMap((workspace) => workspace.services), routes: workspaces.flatMap((workspace) => workspace.routes) };
	},
    enabled: Boolean(runtimeStatusQuery.data?.ready),
  });

  const serviceRouteGroups = useMemo(() => {
    const routes = workspaceQuery.data?.routes ?? [];
    const services = workspaceQuery.data?.services ?? [];
    const serviceById = new Map(services.map((s) => [s.id, s]));
    const clusterRoutes = routes.filter((r) => r.source?.clusterId === effectiveClusterId || r.route.sourceType === 'vm_file');
    const groups = new Map<string, { service: LogsServiceSummary | null; routes: LogRouteView[] }>();
    for (const r of clusterRoutes) {
      const sid = r.route.serviceId;
      const existing = groups.get(sid);
      if (existing) {
        existing.routes.push(r);
      } else {
        groups.set(sid, { service: serviceById.get(sid) ?? null, routes: [r] });
      }
    }
    return [...groups.entries()].map(([serviceId, group]) => {
      const pendingRoutes = group.routes.filter((r) => r.route.lastPublishStatus !== 'published' && r.route.lastPublishStatus !== 'applied');
      return { serviceId, ...group, pendingCount: pendingRoutes.length, pendingRouteIds: pendingRoutes.map((r) => r.route.id) };
    });
  }, [effectiveClusterId, workspaceQuery.data]);

  useEffect(() => {
    if (requestedClusterId && requestedClusterId !== selectedClusterId) {
      setSelectedClusterId(requestedClusterId);
    }
  }, [requestedClusterId, selectedClusterId]);

  useEffect(() => {
    if (requestedNamespace) {
      setNamespace(requestedNamespace);
    }
  }, [requestedNamespace]);

  useEffect(() => {
    if (!selectedClusterId && clusters.length) {
      setSelectedClusterId(clusters[0].id);
    }
  }, [clusters, selectedClusterId]);

  useEffect(() => {
    setPendingPublish(null);
    setLastResult(null);
  }, [effectiveClusterId]);

  const runtimeRows = useMemo(
    () => [logsCollectorRuntimeRow(effectiveClusterId, namespace, runtimeStatusQuery.data)],
    [effectiveClusterId, namespace, runtimeStatusQuery.data],
  );
  const runtimeStatusMessage = runtimeStatusQuery.data?.message ?? '';
  const runtimeStatus = runtimeStatusQuery.data;
  const runtimeStatusTone = runtimeStatusQuery.data?.ready
    ? 'success'
    : runtimeStatusQuery.data?.status === 'unavailable'
      ? 'danger'
      : 'warning';

  const namespaceReady = Boolean(namespace.trim());
  const clusterReadOnly = Boolean(selectedCluster?.readOnly);
  const clusterUnknown = Boolean(effectiveClusterId && !selectedCluster && !isLoadingClusters);
  const hasPendingConfirmation = Boolean(pendingPublish?.requiresConfirmation);
  const canPublish = Boolean(effectiveClusterId && selectedCluster && namespaceReady && !clusterReadOnly && !hasPendingConfirmation);
  const canPreviewBase = canPublish && runtimeStatus?.status === 'missing_resources';
  const canPreviewIncremental = canPublish && Boolean(runtimeStatus?.ready);
  const publishMutation = useMutation({
    mutationFn: (input: { taskType: PublishTaskType; routeIds?: string[]; previewId?: string; confirmationToken?: string }) => logsApi.publishLogsCollectorRuntime({
      clusterId: effectiveClusterId,
      namespace,
      taskType: input.taskType,
      routeIds: input.routeIds,
      previewId: input.previewId,
      confirmationToken: input.confirmationToken,
    }),
    onSuccess: async (result) => {
      setLastResult(result);
      setPendingPublish(result.requiresConfirmation ? result : null);
      if (!result.requiresConfirmation) setPublishingServiceId(null);
      await queryClient.invalidateQueries({ queryKey: ['logs-collector-runtime-status', effectiveClusterId, namespace] });
	  await queryClient.invalidateQueries({ queryKey: ['logs-service-workspaces'] });
      await queryClient.invalidateQueries({ queryKey: ['k8s-deployment-history', effectiveClusterId] });
      await queryClient.invalidateQueries({ queryKey: ['k8s-audit-events', effectiveClusterId] });
    },
  });

  const blocker = isLoadingClusters && !effectiveClusterId
    ? '正在加载已登记集群'
    : !effectiveClusterId
      ? '请先选择已登记集群'
      : clusterUnknown
        ? '目标集群未登记'
        : clusterReadOnly
          ? '当前集群为只读接入，不能部署平台运行时'
          : !namespaceReady
            ? '请填写平台运行时 namespace'
            : '';

  function selectCluster(nextClusterId: string) {
    setSelectedClusterId(nextClusterId);
    setPendingPublish(null);
    setLastResult(null);
    setSearchParams(nextClusterId ? { cluster_id: nextClusterId, namespace: normalizeLogsCollectorNamespace(namespace) } : {});
  }

  function previewRuntime(taskType: PublishTaskType, routeIds?: string[]) {
    setPendingPublish(null);
    publishMutation.mutate({ taskType, routeIds });
  }

  function previewServicePublish(serviceId: string, routeIds: string[]) {
    setPublishingServiceId(serviceId);
    previewRuntime('incremental', routeIds);
  }

  function applyRuntime() {
    if (!pendingPublish?.previewId || !pendingPublish.confirmationToken) return;
    publishMutation.mutate({
      taskType: pendingPublish.taskType === 'base' ? 'base' : 'incremental',
      previewId: pendingPublish.previewId,
      confirmationToken: pendingPublish.confirmationToken,
    });
  }

  return (
    <div className="space-y-4">
      <DataPanel
        title="集群观测接入"
        meta={effectiveClusterId ? `cluster/${selectedCluster?.name || effectiveClusterId}` : '请选择目标集群'}
        action={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            {!activeClusterId ? (
              <select
                className="console-input h-9 min-w-48 text-sm font-semibold"
                value={effectiveClusterId}
                onChange={(event) => selectCluster(event.target.value)}
                aria-label="选择观测接入集群"
              >
                <option value="">选择集群</option>
                {effectiveClusterId && !clusters.some((cluster) => cluster.id === effectiveClusterId) ? (
                  <option value={effectiveClusterId}>{effectiveClusterId} / 未登记</option>
                ) : null}
                {clusters.map((cluster) => (
                  <option key={cluster.id} value={cluster.id}>{cluster.name || cluster.id}</option>
                ))}
              </select>
            ) : null}
            <button className="console-button" onClick={() => runtimeStatusQuery.refetch()} disabled={runtimeStatusQuery.isFetching || !effectiveClusterId || !namespaceReady || !selectedCluster} aria-label="刷新观测运行时">
              {runtimeStatusQuery.isFetching ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              刷新
            </button>
          </div>
        )}
      >
        <div className="space-y-4">
          {clusterError ? <InlineNotice tone="danger" message={clusterError.message} /> : null}
          {blocker ? <InlineNotice tone={clusterReadOnly ? 'warning' : 'danger'} message={blocker} /> : null}
          {runtimeStatusQuery.error ? <InlineNotice tone="danger" message={(runtimeStatusQuery.error as Error).message} /> : null}
          {runtimeStatusMessage ? <InlineNotice tone={runtimeStatusTone} message={runtimeStatusMessage} /> : null}
          {publishMutation.error ? <InlineNotice tone="danger" message={(publishMutation.error as Error).message} /> : null}
          {lastResult && !lastResult.requiresConfirmation ? <InlineNotice tone="success" message={lastResult.message || '平台运行时已部署'} /> : null}

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
            <div className="overflow-auto rounded-md border border-outline bg-surface-lowest">
              <table className="console-table w-full min-w-[560px]">
                <thead>
                  <tr>
                    <th>运行时</th>
                    <th>状态</th>
                    <th>Namespace</th>
                  </tr>
                </thead>
                <tbody>
                  {runtimeRows.map((runtime) => (
                    <tr key={runtime.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <RuntimeIcon />
                          <div>
                            <div className="text-sm font-semibold text-on-surface">日志采集运行时</div>
                          </div>
                        </div>
                      </td>
                      <td><StatusBadge value={runtime.status || 'pending_publish'} /></td>
                      <td className="font-mono text-xs">{runtime.namespace || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-md border border-outline bg-surface-lowest p-3">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-on-surface">
                <ServerCog className="h-4 w-4 text-primary" />
                平台运行时
              </div>
              <label className="block">
                <span className="text-xs font-semibold text-muted">Namespace</span>
                <input
                  className="console-input mt-1 h-9 w-full font-mono text-sm"
                  value={namespace}
                  onChange={(event) => {
                    setNamespace(normalizeLogsCollectorNamespace(event.target.value));
                    setPendingPublish(null);
                    setLastResult(null);
                  }}
                />
              </label>
              <div className="mt-3 space-y-2 text-xs text-muted">
                <RuntimeFact label="部署集群" value={effectiveClusterId || '-'} />
                <RuntimeFact label="写入策略" value={clusterReadOnly ? '只读' : '允许写入'} />
                <RuntimeFact label="采集器" value="logs_collector" />
                <RuntimeFact label="当前任务" value={requestedTaskType ? publishTaskLabel(requestedTaskType) : '按基础状态选择'} />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <RuntimeStepperHeader
              step1Complete={runtimeStatus?.ready ?? false}
              activeStep={runtimeStatus?.ready ? 2 : 1}
            />

            <RuntimeStepPanel
              stepNumber={1}
              title="基础组件发布"
              complete={runtimeStatus?.ready ?? false}
              active={!runtimeStatus?.ready}
              description={runtimeStatus?.ready
                ? `基础资源已就绪 · 最后发布时间：${runtimeStatus.runtime?.lastPublishedAt || '-'}`
                : '检测到基础资源缺失，预览将生成 Namespace、RBAC、ServiceAccount、基础 ConfigMap、Service 和 DaemonSet。'}
              action={runtimeStatus?.ready ? (
                <button
                  className="console-button text-xs"
                  disabled={publishMutation.isPending}
                  onClick={() => previewRuntime('base')}
                  title="重新发布基础组件（通常不需要）"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  重新发布
                </button>
              ) : (
                <button
                  className="console-button console-button-primary"
                  disabled={!canPreviewBase || publishMutation.isPending}
                  onClick={() => previewRuntime('base')}
                  title={blocker || runtimeStatus?.message || ''}
                >
                  <Rocket className="h-3.5 w-3.5" />
                  预览基础组件发布
                </button>
              )}
            >
              <button
                type="button"
                className="mt-3 flex w-full items-center gap-1.5 rounded border border-outline bg-white px-2 py-1.5 text-xs font-semibold text-muted hover:bg-surface-low hover:text-on-surface"
                onClick={() => setShowResourceDetails(!showResourceDetails)}
              >
                {showResourceDetails ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                查看基础资源清单
                <span className="ml-auto"><StatusBadge value={runtimeStatus?.ready ? 'ready' : runtimeStatus?.status || 'checking'} /></span>
              </button>
              {showResourceDetails ? (
                <div className="mt-2 overflow-hidden rounded border border-outline">
                  <RuntimeResourceStatusTable resources={runtimeStatus?.resources ?? []} />
                </div>
              ) : null}
            </RuntimeStepPanel>

            <RuntimeStepPanel
              stepNumber={2}
              title="服务配置增量发布"
              complete={false}
              active={runtimeStatus?.ready ?? false}
              description={runtimeStatus?.ready
                ? `按服务维度展示待发布配置变更 · 共 ${serviceRouteGroups.length} 个服务`
                : '基础组件缺失时不能执行增量发布，请先完成 Step 1。'}
              action={runtimeStatus?.ready ? (
                <button
                  className="console-button"
                  disabled={!canPreviewIncremental || publishMutation.isPending}
                  onClick={() => previewRuntime('incremental')}
                  title="预览所有服务增量变更"
                >
                  <Rocket className="h-3.5 w-3.5" />
                  全量预览
                </button>
              ) : (
                <button className="console-button" disabled title="基础组件未就绪">
                  <Rocket className="h-3.5 w-3.5" />
                  预览增量发布
                </button>
              )}
            >
              {runtimeStatus?.ready && serviceRouteGroups.length > 0 ? (
                <div className="mt-3 divide-y divide-outline overflow-hidden rounded border border-outline">
                  {serviceRouteGroups.map((group) => (
                    <ServicePublishRow
                      key={group.serviceId}
                      group={group}
                      publishing={publishingServiceId === group.serviceId && publishMutation.isPending}
                      disabled={!canPreviewIncremental || publishMutation.isPending}
                      onPreview={() => previewServicePublish(group.serviceId, group.routes.map((r) => r.route.id))}
                    />
                  ))}
                </div>
              ) : runtimeStatus?.ready ? (
                <div className="mt-3 rounded border border-outline bg-white px-3 py-4 text-center text-xs text-muted">
                  当前集群暂无采集路由。在采集路由页创建路由后，此处将按服务展示待发布配置。
                </div>
              ) : null}
            </RuntimeStepPanel>
          </div>

          {pendingPublish ? (
            <div className="space-y-3">
              <LogsPublishPreviewPanel preview={pendingPublish} />
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-outline bg-surface-lowest px-3 py-2">
                <div className="text-xs font-semibold text-muted">{publishTaskLabel(pendingPublish.taskType)} · {pendingPublish.diffs.length || pendingPublish.resources.length} 个资源待确认</div>
                <button
                  className="console-button console-button-primary"
                  disabled={!pendingPublish.previewId || !pendingPublish.confirmationToken || publishMutation.isPending}
                  onClick={applyRuntime}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  确认{publishTaskLabel(pendingPublish.taskType)}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </DataPanel>
    </div>
  );
}

function MetricsCollectorAccessPanel() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeClusterId, activeCluster, clusters, isLoadingClusters, clusterError } = useK8sOpsContext();
  const requestedClusterId = activeClusterId || searchParams.get('cluster_id') || '';
  const requestedRouteId = searchParams.get('route_id') || '';
  const [selectedClusterId, setSelectedClusterId] = useState(requestedClusterId);
  const [selectedRouteId, setSelectedRouteId] = useState(requestedRouteId);
  const namespace = 'novaapm-system';
  const [pendingPublish, setPendingPublish] = useState<MetricsCollectorRuntimePublishResult | null>(null);
  const [pendingContext, setPendingContext] = useState<MetricsPublishContext | null>(null);
  const [lastResult, setLastResult] = useState<MetricsCollectorRuntimePublishResult | null>(null);
  const effectiveClusterId = activeClusterId || selectedClusterId;
  const selectedCluster = activeClusterId ? activeCluster : clusters.find((cluster) => cluster.id === effectiveClusterId);
  const clusterReadOnly = Boolean(selectedCluster?.readOnly);

  const routesQuery = useQuery({
    queryKey: ['metrics-routes-by-cluster', effectiveClusterId],
    queryFn: () => metricsApi.listRoutesByCluster(effectiveClusterId),
    enabled: Boolean(effectiveClusterId && selectedCluster),
    retry: false,
  });
  const routes = routesQuery.data ?? [];
  const selectedRoute = routes.find((route) => route.id === selectedRouteId) ?? routes[0] ?? null;
  const runtimeRoutes = selectedRoute ? routes.filter((route) => route.runtimeId === selectedRoute.runtimeId) : [];
  const currentContextKey = metricsPublishContextKey({ routeId: selectedRoute?.id || '', clusterId: effectiveClusterId, namespace });
  const currentContextRef = useRef(currentContextKey);
  currentContextRef.current = currentContextKey;

  useEffect(() => {
    if (requestedClusterId && requestedClusterId !== selectedClusterId) setSelectedClusterId(requestedClusterId);
  }, [requestedClusterId, selectedClusterId]);

  useEffect(() => {
    if (requestedRouteId && requestedRouteId !== selectedRouteId) setSelectedRouteId(requestedRouteId);
  }, [requestedRouteId, selectedRouteId]);

  useEffect(() => {
    if (!selectedClusterId && clusters.length) setSelectedClusterId(clusters[0].id);
  }, [clusters, selectedClusterId]);

  useEffect(() => {
    if (!selectedRouteId && routes[0]) setSelectedRouteId(routes[0].id);
  }, [routes, selectedRouteId]);

  useEffect(() => {
    setPendingPublish(null);
    setPendingContext(null);
    setLastResult(null);
  }, [effectiveClusterId, selectedRouteId, namespace]);

  const runtimeStatusQuery = useQuery({
    queryKey: ['metrics-collector-runtime-status', selectedRoute?.id, namespace],
    queryFn: () => metricsApi.getCollectorRuntimeStatus({ routeId: selectedRoute!.id, namespace }),
    enabled: Boolean(selectedRoute?.id && namespace.trim()), retry: false,
  });
  const publishMutation = useMutation({
    mutationFn: (input: MetricsPublishContext) => metricsApi.publishCollectorRuntime({
      routeId: input.routeId,
      namespace: input.namespace,
      previewId: input.previewId,
      confirmationToken: input.confirmationToken,
    }),
    onSuccess: async (result, input) => {
      if (metricsPublishContextKey(input) !== currentContextRef.current) return;
      setLastResult(result);
      setPendingPublish(result.requiresConfirmation ? result : null);
      setPendingContext(result.requiresConfirmation ? input : null);
      await queryClient.invalidateQueries({ queryKey: ['metrics-collector-runtime-status', input.routeId, input.namespace] });
      await queryClient.invalidateQueries({ queryKey: ['metrics-routes-by-cluster', input.clusterId] });
      await queryClient.invalidateQueries({ queryKey: ['k8s-deployment-history', input.clusterId] });
      await queryClient.invalidateQueries({ queryKey: ['k8s-audit-events', input.clusterId] });
    },
  });

  const blocker = isLoadingClusters && !effectiveClusterId
    ? '正在加载已登记集群'
    : !effectiveClusterId
      ? '请先选择已登记集群'
      : !selectedCluster
        ? '目标集群未登记'
        : clusterReadOnly
          ? '当前集群为只读接入，不能部署指标采集运行时'
          : !selectedRoute
            ? '当前集群暂无指标采集路由'
            : '';
  const runtimeStatus = runtimeStatusQuery.data;
  const canPublish = !blocker && !pendingPublish?.requiresConfirmation && !publishMutation.isPending;

  function updateSearch(nextClusterId: string, nextRouteId = '') {
    const next = new URLSearchParams(searchParams);
    next.set('runtime', 'metrics');
    if (nextClusterId) next.set('cluster_id', nextClusterId); else next.delete('cluster_id');
    if (nextRouteId) next.set('route_id', nextRouteId); else next.delete('route_id');
    next.set('namespace', namespace);
    setSearchParams(next);
  }

  function previewRuntime() {
    if (!selectedRoute) return;
    setPendingPublish(null);
    setPendingContext(null);
    publishMutation.mutate({ routeId: selectedRoute.id, clusterId: effectiveClusterId, namespace });
  }

  function applyRuntime() {
    if (!pendingPublish?.previewId || !pendingPublish.confirmationToken || !pendingContext) return;
    publishMutation.mutate({ ...pendingContext, previewId: pendingPublish.previewId, confirmationToken: pendingPublish.confirmationToken });
  }

  return (
    <DataPanel
      title="指标采集运行时"
      meta={effectiveClusterId ? `cluster/${selectedCluster?.name || effectiveClusterId} · vmagent Deployment` : '请选择目标集群'}
      action={(
        <div className="flex flex-wrap items-center gap-2">
          {!activeClusterId ? (
            <select className="console-input h-9 min-w-48 text-sm" value={effectiveClusterId} disabled={publishMutation.isPending} onChange={(event) => { setSelectedClusterId(event.target.value); setSelectedRouteId(''); updateSearch(event.target.value); }} aria-label="选择指标采集集群">
              <option value="">选择集群</option>
              {clusters.map((cluster) => <option key={cluster.id} value={cluster.id}>{cluster.name || cluster.id}</option>)}
            </select>
          ) : null}
          <button className="console-button" type="button" disabled={!selectedRoute || runtimeStatusQuery.isFetching} onClick={() => void runtimeStatusQuery.refetch()}><RefreshCw className={`h-3.5 w-3.5 ${runtimeStatusQuery.isFetching ? 'animate-spin' : ''}`} />刷新</button>
        </div>
      )}
    >
      <div className="space-y-4">
        {clusterError ? <InlineNotice tone="danger" message={clusterError.message} /> : null}
        {blocker ? <InlineNotice tone={clusterReadOnly ? 'warning' : 'danger'} message={blocker} /> : null}
        {routesQuery.error ? <InlineNotice tone="danger" message={(routesQuery.error as Error).message} /> : null}
        {runtimeStatusQuery.error ? <InlineNotice tone="danger" message={(runtimeStatusQuery.error as Error).message} /> : null}
        {publishMutation.error ? <InlineNotice tone="danger" message={(publishMutation.error as Error).message} /> : null}
        {lastResult && !lastResult.requiresConfirmation ? <InlineNotice tone="success" message={lastResult.message || 'vmagent 运行时已部署'} /> : null}

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="overflow-hidden rounded-md border border-outline bg-surface-lowest">
            <div className="border-b border-outline px-3 py-2 text-xs font-semibold text-on-surface">运行时采集路由</div>
            {routesQuery.error ? <div className="console-empty-state min-h-[220px]"><div className="text-sm font-semibold text-danger">采集路由加载失败</div><div className="text-xs text-muted">请检查路由读取权限或网络后重试。</div></div> : routes.length ? (
              <div className="divide-y divide-outline">
                {routes.map((route) => <MetricRouteRuntimeRow key={route.id} route={route} active={route.id === selectedRoute?.id} disabled={publishMutation.isPending} onSelect={() => { setSelectedRouteId(route.id); updateSearch(effectiveClusterId, route.id); }} />)}
              </div>
            ) : <div className="console-empty-state min-h-[220px]"><Server className="h-5 w-5 text-muted" /><div className="text-sm font-semibold">暂无采集路由</div><div className="text-xs text-muted">请先在服务的监控模块中创建 K8s Service 采集路由。</div></div>}
          </div>
          <div className="rounded-md border border-outline bg-surface-lowest p-3">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-on-surface"><ServerCog className="h-4 w-4 text-primary" />vmagent Deployment</div>
            <label className="block text-xs font-semibold text-muted">运行时 Namespace<input className="console-input mt-1 h-9 w-full font-mono text-sm" value={namespace} readOnly /></label>
            <div className="mt-3 space-y-2 text-xs text-muted">
              <RuntimeFact label="运行时 ID" value={runtimeStatus?.runtimeId || selectedRoute?.runtimeId || '-'} />
              <RuntimeFact label="部署方式" value="Deployment / 1 replica" />
              <RuntimeFact label="配置路由" value={`${runtimeRoutes.length || (selectedRoute ? 1 : 0)} 条`} />
              <RuntimeFact label="状态" value={runtimeStatus?.status || 'pending_publish'} />
            </div>
          </div>
        </div>

        <div className="rounded-md border border-outline bg-surface-lowest p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><div className="text-sm font-semibold text-on-surface">预览并部署指标采集运行时</div><p className="mt-1 text-xs leading-5 text-muted">一次发布会重建同一集群、产品与 VictoriaMetrics 端点下的完整 vmagent 配置，避免重复采集和跨租户写入。</p></div>
            <button className="console-button console-button-primary" type="button" disabled={!canPublish} onClick={previewRuntime}>{publishMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}预览部署</button>
          </div>
          <div className="mt-3 overflow-auto rounded border border-outline"><MetricsRuntimeResourceTable resources={runtimeStatus?.resources ?? []} /></div>
        </div>

        {pendingPublish ? (
          <div className="space-y-3 rounded-md border border-primary/30 bg-surface-lowest p-3">
            <div className="flex items-center justify-between gap-2"><div><div className="text-sm font-semibold text-on-surface">部署预览</div><div className="mt-1 font-mono text-[11px] text-muted">config_hash={pendingPublish.configHash}</div></div><span className="status-badge border-warning/25 bg-amber-50 text-warning"><span className="status-dot" />待确认</span></div>
            {pendingPublish.warnings.map((warning) => <InlineNotice key={warning} tone="warning" message={warning} />)}
            <details className="rounded border border-outline bg-white"><summary className="cursor-pointer px-3 py-2 text-xs font-semibold">查看 vmagent scrape 配置</summary><pre className="max-h-[360px] overflow-auto border-t border-outline bg-slate-950 p-3 text-[11px] leading-5 text-slate-100">{pendingPublish.configYAML}</pre></details>
            <details className="rounded border border-outline bg-white"><summary className="cursor-pointer px-3 py-2 text-xs font-semibold">查看 Kubernetes Manifest</summary><pre className="max-h-[420px] overflow-auto border-t border-outline bg-slate-950 p-3 text-[11px] leading-5 text-slate-100">{pendingPublish.manifestYAML}</pre></details>
            <div className="flex items-center justify-end"><button className="console-button console-button-primary" type="button" disabled={publishMutation.isPending || !pendingPublish.confirmationToken} onClick={applyRuntime}><CheckCircle2 className="h-3.5 w-3.5" />确认部署</button></div>
          </div>
        ) : null}
      </div>
    </DataPanel>
  );
}

function MetricRouteRuntimeRow({ route, active, disabled, onSelect }: { route: MetricRoute; active: boolean; disabled: boolean; onSelect: () => void }) {
  const editURL = route.service?.productId && route.serviceId
    ? `/products/${encodeURIComponent(route.service.productId)}/services/${encodeURIComponent(route.serviceId)}/metrics/routes/${encodeURIComponent(route.id)}/edit`
    : '';
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 ${active ? 'bg-primary-soft/50' : 'bg-white'}`}>
      <button type="button" className="min-w-0 flex-1 text-left" disabled={disabled} onClick={onSelect}>
        <div className="truncate text-sm font-semibold text-on-surface">{route.name}</div>
        <div className="mt-0.5 truncate font-mono text-[11px] text-muted">{route.namespace}/{route.k8sServiceName}:{route.port}{route.metricsPath}</div>
      </button>
      <StatusBadge value={route.lastPublishStatus || 'pending_publish'} />
      {editURL ? <Link className="console-button text-xs" to={editURL}>编辑</Link> : null}
    </div>
  );
}

function MetricsRuntimeResourceTable({ resources }: { resources: MetricsCollectorRuntimeResourceStatus[] }) {
  if (!resources.length) return <div className="px-3 py-6 text-center text-xs text-muted">部署后显示 Namespace、RBAC、ConfigMap、Service 与 Deployment 状态</div>;
  return (
    <table className="console-table w-full min-w-[680px]"><thead><tr><th>资源</th><th>状态</th><th>Namespace</th><th>API</th></tr></thead><tbody>{resources.map((item) => <tr key={`${item.apiVersion}/${item.kind}/${item.namespace}/${item.name}`}><td className="font-mono text-xs font-semibold">{item.kind}/{item.name}</td><td><StatusBadge value={item.exists && item.healthy ? 'ready' : item.exists ? 'degraded' : 'missing_resources'} /></td><td className="font-mono text-xs text-muted">{item.namespace || 'cluster'}</td><td className="font-mono text-xs text-muted">{item.apiVersion}</td></tr>)}</tbody></table>
  );
}

function logsCollectorRuntimeRow(clusterId: string, namespace: string, status?: LogsCollectorRuntimeStatus): RuntimeRow {
  return {
    id: status?.runtime?.id || (clusterId ? `logs-collector:${clusterId}:${namespace || defaultLogsCollectorNamespace}` : 'logs_collector'),
    namespace: namespace || defaultLogsCollectorNamespace,
    status: status?.ready ? 'ready' : status?.status || 'pending_publish',
  };
}

function RuntimeIcon() {
  return <FileCode2 className="h-4 w-4 text-primary" />;
}

function publishTaskLabel(value: string) {
  return value === 'base' ? '基础组件发布' : value === 'incremental' ? '服务配置增量发布' : '发布任务';
}

function RuntimeResourceStatusTable({ resources }: { resources: LogsCollectorRuntimeResourceStatus[] }) {
  if (!resources.length) {
    return <div className="px-3 py-6 text-center text-xs text-muted">等待读取集群基础组件状态</div>;
  }
  return (
    <div className="overflow-auto">
      <table className="console-table w-full min-w-[760px]">
        <thead>
          <tr>
            <th>资源</th>
            <th>状态</th>
            <th>Namespace</th>
            <th>API</th>
          </tr>
        </thead>
        <tbody>
          {resources.map((item) => (
            <tr key={`${item.apiVersion}/${item.kind}/${item.namespace}/${item.name}`}>
              <td className="font-mono text-xs font-semibold text-on-surface">{item.kind}/{item.name}</td>
              <td><StatusBadge value={item.exists ? 'ready' : 'missing_resources'} /></td>
              <td className="font-mono text-xs text-muted">{item.namespace || 'cluster'}</td>
              <td className="font-mono text-xs text-muted">{item.apiVersion}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RuntimeStepperHeader({ step1Complete, activeStep }: { step1Complete: boolean; activeStep: number }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-outline bg-surface-lowest px-3 py-2">
      <div className={`flex items-center gap-1.5 text-xs font-semibold ${step1Complete ? 'text-emerald-600' : activeStep === 1 ? 'text-primary' : 'text-muted'}`}>
        {step1Complete ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-current text-[9px]">1</span>}
        基础组件
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-muted" />
      <div className={`flex items-center gap-1.5 text-xs font-semibold ${activeStep === 2 ? 'text-primary' : 'text-muted'}`}>
        <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-current text-[9px]">2</span>
        服务配置
      </div>
    </div>
  );
}

function RuntimeStepPanel({ stepNumber, title, complete, active, description, action, children }: { stepNumber: number; title: string; complete: boolean; active: boolean; description: string; action: ReactNode; children?: ReactNode }) {
  const borderClass = complete
    ? 'border-emerald-200/60'
    : active
      ? 'border-primary/45 shadow-[inset_3px_0_0_rgba(13,91,215,0.72)]'
      : 'border-outline';
  const iconClass = complete
    ? 'text-emerald-600'
    : active
      ? 'text-primary'
      : 'text-muted';
  return (
    <div className={`rounded-md border bg-surface-lowest p-3 ${borderClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <div className="shrink-0 pt-0.5">
            {complete ? <CheckCircle2 className={`h-4 w-4 ${iconClass}`} /> : <span className={`flex h-4 w-4 items-center justify-center rounded-full border-2 text-[10px] font-bold ${iconClass}`} style={{ borderColor: 'currentColor' }}>{stepNumber}</span>}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-on-surface">{title}</div>
            <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
          </div>
        </div>
      </div>
      <div className="mt-3 flex justify-end">{action}</div>
      {children}
    </div>
  );
}

function ServicePublishRow({ group, publishing, disabled, onPreview }: {
  group: { serviceId: string; service: LogsServiceSummary | null; routes: LogRouteView[]; pendingCount: number };
  publishing: boolean;
  disabled: boolean;
  onPreview: () => void;
}) {
  const serviceName = group.service?.displayName || group.service?.name || group.serviceId;
  const hasPending = group.pendingCount > 0;
  return (
    <div className="flex items-center gap-3 bg-white px-3 py-2.5">
      <Server className={`h-4 w-4 shrink-0 ${hasPending ? 'text-primary' : 'text-muted'}`} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-on-surface">{serviceName}</div>
        <div className="mt-0.5 text-[11px] text-muted">
          {group.routes.length} 条路由
          {hasPending ? ` · ${group.pendingCount} 条待发布` : ' · 已是最新'}
        </div>
      </div>
      <StatusBadge value={hasPending ? 'pending_publish' : 'published'} />
      {hasPending ? (
        <button
          className="console-button console-button-primary gap-1 text-xs"
          disabled={disabled}
          onClick={onPreview}
        >
          {publishing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Rocket className="h-3 w-3" />}
          预览发布
        </button>
      ) : null}
    </div>
  );
}

function RuntimeFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-outline pt-2 first:border-t-0 first:pt-0">
      <span>{label}</span>
      <span className="min-w-0 truncate font-mono text-on-surface">{value}</span>
    </div>
  );
}

function InlineNotice({ tone, message }: { tone: 'success' | 'warning' | 'danger'; message: string }) {
  const toneClass = tone === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : tone === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-red-200 bg-red-50 text-red-700';
  return (
    <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${toneClass}`}>
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
