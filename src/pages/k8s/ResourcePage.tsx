import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Boxes, CheckCircle2, FileCode2, Layers3, Play, ScrollText, ShieldAlert, TerminalSquare, Trash2 } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import type { K8sDeploymentIdentity, K8sDeploymentOperationResult, K8sResourceIdentity, K8sResourceSummary } from './api';
import { k8sApi } from './api';
import { useK8sOpsContext } from './context';

type ResourceTab = 'detail' | 'yaml' | 'logs';

const resourceKindGroups = [
  { label: 'K8s 核心资源', options: ['Pod', 'Service', 'ConfigMap', 'PersistentVolumeClaim', 'PersistentVolume'] },
  { label: 'K8s 工作负载', options: ['Deployment', 'StatefulSet', 'DaemonSet', 'ReplicaSet', 'HorizontalPodAutoscaler'] },
  { label: 'K8s 网络', options: ['Ingress'] },
  { label: 'Istio 资源', options: ['Gateway', 'VirtualService', 'DestinationRule', 'EnvoyFilter'] },
];

export function K8sResourcePage() {
  const queryClient = useQueryClient();
  const [namespace, setNamespace] = useState('');
  const [kind, setKind] = useState('');
  const [selected, setSelected] = useState<K8sResourceSummary | null>(null);
  const [activeTab, setActiveTab] = useState<ResourceTab>('detail');
  const [selectedContainer, setSelectedContainer] = useState('');
  const [applyPreviewPlan, setApplyPreviewPlan] = useState<K8sDeploymentOperationResult | null>(null);
  const [deletePreviewPlan, setDeletePreviewPlan] = useState<K8sDeploymentOperationResult | null>(null);
  const [lastOperation, setLastOperation] = useState<K8sDeploymentOperationResult | null>(null);
  const { activeClusterId, activeCluster, clusterError } = useK8sOpsContext();

  const { data: namespaces = [], error: namespaceError } = useQuery({
    queryKey: ['k8s-namespaces', activeClusterId],
    queryFn: () => k8sApi.listNamespaces(activeClusterId),
    enabled: Boolean(activeClusterId),
    retry: false,
  });

  useEffect(() => {
    const namespaceExists = namespaces.some((item) => item.name === namespace);
    if (namespace && !namespaceExists) {
      setNamespace(namespaces[0]?.name ?? '');
      return;
    }
    if (!namespace && namespaces[0]?.name) {
      setNamespace(namespaces[0].name);
    }
  }, [namespace, namespaces]);

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['k8s-resources', activeClusterId, namespace, kind],
    queryFn: () => k8sApi.listResources({ clusterId: activeClusterId, namespace, kind }),
    enabled: Boolean(activeClusterId && namespace),
    retry: false,
  });
  const canReadResources = Boolean(activeClusterId && namespace);
  const selectedIdentity = selected?.identity;

  useEffect(() => {
    if (!selected) {
      return;
    }
    const stillExists = data.some((item) => identityKey(item.identity) === identityKey(selected.identity));
    if (!stillExists) {
      setSelected(null);
    }
  }, [data, selected]);

  useEffect(() => {
    setSelectedContainer('');
    setApplyPreviewPlan(null);
    setDeletePreviewPlan(null);
    setLastOperation(null);
  }, [selectedIdentity?.clusterId, selectedIdentity?.namespace, selectedIdentity?.name, selectedIdentity?.uid]);

  const detailQuery = useQuery({
    queryKey: ['k8s-resource-detail', selectedIdentity],
    queryFn: () => k8sApi.getResourceDetail(selectedIdentity as K8sResourceIdentity),
    enabled: Boolean(selectedIdentity),
    retry: false,
  });
  const yamlQuery = useQuery({
    queryKey: ['k8s-resource-yaml', selectedIdentity],
    queryFn: () => k8sApi.getResourceYAML(selectedIdentity as K8sResourceIdentity),
    enabled: Boolean(selectedIdentity && activeTab === 'yaml'),
    retry: false,
  });
  const logsQuery = useQuery({
    queryKey: ['k8s-pod-logs', selectedIdentity, selectedContainer],
    queryFn: () => k8sApi.getPodLogs({
      clusterId: selectedIdentity?.clusterId ?? '',
      namespace: selectedIdentity?.namespace ?? '',
      pod: selectedIdentity?.name ?? '',
      container: selectedContainer || undefined,
    }),
    enabled: Boolean(selectedIdentity && selectedIdentity.kind === 'Pod' && activeTab === 'logs'),
    retry: false,
  });
  const containerOptions = selectedIdentity?.kind === 'Pod' ? extractContainerOptions(detailQuery.data?.spec) : [];
  async function yamlForSelectedOperation() {
    if (!selectedIdentity) {
      throw new Error('请选择资源');
    }
    if (yamlQuery.data?.yaml?.trim()) {
      return yamlQuery.data.yaml;
    }
    const rendered = await k8sApi.getResourceYAML(selectedIdentity);
    return rendered.yaml;
  }
  const applyPreviewMutation = useMutation({
    mutationFn: async () => k8sApi.previewDeployment({
      clusterId: selectedIdentity?.clusterId ?? '',
      yamlContent: await yamlForSelectedOperation(),
    }),
    onSuccess: (result) => {
      setApplyPreviewPlan(result);
      setDeletePreviewPlan(null);
      setLastOperation(result);
    },
  });
  const applyMutation = useMutation({
    mutationFn: async () => k8sApi.applyDeployment({
      clusterId: selectedIdentity?.clusterId ?? '',
      yamlContent: await yamlForSelectedOperation(),
      previewId: applyPreviewPlan?.previewId,
      confirmationToken: applyPreviewPlan?.confirmationToken,
    }),
    onSuccess: (result) => {
      setLastOperation(result);
      setApplyPreviewPlan(null);
      queryClient.invalidateQueries({ queryKey: ['k8s-resources'] });
      queryClient.invalidateQueries({ queryKey: ['k8s-resource-detail'] });
      queryClient.invalidateQueries({ queryKey: ['k8s-resource-yaml'] });
    },
  });
  const deletePreviewMutation = useMutation({
    mutationFn: () => k8sApi.previewDeleteDeployment(toDeploymentIdentity(selectedIdentity as K8sResourceIdentity)),
    onSuccess: (result) => {
      setApplyPreviewPlan(null);
      setDeletePreviewPlan(result);
      setLastOperation(result);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => k8sApi.deleteDeployment(toDeploymentIdentity(selectedIdentity as K8sResourceIdentity), {
      previewId: deletePreviewPlan?.previewId,
      confirmationToken: deletePreviewPlan?.confirmationToken,
    }),
    onSuccess: (result) => {
      setLastOperation(result);
      setApplyPreviewPlan(null);
      setDeletePreviewPlan(null);
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ['k8s-resources'] });
    },
  });
  const operationError = applyPreviewMutation.error?.message || applyMutation.error?.message || deletePreviewMutation.error?.message || deleteMutation.error?.message || '';
  const operationPermissionError = operationError.includes('无权') || operationError.includes('permission_denied') ? operationError : '';
  const hasCompleteDeleteIdentity = Boolean(selectedIdentity?.clusterId && selectedIdentity.apiVersion && selectedIdentity.kind && selectedIdentity.name && selectedIdentity.uid);
  const canConfirmApply = Boolean(applyPreviewPlan?.previewId && applyPreviewPlan.confirmationToken && selectedIdentity?.clusterId && !applyMutation.isPending);
  const canConfirmDelete = Boolean(deletePreviewPlan?.previewId && deletePreviewPlan.confirmationToken && hasCompleteDeleteIdentity && !deleteMutation.isPending);
  const displayedOperationPlan = deletePreviewPlan ?? applyPreviewPlan ?? lastOperation;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <ResourceMetric icon={Boxes} label="资源对象" value={String(data.length)} meta={activeClusterId ? `cluster/${activeClusterId}` : '等待集群'} />
        <ResourceMetric icon={Layers3} label="身份字段" value="6" meta="cluster/ns/api/kind/name/uid" />
        <ResourceMetric icon={FileCode2} label="详情能力" value="YAML" meta="read-only preview" />
      </div>

      <section className="console-panel px-4 py-3">
        <div className="grid gap-3 md:grid-cols-[minmax(200px,280px)_minmax(180px,240px)_minmax(160px,220px)_1fr] md:items-end">
          <div className="rounded-lg bg-white/55 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            <div className="text-xs font-semibold text-muted">当前集群</div>
            <div className="mt-1 font-mono text-sm font-semibold text-on-surface">{activeCluster?.name || activeClusterId || '未选择'}</div>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-muted">命名空间选择</span>
            <select className="console-input mt-2 w-full" value={namespace} onChange={(event) => setNamespace(event.target.value)} disabled={!namespaces.length}>
              {!namespaces.length ? <option value="">暂无命名空间</option> : null}
              {namespaces.map((item) => (
                <option key={`${item.clusterId}-${item.name}`} value={item.name}>{item.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-muted">Kind</span>
            <select className="console-input mt-2 w-full" value={kind} onChange={(event) => setKind(event.target.value)}>
              <option value="">全部</option>
              {resourceKindGroups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-muted">
            <span className="rounded-lg border border-outline/70 bg-white/70 px-2.5 py-1">cluster/ns/api/kind/name/uid</span>
            <span className="rounded-lg border border-outline/70 bg-white/70 px-2.5 py-1">UID required</span>
          </div>
        </div>
        {namespaceError ? (
          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            命名空间读取失败：{errorMessage(namespaceError)}
          </div>
        ) : null}
      </section>

      <DataPanel title="资源视图" meta={isLoading ? '加载中' : `${data.length} 个资源 · 最近 15 分钟`}>
        {error ? (
          <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            资源读取失败：{errorMessage(error)}
          </div>
        ) : null}
        {isLoading ? (
          <div className="rounded-lg bg-white/45 px-4 py-8 text-center text-sm font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
            正在读取 Kubernetes 资源对象
          </div>
        ) : null}
        {!canReadResources ? (
          <div className="rounded-lg bg-white/45 px-4 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
            <div className="font-semibold text-on-surface">{clusterError ? '集群列表读取失败' : '未选择集群或命名空间'}</div>
            <p className="mt-2 text-sm text-muted">{clusterError ? 'NovaObs API unavailable' : 'namespace RBAC'}</p>
          </div>
        ) : null}
        {canReadResources && !isLoading && !error && data.length ? (
          <div className="overflow-auto">
            <table className="console-table min-w-[980px] w-full">
              <thead>
                <tr>
                  <th>资源</th>
                  <th>集群</th>
                  <th>命名空间</th>
                  <th>API Version</th>
                  <th>Kind</th>
                  <th>UID</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr
                    key={identityKey(item.identity)}
                    className={`bg-white/35 hover:bg-white/60 ${selected && identityKey(selected.identity) === identityKey(item.identity) ? 'shadow-[inset_3px_0_0_rgba(13,91,215,0.78)]' : ''}`}
                    onClick={() => {
                      setSelected(item);
                      setActiveTab('detail');
                    }}
                  >
                    <td>
                      <div className="font-semibold text-primary">{item.identity.name}</div>
                      <div className="text-[11px] text-muted">{Object.entries(item.labels).map(([key, value]) => `${key}=${value}`).join(', ') || 'no labels'}</div>
                    </td>
                    <td className="font-mono text-xs">{item.identity.clusterId}</td>
                    <td className="font-mono text-xs">{resourceNamespaceLabel(item.identity.namespace)}</td>
                    <td className="font-mono text-xs">{item.identity.apiVersion}</td>
                    <td className="font-mono text-xs">{item.identity.kind}</td>
                    <td className="font-mono text-[11px] text-muted">{item.identity.uid || '-'}</td>
                    <td><StatusPill status={item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {canReadResources && !isLoading && !error && !data.length ? (
          <div className="rounded-lg bg-white/45 px-4 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
            <div className="font-semibold text-on-surface">资源清单为空</div>
          </div>
        ) : null}
      </DataPanel>

      <DataPanel title="资源详情" meta={selected ? `${selected.identity.kind} · ${resourceNamespaceLabel(selected.identity.namespace)}/${selected.identity.name}` : '等待选择资源'}>
        {!selected ? (
          <div className="rounded-lg bg-white/45 px-4 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
            <div className="font-semibold text-on-surface">未选择资源</div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
              <div className="min-w-0">
                <div className="font-semibold text-on-surface">{selected.identity.name}</div>
                <div className="mt-1 break-all font-mono text-xs text-muted">
                  {selected.identity.clusterId}/{resourceNamespaceLabel(selected.identity.namespace)}/{selected.identity.apiVersion}/{selected.identity.kind}/{selected.identity.uid || '-'}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <TabButton active={activeTab === 'detail'} icon={ScrollText} label="详情" onClick={() => setActiveTab('detail')} />
                <TabButton active={activeTab === 'yaml'} icon={FileCode2} label="YAML 预览" onClick={() => setActiveTab('yaml')} />
                <TabButton active={activeTab === 'logs'} icon={TerminalSquare} label="Pod 日志" onClick={() => setActiveTab('logs')} disabled={selected.identity.kind !== 'Pod'} />
              </div>
            </div>

            <section className="rounded-lg bg-white/45 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
              <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-on-surface">受控操作闭环</div>
                  <div className="mt-1 break-all font-mono text-xs text-muted">
                    apply-preview → confirmation-token → apply · delete-preview → confirmation-token → delete · audit={lastOperation?.auditId || '-'}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
                    <span className="rounded-md bg-primary-soft px-2 py-1 text-primary">预览差异</span>
                    <span className="rounded-md bg-amber-100 px-2 py-1 text-warning">高风险确认</span>
                    <span className="rounded-md bg-white/65 px-2 py-1 text-muted">操作已落审计</span>
                  </div>
                  {operationPermissionError ? (
                    <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
                      <ShieldAlert className="h-4 w-4" />
                      权限不足：当前用户缺少 `k8s.deploy:apply` 或 `k8s.deploy:delete`。
                    </div>
                  ) : null}
                  {operationError && !operationPermissionError ? (
                    <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">操作失败：{operationError}</div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-xs font-semibold text-primary shadow-[inset_0_0_0_1px_rgba(13,91,215,0.18)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!selectedIdentity || applyPreviewMutation.isPending || applyMutation.isPending}
                    onClick={() => applyPreviewMutation.mutate()}
                  >
                    <Play className="h-3.5 w-3.5" />
                    Apply 预览
                  </button>
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!canConfirmApply}
                    onClick={() => applyMutation.mutate()}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    确认 Apply
                  </button>
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-xs font-semibold text-danger shadow-[inset_0_0_0_1px_rgba(185,28,28,0.18)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!hasCompleteDeleteIdentity || deletePreviewMutation.isPending}
                    onClick={() => deletePreviewMutation.mutate()}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    删除预览
                  </button>
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-danger px-3 py-2 text-xs font-semibold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!canConfirmDelete}
                    onClick={() => deleteMutation.mutate()}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    确认删除
                  </button>
                </div>
              </div>
              {displayedOperationPlan ? (
                <OperationPlanSummary plan={displayedOperationPlan} activeMode={deletePreviewPlan ? 'delete' : applyPreviewPlan ? 'apply' : 'last'} />
              ) : null}
            </section>

            {activeTab === 'detail' ? <ResourceDetailView isLoading={detailQuery.isLoading} error={detailQuery.error} spec={detailQuery.data?.spec} labels={detailQuery.data?.labels ?? selected.labels} /> : null}
            {activeTab === 'yaml' ? <CodePreview isLoading={yamlQuery.isLoading} error={yamlQuery.error} emptyText="暂无 YAML" content={yamlQuery.data?.yaml ?? ''} /> : null}
            {activeTab === 'logs' && selected.identity.kind !== 'Pod' ? (
              <div className="rounded-lg bg-white/45 px-4 py-8 text-center text-sm font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">仅 Pod 支持日志读取</div>
            ) : null}
            {activeTab === 'logs' && selected.identity.kind === 'Pod' ? (
              <div className="space-y-3">
                <div className="grid gap-3 rounded-lg bg-white/45 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] md:grid-cols-[minmax(180px,260px)_1fr] md:items-end">
                  <label className="block">
                    <span className="text-xs font-semibold text-muted">容器选择</span>
                    <select
                      className="console-input mt-2 w-full"
                      value={selectedContainer}
                      onChange={(event) => setSelectedContainer(event.target.value)}
                      disabled={!containerOptions.length}
                    >
                      <option value="">默认容器</option>
                      {containerOptions.map((container) => (
                        <option key={container} value={container}>{container}</option>
                      ))}
                    </select>
                  </label>
                  <div className="text-xs text-muted">
                    tailLines=200 · limitBytes=1MiB
                  </div>
                </div>
                <CodePreview isLoading={logsQuery.isLoading} error={logsQuery.error} emptyText="暂无 Pod 日志" content={(logsQuery.data?.lines ?? []).join('\n')} />
              </div>
            ) : null}
          </div>
        )}
      </DataPanel>
    </div>
  );
}

function ResourceMetric({ icon: Icon, label, value, meta }: { icon: typeof Boxes; label: string; value: string; meta: string }) {
  return (
    <section className="console-panel px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-on-surface">{label}</div>
          <div className="mt-3 font-mono text-2xl font-semibold text-on-surface">{value}</div>
          <div className="mt-2 text-xs text-muted">{meta}</div>
        </div>
        <Icon className="h-4 w-4 text-primary" />
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const warning = status === 'warning';
  return (
    <span className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold ${warning ? 'bg-amber-100 text-warning' : 'bg-primary-soft text-primary'}`}>
      {warning ? '警告' : status || 'unknown'}
    </span>
  );
}

function OperationChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/55 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
      <div className="text-[11px] font-semibold text-muted">{label}</div>
      <div className="mt-1 truncate font-mono text-xs text-on-surface">{value}</div>
    </div>
  );
}

function OperationPlanSummary({ plan, activeMode }: { plan: K8sDeploymentOperationResult; activeMode: 'apply' | 'delete' | 'last' }) {
  const modeLabel = activeMode === 'apply' ? 'Apply Preview' : activeMode === 'delete' ? 'Delete Preview' : 'Last Operation';
  return (
    <div className="mt-3 space-y-3">
      <div className="grid gap-2 md:grid-cols-4">
        <OperationChip label="Mode" value={modeLabel} />
        <OperationChip label="Preview ID" value={plan.previewId || '-'} />
        <OperationChip label="Confirmation" value={maskToken(plan.confirmationToken)} />
        <OperationChip label="Status" value={plan.status || '-'} />
      </div>
      {plan.warnings.length ? (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-warning">
          <div className="mb-1 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            API Server Warning
          </div>
          {plan.warnings.map((warning) => <div key={warning}>{warning}</div>)}
        </div>
      ) : null}
      {plan.diffs.length ? (
        <div className="overflow-auto rounded-lg bg-white/50 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
          <table className="console-table min-w-[760px] w-full">
            <thead>
              <tr>
                <th>操作</th>
                <th>资源</th>
                <th>命名空间</th>
                <th>Before</th>
                <th>After</th>
              </tr>
            </thead>
            <tbody>
              {plan.diffs.map((diff) => (
                <tr key={`${diff.operation}-${diff.apiVersion}-${diff.kind}-${diff.namespace}-${diff.name}`}>
                  <td className="font-mono text-xs">{diff.operation}</td>
                  <td>
                    <div className="font-semibold text-primary">{diff.kind}/{diff.name}</div>
                    <div className="font-mono text-[11px] text-muted">{diff.apiVersion}</div>
                  </td>
                  <td className="font-mono text-xs">{resourceNamespaceLabel(diff.namespace)}</td>
                  <td className="font-mono text-[11px] text-muted">{diff.beforeHash || '-'}</td>
                  <td className="font-mono text-[11px] text-muted">{diff.afterHash || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function maskToken(value?: string) {
  if (!value) {
    return '-';
  }
  if (value.length <= 12) {
    return `${value.slice(0, 4)}...`;
  }
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : '请检查集群凭据、平台 RBAC 与 Kubernetes API 连通性。';
}

function identityKey(identity: K8sResourceIdentity) {
  return `${identity.clusterId}-${identity.namespace}-${identity.apiVersion}-${identity.kind}-${identity.name}-${identity.uid}`;
}

function resourceNamespaceLabel(namespace: string) {
  return namespace || 'cluster-scoped';
}

function toDeploymentIdentity(identity: K8sResourceIdentity): K8sDeploymentIdentity {
  return {
    clusterId: identity.clusterId,
    namespace: identity.namespace,
    apiVersion: identity.apiVersion,
    kind: identity.kind,
    name: identity.name,
    uid: identity.uid,
  };
}

function extractContainerOptions(spec?: Record<string, any>) {
  const containerNames = Array.isArray(spec?.containers)
    ? spec.containers.map((item: any) => String(item?.name ?? '')).filter(Boolean)
    : [];
  const initContainerNames = Array.isArray(spec?.initContainers)
    ? spec.initContainers.map((item: any) => String(item?.name ?? '')).filter(Boolean)
    : [];
  return Array.from(new Set([...containerNames, ...initContainerNames]));
}

function TabButton({ active, disabled = false, icon: Icon, label, onClick }: { active: boolean; disabled?: boolean; icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${active ? 'bg-primary text-white' : 'bg-white/70 text-primary shadow-[inset_0_0_0_1px_rgba(13,91,215,0.18)]'}`}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function ResourceDetailView({ isLoading, error, spec, labels }: { isLoading: boolean; error: unknown; spec?: Record<string, any>; labels: Record<string, string> }) {
  if (isLoading) {
    return <div className="rounded-lg bg-white/45 px-4 py-8 text-center text-sm font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">正在读取资源详情。</div>;
  }
  if (error) {
    return <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">资源详情读取失败：{errorMessage(error)}</div>;
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <section className="rounded-lg bg-white/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
        <div className="text-xs font-semibold text-muted">Labels</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(labels).length ? Object.entries(labels).map(([key, value]) => (
            <span key={key} className="rounded-lg bg-primary-soft px-2 py-1 font-mono text-[11px] font-semibold text-primary">{key}={value}</span>
          )) : <span className="text-sm text-muted">无标签</span>}
        </div>
      </section>
      <section className="rounded-lg bg-white/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
        <div className="text-xs font-semibold text-muted">Spec</div>
        <pre className="mt-3 max-h-[360px] overflow-auto rounded-lg bg-[#10201f] p-4 text-xs leading-6 text-[#d7ebe8]">{JSON.stringify(spec ?? {}, null, 2)}</pre>
      </section>
    </div>
  );
}

function CodePreview({ isLoading, error, emptyText, content }: { isLoading: boolean; error: unknown; emptyText: string; content: string }) {
  if (isLoading) {
    return <div className="rounded-lg bg-white/45 px-4 py-8 text-center text-sm font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">正在读取内容。</div>;
  }
  if (error) {
    return <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">内容读取失败：{errorMessage(error)}</div>;
  }
  if (!content.trim()) {
    return <div className="rounded-lg bg-white/45 px-4 py-8 text-center text-sm font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">{emptyText}</div>;
  }
  return <pre className="max-h-[460px] overflow-auto rounded-lg bg-[#10201f] p-4 text-xs leading-6 text-[#d7ebe8]">{content}</pre>;
}
