import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, FileKey2, KeyRound, ShieldAlert, ShieldCheck } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { k8sApi, type K8sKubeconfigExport, type K8sKubeconfigMetadata } from './api';

export function K8sKubeconfigPage() {
  const [selectedClusterId, setSelectedClusterId] = useState('');
  const [namespace, setNamespace] = useState('');
  const [serviceAccount, setServiceAccount] = useState('');
  const [metadata, setMetadata] = useState<K8sKubeconfigMetadata | null>(null);
  const [exported, setExported] = useState<K8sKubeconfigExport | null>(null);

  const { data: clusters = [], isLoading: isLoadingClusters, error: clusterError } = useQuery({
    queryKey: ['k8s-clusters'],
    queryFn: () => k8sApi.listClusters(),
    retry: false,
  });
  const activeClusterId = selectedClusterId || clusters[0]?.id || '';

  const { data: namespaces = [], error: namespaceError } = useQuery({
    queryKey: ['k8s-namespaces', activeClusterId],
    queryFn: () => k8sApi.listNamespaces(activeClusterId),
    enabled: Boolean(activeClusterId),
    retry: false,
  });

  const { data: serviceAccounts = [], isLoading: isLoadingServiceAccounts, error: serviceAccountError } = useQuery({
    queryKey: ['k8s-service-accounts', activeClusterId, namespace],
    queryFn: () => k8sApi.listServiceAccounts(activeClusterId, namespace),
    enabled: Boolean(activeClusterId && namespace),
    retry: false,
  });

  useEffect(() => {
    if (!selectedClusterId && clusters[0]?.id) {
      setSelectedClusterId(clusters[0].id);
    }
  }, [clusters, selectedClusterId]);

  useEffect(() => {
    const namespaceExists = namespaces.some((item) => item.name === namespace);
    if (namespace && !namespaceExists) {
      setNamespace(namespaces[0]?.name ?? '');
      setServiceAccount('');
      setMetadata(null);
      setExported(null);
      return;
    }
    if (!namespace && namespaces[0]?.name) {
      setNamespace(namespaces[0].name);
    }
  }, [namespace, namespaces]);

  useEffect(() => {
    const serviceAccountExists = serviceAccounts.some((item) => item.name === serviceAccount);
    if (serviceAccount && !serviceAccountExists) {
      setServiceAccount(serviceAccounts[0]?.name ?? '');
      setMetadata(null);
      setExported(null);
      return;
    }
    if (!serviceAccount && serviceAccounts[0]?.name) {
      setServiceAccount(serviceAccounts[0].name);
    }
  }, [serviceAccount, serviceAccounts]);

  const createMutation = useMutation({
    mutationFn: () => k8sApi.createKubeconfig({ clusterId: activeClusterId, namespace, serviceAccount }),
    onSuccess: (result) => {
      setMetadata(result);
      setExported(null);
    },
  });

  const exportMutation = useMutation({
    mutationFn: () => k8sApi.exportKubeconfig(metadata?.secretId ?? ''),
    onSuccess: (result) => setExported(result),
  });

  const permissionError = useMemo(() => {
    const message = [createMutation.error?.message, exportMutation.error?.message].filter(Boolean).join(' ');
    return message.includes('无权') || message.includes('permission_denied') ? message : '';
  }, [createMutation.error, exportMutation.error]);
  const canGenerate = Boolean(activeClusterId && namespace && serviceAccount);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_0.8fr]">
        <KubeconfigMetric icon={KeyRound} label="Secret" value={metadata ? 'created' : 'pending'} meta={activeClusterId ? `cluster/${activeClusterId}` : '等待集群'} />
        <KubeconfigMetric icon={ShieldCheck} label="权限" value="export" meta={namespace ? `namespace/${namespace}` : '等待命名空间'} />
        <KubeconfigMetric icon={FileKey2} label="明文" value={exported ? 'visible' : 'hidden'} meta="audit gated" />
      </div>

      <section className="console-panel px-4 py-3">
        <div className="grid gap-3 xl:grid-cols-[minmax(180px,260px)_minmax(180px,240px)_minmax(220px,280px)_1fr] xl:items-end">
          <label className="block">
            <span className="text-xs font-semibold text-muted">集群选择</span>
            <select
              className="console-input mt-2 w-full"
              value={activeClusterId}
              onChange={(event) => {
                setSelectedClusterId(event.target.value);
                setNamespace('');
                setServiceAccount('');
                setMetadata(null);
                setExported(null);
              }}
              disabled={isLoadingClusters || !clusters.length}
            >
              {!clusters.length ? <option value="">暂无已登记集群</option> : null}
              {clusters.map((item) => (
                <option key={item.id} value={item.id}>{item.name || item.id}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-muted">命名空间选择</span>
            <select
              className="console-input mt-2 w-full"
              value={namespace}
              onChange={(event) => {
                setNamespace(event.target.value);
                setServiceAccount('');
                setMetadata(null);
                setExported(null);
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
            <span className="text-xs font-semibold text-muted">ServiceAccount 选择</span>
            <select className="console-input mt-2 w-full" value={serviceAccount} onChange={(event) => setServiceAccount(event.target.value)} disabled={!serviceAccounts.length}>
              {!serviceAccounts.length ? <option value="">暂无 ServiceAccount</option> : null}
              {serviceAccounts.map((item) => (
                <option key={item.uid || item.id} value={item.name}>{item.name}</option>
              ))}
            </select>
          </label>
          <div className="text-sm text-muted">
            目标来自真实 Kubernetes API 只读列表；生成动作只写 NovaObs platform/secret，导出明文单独授权并审计。
          </div>
        </div>
        {clusterError || namespaceError || serviceAccountError ? (
          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            {clusterError ? '集群列表读取失败，请检查 NovaObs 后端连接。' : errorMessage(namespaceError || serviceAccountError)}
          </div>
        ) : null}
      </section>

      <DataPanel title="Kubeconfig" meta="生成写入 Secret，导出单独授权并审计">
        {permissionError ? (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            <ShieldAlert className="h-4 w-4" />
            权限不足：当前用户缺少 `k8s.kubeconfig:export` 权限。
          </div>
        ) : null}
        {isLoadingServiceAccounts ? (
          <div className="mb-3 rounded-lg bg-white/45 px-3 py-2 text-sm font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
            正在读取当前命名空间的 ServiceAccount。
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <aside className="console-panel px-4 py-3">
            <div className="text-sm font-semibold text-on-surface">生成确认</div>
            <p className="mt-1 text-xs text-muted">普通响应只返回 Secret 元数据，不展示 kubeconfig 明文。</p>
            <div className="mt-4 rounded-lg bg-white/45 px-3 py-3 text-xs text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
              <div className="font-mono">cluster={activeClusterId || '-'}</div>
              <div className="font-mono">namespace={namespace || '-'}</div>
              <div className="font-mono">service_account={serviceAccount || '-'}</div>
            </div>
            {!canGenerate ? (
              <div className="mt-3 rounded-lg bg-white/45 px-3 py-3 text-xs text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
                请先选择集群、命名空间和已存在的 ServiceAccount。
              </div>
            ) : null}
            <button
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canGenerate || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              <KeyRound className="h-4 w-4" />
              生成 Secret
            </button>
            <button
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-sm font-semibold text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!metadata?.secretId || exportMutation.isPending}
              onClick={() => exportMutation.mutate()}
            >
              <Download className="h-4 w-4" />
              审计导出
            </button>
          </aside>

          <div className="space-y-4">
            <section className="console-panel px-4 py-3">
              <div className="text-sm font-semibold text-on-surface">Secret 元数据</div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <MetaItem label="secret_id" value={metadata?.secretId ?? '-'} />
                <MetaItem label="fingerprint" value={metadata?.fingerprint ?? '-'} />
                <MetaItem label="expires_at" value={formatDate(metadata?.expiresAt ?? '')} />
              </div>
              {metadata?.auditId ? <div className="mt-3 text-xs font-semibold text-primary">生成审计：<span className="font-mono">{metadata.auditId}</span></div> : null}
            </section>

            <section className="console-panel px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-on-surface">明文导出</div>
                  <p className="mt-1 text-xs text-muted">仅在点击“审计导出”后显示，导出动作单独写审计。</p>
                </div>
                {exported?.auditId ? <span className="rounded-lg bg-primary-soft px-2 py-1 text-xs font-semibold text-primary">audit {exported.auditId}</span> : null}
              </div>
              <pre className="mt-3 min-h-[180px] overflow-auto rounded-lg bg-white/60 p-3 font-mono text-xs text-on-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
                {exported?.kubeconfig ?? 'kubeconfig 明文当前隐藏'}
              </pre>
            </section>
          </div>
        </div>
      </DataPanel>
    </div>
  );
}

function KubeconfigMetric({ icon: Icon, label, value, meta }: { icon: typeof KeyRound; label: string; value: string; meta: string }) {
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

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/45 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className="mt-2 break-all font-mono text-xs text-on-surface">{value}</div>
    </div>
  );
}

function formatDate(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : '请检查集群凭据、平台 RBAC 与 Kubernetes API 连通性。';
}
