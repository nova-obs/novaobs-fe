import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, CloudUpload, GitCompareArrows, RotateCcw, ShieldAlert, Trash2 } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { k8sApi, type K8sDeploymentDiff, type K8sDeploymentIdentity, type K8sDeploymentOperationResult, type K8sResourceSummary } from './api';
import { useK8sOpsContext } from './context';

export function K8sDeploymentPage() {
  const [namespace, setNamespace] = useState('');
  const [selectedResourceUID, setSelectedResourceUID] = useState('');
  const [yamlContent, setYamlContent] = useState('');
  const [lastTemplateYAML, setLastTemplateYAML] = useState('');
  const [identity, setIdentity] = useState<K8sDeploymentIdentity>(emptyIdentity());
  const [historyId, setHistoryId] = useState('');
  const [lastResult, setLastResult] = useState<K8sDeploymentOperationResult | null>(null);
  const [previewPlan, setPreviewPlan] = useState<K8sDeploymentOperationResult | null>(null);
  const [deletePreviewPlan, setDeletePreviewPlan] = useState<K8sDeploymentOperationResult | null>(null);

  const { activeClusterId, activeCluster, clusterError } = useK8sOpsContext();

  const { data: namespaces = [], error: namespaceError } = useQuery({
    queryKey: ['k8s-namespaces', activeClusterId],
    queryFn: () => k8sApi.listNamespaces(activeClusterId),
    enabled: Boolean(activeClusterId),
    retry: false,
  });

  const { data: resources = [], isLoading: isLoadingResources, error: resourceError } = useQuery({
    queryKey: ['k8s-deployment-resources', activeClusterId, namespace],
    queryFn: () => k8sApi.listResources({ clusterId: activeClusterId, namespace, kind: 'Deployment' }),
    enabled: Boolean(activeClusterId && namespace),
    retry: false,
  });

  const { data: histories = [], error: historyError } = useQuery({
    queryKey: ['k8s-deployment-history', activeClusterId, namespace],
    queryFn: () => k8sApi.listDeploymentHistory(activeClusterId, namespace),
    enabled: Boolean(activeClusterId),
    retry: false,
  });

  useEffect(() => {
    const namespaceExists = namespaces.some((item) => item.name === namespace);
    if (namespace && !namespaceExists) {
      setNamespace(namespaces[0]?.name ?? '');
      setSelectedResourceUID('');
      setLastResult(null);
      setPreviewPlan(null);
      setDeletePreviewPlan(null);
      return;
    }
    if (!namespace && namespaces[0]?.name) {
      setNamespace(namespaces[0].name);
    }
  }, [namespace, namespaces]);

  useEffect(() => {
    const resourceExists = resources.some((item) => resourceOptionKey(item) === selectedResourceUID);
    if (selectedResourceUID && !resourceExists) {
      setSelectedResourceUID(resources[0] ? resourceOptionKey(resources[0]) : '');
      return;
    }
    if (!selectedResourceUID && resources[0]) {
      setSelectedResourceUID(resourceOptionKey(resources[0]));
    }
  }, [resources, selectedResourceUID]);

  const currentResource = resources.find((item) => resourceOptionKey(item) === selectedResourceUID) ?? resources[0];

  useEffect(() => {
    const nextIdentity = identityFromResource(activeClusterId, namespace, currentResource);
    setIdentity(nextIdentity);
    syncDeploymentYAML(namespace, currentResource);
    setLastResult(null);
    setPreviewPlan(null);
    setDeletePreviewPlan(null);
  }, [activeClusterId, currentResource, namespace]);

  useEffect(() => {
    const historyExists = histories.some((item) => item.id === historyId);
    if (historyId && !historyExists) {
      setHistoryId(histories[0]?.id ?? '');
      return;
    }
    if (!historyId && histories[0]?.id) {
      setHistoryId(histories[0].id);
    }
  }, [histories, historyId]);

  function syncDeploymentYAML(nextNamespace: string, resource?: K8sResourceSummary) {
    const shouldSync = !yamlContent.trim() || yamlContent === lastTemplateYAML;
    if (!shouldSync || !nextNamespace) {
      return;
    }
    const nextYAML = buildDeploymentYAML(nextNamespace, resource);
    setYamlContent(nextYAML);
    setLastTemplateYAML(nextYAML);
  }

  const previewMutation = useMutation({
    mutationFn: () => k8sApi.previewDeployment({ clusterId: activeClusterId, yamlContent }),
    onSuccess: (result) => {
      setPreviewPlan(result);
      setLastResult(result);
    },
  });
  const applyMutation = useMutation({
    mutationFn: () => k8sApi.applyDeployment({
      clusterId: activeClusterId,
      yamlContent,
      previewId: previewPlan?.previewId,
      confirmationToken: previewPlan?.confirmationToken,
    }),
    onSuccess: (result) => {
      setLastResult(result);
      setPreviewPlan(null);
    },
  });
  const previewDeleteMutation = useMutation({
    mutationFn: () => k8sApi.previewDeleteDeployment(identity),
    onSuccess: (result) => {
      setDeletePreviewPlan(result);
      setLastResult(result);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => k8sApi.deleteDeployment(identity, {
      previewId: deletePreviewPlan?.previewId,
      confirmationToken: deletePreviewPlan?.confirmationToken,
    }),
    onSuccess: (result) => {
      setLastResult(result);
      setDeletePreviewPlan(null);
    },
  });
  const rollbackMutation = useMutation({
    mutationFn: () => k8sApi.rollbackDeployment({ identity, historyId }),
    onSuccess: setLastResult,
  });

  const permissionError = useMemo(() => {
    const message = previewMutation.error?.message || applyMutation.error?.message || previewDeleteMutation.error?.message || deleteMutation.error?.message || rollbackMutation.error?.message || '';
    return message.includes('无权') || message.includes('permission_denied') ? message : '';
  }, [previewMutation.error, applyMutation.error, previewDeleteMutation.error, deleteMutation.error, rollbackMutation.error]);

  const operationError = previewMutation.error?.message || applyMutation.error?.message || previewDeleteMutation.error?.message || deleteMutation.error?.message || rollbackMutation.error?.message || '';
  const resourceCount = lastResult?.resources.length ?? extractResourceCount(yamlContent);
  const canPreview = Boolean(activeClusterId && yamlContent.trim());
  const canApplyConfirmedPreview = Boolean(canPreview && previewPlan?.previewId && previewPlan?.confirmationToken && !applyMutation.isPending);
  const hasCompleteIdentity = completeIdentity(identity);
  const canDeleteConfirmedPreview = Boolean(hasCompleteIdentity && deletePreviewPlan?.previewId && deletePreviewPlan?.confirmationToken && !deleteMutation.isPending);
  const displayedPlan = deletePreviewPlan ?? previewPlan ?? lastResult;
  const previewDiffs = displayedPlan?.diffs ?? [];
  const previewWarnings = displayedPlan?.warnings ?? [];

  function updateIdentity(next: K8sDeploymentIdentity) {
    setIdentity(next);
    setDeletePreviewPlan(null);
    setLastResult(null);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_0.8fr]">
        <DeployMetric label="资源" value={String(resourceCount)} meta={activeClusterId ? `cluster/${activeClusterId}` : '等待集群'} />
        <DeployMetric label="动作" value={lastResult?.status || 'preview'} meta={namespace ? `namespace/${namespace}` : '等待命名空间'} />
        <DeployMetric label="审计" value={lastResult?.auditId ? 'recorded' : 'pending'} meta={lastResult?.auditId || 'namespace scope'} />
      </div>

      <section className="console-panel px-4 py-3">
        <div className="grid gap-3 xl:grid-cols-[minmax(180px,260px)_minmax(180px,240px)_minmax(220px,280px)_1fr] xl:items-end">
          <div className="rounded-lg bg-white/55 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            <div className="text-xs font-semibold text-muted">当前集群</div>
            <div className="mt-1 font-mono text-sm font-semibold text-on-surface">{activeCluster?.name || activeClusterId || '未选择'}</div>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-muted">命名空间选择</span>
            <select
              className="console-input mt-2 w-full"
              value={namespace}
              onChange={(event) => {
                setNamespace(event.target.value);
                setSelectedResourceUID('');
                setHistoryId('');
                setLastResult(null);
                setPreviewPlan(null);
                setDeletePreviewPlan(null);
              }}
              disabled={!namespaces.length}
            >
              {!namespaces.length ? <option value="">暂无命名空间</option> : null}
              {namespaces.map((item) => (
                <option key={`${item.clusterId}-${item.name}`} value={item.name}>{item.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-muted">资源参考</span>
            <select
              className="console-input mt-2 w-full"
              value={selectedResourceUID}
              onChange={(event) => {
                setSelectedResourceUID(event.target.value);
                setLastResult(null);
                setPreviewPlan(null);
                setDeletePreviewPlan(null);
              }}
              disabled={!resources.length}
            >
              {!resources.length ? <option value="">暂无 Deployment 资源</option> : null}
              {resources.map((item) => (
                <option key={resourceOptionKey(item)} value={resourceOptionKey(item)}>{item.identity.kind}/{item.identity.name}</option>
              ))}
            </select>
          </label>
          <div className="text-sm text-muted">
            预览、发布、删除和回滚统一走 NovaObs RBAC 与审计；真实目标从 Kubernetes 只读 API 派生。
          </div>
        </div>
        {clusterError || namespaceError || resourceError || historyError ? (
          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            {clusterError ? '集群列表读取失败，请检查 NovaObs 后端连接。' : errorMessage(namespaceError || resourceError || historyError)}
          </div>
        ) : null}
      </section>

      <DataPanel title="发布部署" meta="preview / apply / delete / rollback 统一走 NovaObs RBAC 与审计">
        {permissionError ? (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            <ShieldAlert className="h-4 w-4" />
            权限不足：当前用户缺少 `k8s.deployment` 对应操作权限。
          </div>
        ) : null}
        {operationError && !permissionError ? (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            <ShieldAlert className="h-4 w-4" />
            {operationError}
          </div>
        ) : null}
        {isLoadingResources ? (
          <div className="mb-3 rounded-lg bg-white/45 px-3 py-2 text-sm font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
            正在读取当前命名空间的 Deployment 参考。
          </div>
        ) : null}
        {lastResult?.auditId ? (
          <div className="mb-3 rounded-lg bg-primary-soft px-3 py-2 text-sm font-semibold text-primary">
            操作已落审计：<span className="font-mono">{lastResult.auditId}</span>
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="console-panel px-4 py-3">
              <div className="text-sm font-semibold text-on-surface">部署 YAML</div>
              <textarea
                className="console-input mt-3 min-h-[430px] w-full font-mono text-xs"
                value={yamlContent}
                onChange={(event) => {
                  setYamlContent(event.target.value);
                  setPreviewPlan(null);
                  setDeletePreviewPlan(null);
                  setLastResult(null);
                }}
              />
            </section>
            <section className="console-panel px-4 py-3">
              <div className="text-sm font-semibold text-on-surface">执行结果</div>
              <div className="mt-3 rounded-lg bg-white/50 px-3 py-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
                <div className="font-semibold text-on-surface">{lastResult?.message || '等待预览或发布动作'}</div>
                <div className="mt-2 font-mono text-xs text-muted">status={lastResult?.status || '-'}</div>
                <div className="font-mono text-xs text-muted">audit={lastResult?.auditId || '-'}</div>
              </div>
              <div className="mt-4 rounded-lg bg-white/45 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                    <GitCompareArrows className="h-4 w-4 text-primary" />
                    预览差异
                  </div>
                  <span className="rounded-md bg-primary-soft px-2 py-1 font-mono text-[11px] font-semibold text-primary">{previewDiffs.length} diff</span>
                </div>
                {previewDiffs.length ? (
                  <div className="mt-3 space-y-2">
                    {previewDiffs.map((diff) => (
                      <PreviewDiffRow key={`${diff.clusterId}-${diff.namespace}-${diff.kind}-${diff.name}-${diff.operation}`} diff={diff} />
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg bg-surface-lowest/60 px-3 py-3 text-xs font-medium text-muted">
                    先执行预览，NovaObs 会展示 create / update / delete、解析后的 API 版本和确认指纹。
                  </div>
                )}
                {previewWarnings.length ? (
                  <div className="mt-3 space-y-1 rounded-lg bg-amber-50/80 px-3 py-2 text-xs font-semibold text-warning">
                    {previewWarnings.map((warning) => <div key={warning}>{warning}</div>)}
                  </div>
                ) : null}
              </div>
              <div className="mt-4 space-y-3">
                {(lastResult?.resources ?? [identity]).map((item) => (
                  <div key={`${item.kind}-${item.name}-${item.uid || 'preview'}`} className="rounded-lg bg-white/50 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-primary">{item.name || '-'}</div>
                        <div className="mt-1 text-[11px] text-muted">{item.kind || '-'}</div>
                      </div>
                      <div className="shrink-0 rounded-md bg-primary-soft px-2 py-1 font-mono text-[11px] font-semibold text-primary">{item.namespace || '-'}</div>
                    </div>
                    <div className="mt-3 grid gap-2 text-[11px] text-muted">
                      <div className="break-all font-mono">api={item.apiVersion || '-'}</div>
                      <div className="break-all font-mono">uid={item.uid || '-'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="console-panel px-4 py-3">
            <div className="text-sm font-semibold text-on-surface">高风险确认</div>
            <p className="mt-1 text-xs text-muted">删除和回滚必须带完整资源身份：cluster / namespace / api_version / kind / name / uid。</p>
            <IdentityInput label="namespace" value={identity.namespace} onChange={(value) => updateIdentity({ ...identity, namespace: value })} />
            <IdentityInput label="api_version" value={identity.apiVersion} onChange={(value) => updateIdentity({ ...identity, apiVersion: value })} />
            <IdentityInput label="kind" value={identity.kind} onChange={(value) => updateIdentity({ ...identity, kind: value })} />
            <IdentityInput label="name" value={identity.name} onChange={(value) => updateIdentity({ ...identity, name: value })} />
            <IdentityInput label="uid" value={identity.uid || ''} onChange={(value) => updateIdentity({ ...identity, uid: value })} />
            <label className="mt-3 block text-xs font-semibold text-muted">
              history_id
              <select className="console-input mt-2 w-full" value={historyId} onChange={(event) => setHistoryId(event.target.value)} disabled={!histories.length}>
                {!histories.length ? <option value="">暂无部署历史</option> : null}
                {histories.map((item) => (
                  <option key={item.id} value={item.id}>{item.workload || item.id} · {item.revision || item.action || item.id}</option>
                ))}
              </select>
            </label>

            <div className="mt-4 rounded-lg bg-white/45 px-3 py-3 text-xs text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold text-on-surface">确认摘要</div>
                {previewPlan?.confirmationToken || deletePreviewPlan?.confirmationToken ? <CheckCircle2 className="h-4 w-4 text-primary" /> : null}
              </div>
              <div className="mt-2 font-mono">cluster={activeClusterId || '-'}</div>
              <div className="font-mono">namespace={identity.namespace || '-'}</div>
              <div className="font-mono">resource={identity.kind || '-'}/{identity.name || '-'}</div>
              <div className="font-mono">uid={identity.uid || '-'}</div>
              <div className="mt-2 border-t border-white/70 pt-2 font-mono">apply_preview_id={previewPlan?.previewId || '-'}</div>
              <div className="break-all font-mono">apply_confirmation={maskToken(previewPlan?.confirmationToken)}</div>
              <div className="mt-2 font-mono">delete_preview_id={deletePreviewPlan?.previewId || '-'}</div>
              <div className="break-all font-mono">delete_confirmation={maskToken(deletePreviewPlan?.confirmationToken)}</div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-sm font-semibold text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60" disabled={!canPreview || previewMutation.isPending} onClick={() => previewMutation.mutate()}>
                <CloudUpload className="h-4 w-4" />
                预览
              </button>
              <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60" disabled={!canApplyConfirmedPreview} onClick={() => applyMutation.mutate()}>
                <CloudUpload className="h-4 w-4" />
                发布
              </button>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-sm font-semibold text-danger shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!hasCompleteIdentity || previewDeleteMutation.isPending || deleteMutation.isPending}
                onClick={() => {
                  if (canDeleteConfirmedPreview) {
                    deleteMutation.mutate();
                    return;
                  }
                  previewDeleteMutation.mutate();
                }}
              >
                <Trash2 className="h-4 w-4" />
                {canDeleteConfirmedPreview ? '确认删除' : '预览删除'}
              </button>
              <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-sm font-semibold text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60" disabled={!hasCompleteIdentity || !historyId.trim() || rollbackMutation.isPending} onClick={() => rollbackMutation.mutate()}>
                <RotateCcw className="h-4 w-4" />
                回滚
              </button>
            </div>
          </aside>
        </div>
      </DataPanel>
    </div>
  );
}

function DeployMetric({ label, value, meta }: { label: string; value: string; meta: string }) {
  return (
    <section className="console-panel px-4 py-3">
      <div className="text-sm font-semibold text-on-surface">{label}</div>
      <div className="mt-3 break-all font-mono text-2xl font-semibold text-on-surface">{value}</div>
      <div className="mt-2 truncate text-xs text-muted">{meta}</div>
    </section>
  );
}

function PreviewDiffRow({ diff }: { diff: K8sDeploymentDiff }) {
  const tone = diff.operation === 'delete'
    ? 'bg-red-50 text-danger'
    : diff.operation === 'create'
      ? 'bg-primary-soft text-primary'
      : 'bg-amber-50 text-warning';
  return (
    <div className="rounded-lg bg-surface-lowest/70 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-on-surface">{diff.kind}/{diff.name}</div>
          <div className="mt-1 truncate text-[11px] font-medium text-muted">{diff.namespace || 'cluster-scope'} · {diff.apiVersion}</div>
        </div>
        <span className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold ${tone}`}>{diff.operation || 'apply'}</span>
      </div>
      <div className="mt-3 grid gap-1 text-[11px] text-muted">
        <div className="truncate font-mono">before={shortHash(diff.beforeHash)}</div>
        <div className="truncate font-mono">after={shortHash(diff.afterHash)}</div>
      </div>
    </div>
  );
}

function IdentityInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="mt-3 block text-xs font-semibold text-muted">
      {label}
      <input className="console-input mt-2 w-full" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function identityFromResource(clusterId: string, namespace: string, resource?: K8sResourceSummary): K8sDeploymentIdentity {
  if (!resource) {
    return { ...emptyIdentity(), clusterId, namespace };
  }
  return {
    clusterId,
    namespace: resource.identity.namespace || namespace,
    apiVersion: resource.identity.apiVersion,
    kind: resource.identity.kind,
    name: resource.identity.name,
    uid: resource.identity.uid,
  };
}

function emptyIdentity(): K8sDeploymentIdentity {
  return { clusterId: '', namespace: '', apiVersion: '', kind: '', name: '', uid: '' };
}

function buildDeploymentYAML(namespace: string, resource?: K8sResourceSummary) {
  const name = resource?.identity.name || 'workload-name';
  return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
  namespace: ${namespace || 'default'}
spec:
  replicas: 1`;
}

function completeIdentity(value: K8sDeploymentIdentity) {
  return Boolean(value.clusterId && value.namespace && value.apiVersion && value.kind && value.name && value.uid);
}

function resourceOptionKey(resource: K8sResourceSummary) {
  return resource.identity.uid || `${resource.identity.kind}/${resource.identity.namespace}/${resource.identity.name}`;
}

function extractResourceCount(value: string) {
  return Math.max(1, value.split('---').filter((item) => item.trim()).length);
}

function shortHash(value = '') {
  return value ? `${value.slice(0, 12)}...` : '-';
}

function maskToken(value = '') {
  return value ? `${value.slice(0, 10)}...${value.slice(-6)}` : '-';
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '读取失败';
}
