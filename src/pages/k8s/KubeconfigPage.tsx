import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, Copy, Download, KeyRound, ShieldAlert } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { HelpTip } from '../../components/HelpTip';
import { k8sApi, type K8sKubeconfigExport, type K8sKubeconfigMetadata } from './api';
import { useK8sOpsContext } from './context';

export function K8sKubeconfigPage() {
  const [namespace, setNamespace] = useState('');
  const [serviceAccount, setServiceAccount] = useState('');
  const [metadata, setMetadata] = useState<K8sKubeconfigMetadata | null>(null);
  const [exported, setExported] = useState<K8sKubeconfigExport | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  const { activeClusterId, activeCluster, clusterError } = useK8sOpsContext();

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
    const namespaceExists = namespaces.some((item) => item.name === namespace);
    if (namespace && !namespaceExists) {
      setNamespace(namespaces[0]?.name ?? '');
      setServiceAccount('');
      setMetadata(null);
      setExported(null);
      setCopyStatus('idle');
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
      setCopyStatus('idle');
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
      setCopyStatus('idle');
    },
  });

  const exportMutation = useMutation({
    mutationFn: () => k8sApi.exportKubeconfig(metadata?.secretId ?? ''),
    onSuccess: (result) => {
      setExported(result);
      setCopyStatus('idle');
    },
  });

  const permissionError = useMemo(() => {
    const message = [createMutation.error?.message, exportMutation.error?.message].filter(Boolean).join(' ');
    return message.includes('无权') || message.includes('permission_denied') ? message : '';
  }, [createMutation.error, exportMutation.error]);
  const canGenerate = Boolean(activeClusterId && namespace && serviceAccount);
  const canCopyKubeconfig = Boolean(exported?.kubeconfig);

  const handleCopyKubeconfig = async () => {
    if (!exported?.kubeconfig) return;
    try {
      await copyKubeconfigToClipboard(exported.kubeconfig);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  };

  return (
    <div className="space-y-4">
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
                setServiceAccount('');
                setMetadata(null);
                setExported(null);
                setCopyStatus('idle');
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
            <select
              className="console-input mt-2 w-full"
              value={serviceAccount}
              onChange={(event) => {
                setServiceAccount(event.target.value);
                setMetadata(null);
                setExported(null);
                setCopyStatus('idle');
              }}
              disabled={!serviceAccounts.length}
            >
              {!serviceAccounts.length ? <option value="">暂无 ServiceAccount</option> : null}
              {serviceAccounts.map((item) => (
                <option key={item.uid || item.id} value={item.name}>{item.name}</option>
              ))}
            </select>
          </label>

        </div>
        {clusterError || namespaceError || serviceAccountError ? (
          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            {clusterError ? '集群列表读取失败，请检查 NovaAPM 后端连接。' : errorMessage(namespaceError || serviceAccountError)}
          </div>
        ) : null}
      </section>

      <DataPanel title="Kubeconfig" help="生成操作只返回 Secret 元数据；明文仅在单独授权并写入审计后导出。">
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

        <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="console-panel px-4 py-3">
            <div className="text-sm font-semibold text-on-surface">生成确认</div>
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

          <div className="min-w-0 space-y-4">
            <section className="console-panel min-w-0 px-4 py-3">
              <div className="text-sm font-semibold text-on-surface">Secret 元数据</div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <MetaItem label="存储位置" value={metadata?.secretId ? 'Secret Store 托管' : '-'} />
                <MetaItem label="expires_at" value={formatDate(metadata?.expiresAt ?? '')} />
              </div>
              {metadata?.auditId ? <div className="mt-3 text-xs font-semibold text-primary">生成审计：<span className="font-mono">{metadata.auditId}</span></div> : null}
            </section>

            <section className="console-panel min-w-0 overflow-hidden px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-1.5">
                  <div className="text-sm font-semibold text-on-surface">明文导出</div>
                  <HelpTip content="仅在点击“审计导出”后显示，导出动作会单独写入审计。" label="明文导出说明" />
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {exported?.auditId ? <span className="rounded-lg bg-primary-soft px-2 py-1 text-xs font-semibold text-primary">audit {exported.auditId}</span> : null}
                  <button
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white/80 px-2.5 py-1.5 text-xs font-semibold text-primary shadow-[inset_0_0_0_1px_rgba(13,91,215,0.18)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!canCopyKubeconfig}
                    onClick={handleCopyKubeconfig}
                  >
                    {copyStatus === 'copied' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copyStatus === 'copied' ? '已复制' : '复制明文'}
                  </button>
                </div>
              </div>
              {copyStatus === 'failed' ? <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-warning">浏览器拒绝写入剪贴板，请手动选中明文区域复制。</div> : null}
              <pre className="mt-3 max-h-[420px] min-h-[180px] max-w-full overflow-auto whitespace-pre-wrap break-all rounded-lg bg-white/60 p-3 font-mono text-xs leading-5 text-on-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
                {exported?.kubeconfig ?? 'kubeconfig 明文当前隐藏'}
              </pre>
            </section>
          </div>
        </div>
      </DataPanel>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-white/45 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
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

async function copyKubeconfigToClipboard(value: string) {
  if (!value) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!copied) {
    throw new Error('copy_failed');
  }
}
