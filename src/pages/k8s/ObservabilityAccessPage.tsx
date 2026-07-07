import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Activity, AlertTriangle, CheckCircle2, FileCode2, RefreshCw, Rocket, ServerCog } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { StatusBadge } from '../../components/StatusBadge';
import { LogsPublishPreviewPanel } from '../logs/LogsPublishPreviewPanel';
import { logsApi, type LogsCollectorRuntimePublishResult, type ObservabilityRuntime } from '../logs/api';
import { useK8sOpsContext } from './context';

const defaultRuntimeNamespace = 'novaobs-system';

export function K8sObservabilityAccessPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeClusterId, activeCluster, clusters, isLoadingClusters, clusterError } = useK8sOpsContext();
  const requestedClusterId = activeClusterId || searchParams.get('cluster_id') || '';
  const [selectedClusterId, setSelectedClusterId] = useState(requestedClusterId);
  const [namespace, setNamespace] = useState(defaultRuntimeNamespace);
  const [pendingPublish, setPendingPublish] = useState<LogsCollectorRuntimePublishResult | null>(null);
  const [lastResult, setLastResult] = useState<LogsCollectorRuntimePublishResult | null>(null);
  const effectiveClusterId = activeClusterId || selectedClusterId;
  const selectedCluster = activeClusterId
    ? activeCluster
    : clusters.find((cluster) => cluster.id === effectiveClusterId);

  const runtimesQuery = useQuery({
    queryKey: ['observability-runtimes'],
    queryFn: () => logsApi.listObservabilityRuntimes(),
    retry: false,
  });

  useEffect(() => {
    if (requestedClusterId && requestedClusterId !== selectedClusterId) {
      setSelectedClusterId(requestedClusterId);
    }
  }, [requestedClusterId, selectedClusterId]);

  useEffect(() => {
    if (!selectedClusterId && clusters.length) {
      setSelectedClusterId(clusters[0].id);
    }
  }, [clusters, selectedClusterId]);

  useEffect(() => {
    setPendingPublish(null);
    setLastResult(null);
  }, [effectiveClusterId]);

  const clusterRuntimes = useMemo(
    () => (runtimesQuery.data ?? []).filter((runtime) => runtime.clusterId === effectiveClusterId),
    [effectiveClusterId, runtimesQuery.data],
  );
  const collectorRuntime = clusterRuntimes.find((runtime) => runtime.kind === 'logs_collector' && runtime.namespace === namespace);
  const runtimeRows = collectorRuntime
    ? [collectorRuntime, ...clusterRuntimes.filter((runtime) => runtime.id !== collectorRuntime.id)]
    : [pendingCollectorRuntime(effectiveClusterId, namespace), ...clusterRuntimes];

  const namespaceReady = Boolean(namespace.trim());
  const clusterReadOnly = Boolean(selectedCluster?.readOnly);
  const clusterUnknown = Boolean(effectiveClusterId && !selectedCluster && !isLoadingClusters);
  const canPublish = Boolean(effectiveClusterId && selectedCluster && namespaceReady && !clusterReadOnly && !publishMutationPending(pendingPublish));
  const publishMutation = useMutation({
    mutationFn: (confirmation?: { previewId?: string; confirmationToken?: string }) => logsApi.publishLogsCollectorRuntime({
      clusterId: effectiveClusterId,
      namespace,
      previewId: confirmation?.previewId,
      confirmationToken: confirmation?.confirmationToken,
    }),
    onSuccess: async (result) => {
      setLastResult(result);
      setPendingPublish(result.requiresConfirmation ? result : null);
      await queryClient.invalidateQueries({ queryKey: ['observability-runtimes'] });
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
    setSearchParams(nextClusterId ? { cluster_id: nextClusterId } : {});
  }

  function previewRuntime() {
    setPendingPublish(null);
    publishMutation.mutate(undefined);
  }

  function applyRuntime() {
    if (!pendingPublish?.previewId || !pendingPublish.confirmationToken) return;
    publishMutation.mutate({
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
            <button className="console-button" onClick={() => runtimesQuery.refetch()} disabled={runtimesQuery.isFetching} aria-label="刷新观测运行时">
              {runtimesQuery.isFetching ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              刷新
            </button>
            <button
              className="console-button console-button-primary"
              disabled={!canPublish || publishMutation.isPending}
              onClick={previewRuntime}
              title={blocker}
            >
              <Rocket className="h-3.5 w-3.5" />
              预览部署
            </button>
          </div>
        )}
      >
        <div className="space-y-4">
          {clusterError ? <InlineNotice tone="danger" message={clusterError.message} /> : null}
          {blocker ? <InlineNotice tone={clusterReadOnly ? 'warning' : 'danger'} message={blocker} /> : null}
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
                    <tr key={runtime.id || runtime.kind}>
                      <td>
                        <div className="flex items-center gap-2">
                          <RuntimeIcon kind={runtime.kind} />
                          <div>
                            <div className="text-sm font-semibold text-on-surface">{runtimeLabel(runtime.kind)}</div>
                            <div className="font-mono text-[11px] text-muted">{runtime.id || runtime.kind}</div>
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
                    setNamespace(event.target.value);
                    setPendingPublish(null);
                  }}
                />
              </label>
              <div className="mt-3 space-y-2 text-xs text-muted">
                <RuntimeFact label="部署集群" value={effectiveClusterId || '-'} />
                <RuntimeFact label="写入策略" value={clusterReadOnly ? '只读' : '允许写入'} />
                <RuntimeFact label="采集器" value="logs_collector" />
                <RuntimeFact label="配置来源" value="集群内日志路由合并配置" />
              </div>
            </div>
          </div>

          {pendingPublish ? (
            <div className="space-y-3">
              <LogsPublishPreviewPanel preview={pendingPublish} />
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-outline bg-surface-lowest px-3 py-2">
                <div className="text-xs font-semibold text-muted">{pendingPublish.diffs.length || pendingPublish.resources.length} 个资源待确认</div>
                <button
                  className="console-button console-button-primary"
                  disabled={!pendingPublish.previewId || !pendingPublish.confirmationToken || publishMutation.isPending}
                  onClick={applyRuntime}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  确认部署
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </DataPanel>
    </div>
  );
}

function pendingCollectorRuntime(clusterId: string, namespace: string): ObservabilityRuntime {
  return {
    id: clusterId ? `logs-collector:${clusterId}:${namespace || defaultRuntimeNamespace}` : '',
    kind: 'logs_collector',
    signalType: 'logs',
    clusterId,
    namespace: namespace || defaultRuntimeNamespace,
    endpointId: '',
    collectorConfigHash: '',
    artifactHash: '',
    manifestHash: '',
    status: 'pending_publish',
    lastPreviewId: '',
    lastAuditId: '',
    lastError: '',
    lastPublishedAt: '',
    resources: [],
  };
}

function publishMutationPending(value: LogsCollectorRuntimePublishResult | null) {
  return Boolean(value?.requiresConfirmation);
}

function RuntimeIcon({ kind }: { kind: string }) {
  if (kind.includes('vmalert')) return <Activity className="h-4 w-4 text-primary" />;
  return <FileCode2 className="h-4 w-4 text-primary" />;
}

function runtimeLabel(kind: string) {
  switch (kind) {
    case 'logs_collector':
      return '日志采集运行时';
    case 'logs_vmalert':
      return '日志告警运行时';
    case 'metrics_vmalert':
      return '指标告警运行时';
    default:
      return kind || '观测运行时';
  }
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
