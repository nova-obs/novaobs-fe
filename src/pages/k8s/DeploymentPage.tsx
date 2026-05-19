import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CloudUpload, RotateCcw, ShieldAlert, Trash2 } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { k8sApi, type K8sDeploymentIdentity, type K8sDeploymentOperationResult } from './api';

const DEFAULT_CLUSTER = 'prod';
const DEFAULT_YAML = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: orders-api
  namespace: orders
spec:
  replicas: 2`;

const DEFAULT_IDENTITY: K8sDeploymentIdentity = {
  clusterId: DEFAULT_CLUSTER,
  namespace: 'orders',
  apiVersion: 'apps/v1',
  kind: 'Deployment',
  name: 'orders-api',
  uid: 'uid-orders-api',
};

export function K8sDeploymentPage() {
  const [yamlContent, setYamlContent] = useState(DEFAULT_YAML);
  const [identity, setIdentity] = useState<K8sDeploymentIdentity>(DEFAULT_IDENTITY);
  const [historyId, setHistoryId] = useState('deploy-orders-1');
  const [lastResult, setLastResult] = useState<K8sDeploymentOperationResult | null>(null);

  const previewMutation = useMutation({
    mutationFn: () => k8sApi.previewDeployment({ clusterId: DEFAULT_CLUSTER, yamlContent }),
    onSuccess: setLastResult,
  });
  const applyMutation = useMutation({
    mutationFn: () => k8sApi.applyDeployment({ clusterId: DEFAULT_CLUSTER, yamlContent }),
    onSuccess: setLastResult,
  });
  const deleteMutation = useMutation({
    mutationFn: () => k8sApi.deleteDeployment(identity),
    onSuccess: setLastResult,
  });
  const rollbackMutation = useMutation({
    mutationFn: () => k8sApi.rollbackDeployment({ identity, historyId }),
    onSuccess: setLastResult,
  });

  const permissionError = useMemo(() => {
    const message = previewMutation.error?.message || applyMutation.error?.message || deleteMutation.error?.message || rollbackMutation.error?.message || '';
    return message.includes('无权') || message.includes('permission_denied') ? message : '';
  }, [previewMutation.error, applyMutation.error, deleteMutation.error, rollbackMutation.error]);

  const resourceCount = lastResult?.resources.length ?? extractResourceCount(yamlContent);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_0.8fr]">
        <DeployMetric label="资源" value={String(resourceCount)} meta="cluster/prod" />
        <DeployMetric label="动作" value={lastResult?.status || 'preview'} meta="k8s.deployment" />
        <DeployMetric label="审计" value={lastResult?.auditId ? 'recorded' : 'pending'} meta={lastResult?.auditId || 'namespace scope'} />
      </div>

      <DataPanel title="发布部署" meta="preview / apply / delete / rollback 统一走 NovaObs RBAC 与审计">
        {permissionError ? (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            <ShieldAlert className="h-4 w-4" />
            权限不足：当前用户缺少 `k8s.deployment` 对应操作权限。
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
              <textarea className="console-input mt-3 min-h-[430px] w-full font-mono text-xs" value={yamlContent} onChange={(event) => setYamlContent(event.target.value)} />
            </section>
            <section className="console-panel px-4 py-3">
              <div className="text-sm font-semibold text-on-surface">执行结果</div>
              <div className="mt-3 rounded-lg bg-white/50 px-3 py-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
                <div className="font-semibold text-on-surface">{lastResult?.message || '等待预览或发布动作'}</div>
                <div className="mt-2 font-mono text-xs text-muted">status={lastResult?.status || '-'}</div>
                <div className="font-mono text-xs text-muted">audit={lastResult?.auditId || '-'}</div>
              </div>
              <div className="mt-4 space-y-3">
                {(lastResult?.resources ?? [identity]).map((item) => (
                  <div key={`${item.kind}-${item.name}-${item.uid || 'preview'}`} className="rounded-lg bg-white/50 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-primary">{item.name}</div>
                        <div className="mt-1 text-[11px] text-muted">{item.kind}</div>
                      </div>
                      <div className="shrink-0 rounded-md bg-primary-soft px-2 py-1 font-mono text-[11px] font-semibold text-primary">{item.namespace}</div>
                    </div>
                    <div className="mt-3 grid gap-2 text-[11px] text-muted">
                      <div className="break-all font-mono">api={item.apiVersion}</div>
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
            <IdentityInput label="namespace" value={identity.namespace} onChange={(value) => setIdentity({ ...identity, namespace: value })} />
            <IdentityInput label="api_version" value={identity.apiVersion} onChange={(value) => setIdentity({ ...identity, apiVersion: value })} />
            <IdentityInput label="kind" value={identity.kind} onChange={(value) => setIdentity({ ...identity, kind: value })} />
            <IdentityInput label="name" value={identity.name} onChange={(value) => setIdentity({ ...identity, name: value })} />
            <IdentityInput label="uid" value={identity.uid || ''} onChange={(value) => setIdentity({ ...identity, uid: value })} />
            <IdentityInput label="history_id" value={historyId} onChange={setHistoryId} />

            <div className="mt-4 rounded-lg bg-white/45 px-3 py-3 text-xs text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
              <div className="font-semibold text-on-surface">确认摘要</div>
              <div className="mt-2 font-mono">cluster={DEFAULT_CLUSTER}</div>
              <div className="font-mono">namespace={identity.namespace || '-'}</div>
              <div className="font-mono">resource={identity.kind || '-'}/{identity.name || '-'}</div>
              <div className="font-mono">uid={identity.uid || '-'}</div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-sm font-semibold text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60" disabled={!yamlContent.trim() || previewMutation.isPending} onClick={() => previewMutation.mutate()}>
                <CloudUpload className="h-4 w-4" />
                预览
              </button>
              <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60" disabled={!yamlContent.trim() || applyMutation.isPending} onClick={() => applyMutation.mutate()}>
                <CloudUpload className="h-4 w-4" />
                发布
              </button>
              <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-sm font-semibold text-danger shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60" disabled={!identity.uid || deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
                <Trash2 className="h-4 w-4" />
                删除
              </button>
              <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-sm font-semibold text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60" disabled={!identity.uid || !historyId.trim() || rollbackMutation.isPending} onClick={() => rollbackMutation.mutate()}>
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

function IdentityInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="mt-3 block text-xs font-semibold text-muted">
      {label}
      <input className="console-input mt-2 w-full" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function extractResourceCount(value: string) {
  return Math.max(1, value.split('---').filter((item) => item.trim()).length);
}
