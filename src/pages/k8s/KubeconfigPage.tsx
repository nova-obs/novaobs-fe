import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Download, FileKey2, KeyRound, ShieldAlert, ShieldCheck } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { k8sApi, type K8sKubeconfigExport, type K8sKubeconfigMetadata } from './api';

const DEFAULT_CLUSTER = 'prod';
const DEFAULT_NAMESPACE = 'orders';

export function K8sKubeconfigPage() {
  const [serviceAccount, setServiceAccount] = useState('orders-reader');
  const [metadata, setMetadata] = useState<K8sKubeconfigMetadata | null>(null);
  const [exported, setExported] = useState<K8sKubeconfigExport | null>(null);

  const createMutation = useMutation({
    mutationFn: () => k8sApi.createKubeconfig({ clusterId: DEFAULT_CLUSTER, namespace: DEFAULT_NAMESPACE, serviceAccount }),
    onSuccess: (result) => {
      setMetadata(result);
      setExported(null);
    },
  });

  const exportMutation = useMutation({
    mutationFn: () => k8sApi.exportKubeconfig(metadata?.secretId ?? ''),
    onSuccess: (result) => setExported(result),
  });

  const permissionError = [createMutation.error?.message, exportMutation.error?.message]
    .filter(Boolean)
    .join(' ')
    .includes('无权');

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_0.8fr]">
        <KubeconfigMetric icon={KeyRound} label="Secret" value={metadata ? 'created' : 'pending'} meta="platform/secret" />
        <KubeconfigMetric icon={ShieldCheck} label="权限" value="export" meta="k8s.kubeconfig" />
        <KubeconfigMetric icon={FileKey2} label="明文" value={exported ? 'visible' : 'hidden'} meta="audit gated" />
      </div>

      <DataPanel title="Kubeconfig" meta="生成写入 Secret，导出单独授权并审计">
        {permissionError ? (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            <ShieldAlert className="h-4 w-4" />
            权限不足：当前用户缺少 `k8s.kubeconfig:export` 权限。
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <aside className="console-panel px-4 py-3">
            <div className="text-sm font-semibold text-on-surface">生成确认</div>
            <p className="mt-1 text-xs text-muted">普通响应只返回 Secret 元数据，不展示 kubeconfig 明文。</p>
            <label className="mt-4 block text-xs font-semibold text-muted" htmlFor="kubeconfig-sa">ServiceAccount</label>
            <input id="kubeconfig-sa" className="console-input mt-2 w-full" value={serviceAccount} onChange={(event) => setServiceAccount(event.target.value)} />
            <div className="mt-4 rounded-lg bg-white/45 px-3 py-3 text-xs text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
              <div className="font-mono">cluster={DEFAULT_CLUSTER}</div>
              <div className="font-mono">namespace={DEFAULT_NAMESPACE}</div>
              <div className="font-mono">service_account={serviceAccount || '-'}</div>
            </div>
            <button
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!serviceAccount.trim() || createMutation.isPending}
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
