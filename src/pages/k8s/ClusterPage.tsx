import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, KeyRound, Network, RotateCcw, ShieldCheck } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { k8sApi } from './api';

export function K8sClusterPage() {
  const queryClient = useQueryClient();
  const [credentialClusterId, setCredentialClusterId] = useState('prod');
  const [credentialName, setCredentialName] = useState('prod-readonly');
  const [kubeconfig, setKubeconfig] = useState('');
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['k8s-clusters'],
    queryFn: () => k8sApi.listClusters(),
    retry: false,
  });
  const credentialsQuery = useQuery({
    queryKey: ['k8s-cluster-credentials', credentialClusterId],
    queryFn: () => k8sApi.listClusterCredentials(credentialClusterId),
    retry: false,
  });
  const createCredential = useMutation({
    mutationFn: () => k8sApi.createClusterCredential({ clusterId: credentialClusterId, name: credentialName, kubeconfig }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['k8s-cluster-credentials', credentialClusterId] }),
  });
  const rotateCredential = useMutation({
    mutationFn: () => k8sApi.rotateClusterCredential({ clusterId: credentialClusterId, name: credentialName, kubeconfig }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['k8s-cluster-credentials', credentialClusterId] }),
  });
  const useFallback = isLoading || Boolean(error);
  const displayClusters = useFallback ? fallbackClusters : data;
  const credentialResult = createCredential.data ?? rotateCredential.data;
  const credentialError = createCredential.error?.message || rotateCredential.error?.message || '';

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <ClusterMetric icon={Network} label="连接集群" value={String(displayClusters.length)} meta="startorch baseline" />
        <ClusterMetric icon={Database} label="区域" value="cn-shanghai" meta="primary region" />
        <ClusterMetric icon={ShieldCheck} label="权限域" value="global" meta="NovaObs RBAC" />
      </div>

      <DataPanel title="集群列表" meta={isLoading ? '加载中' : `${displayClusters.length} 个集群 · 最近 15 分钟`}>
        {error ? (
          <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            集群 API 暂未连接，等待后端 `/api/v1/k8s/clusters`。
          </div>
        ) : null}
        <div className="overflow-auto">
          {displayClusters.length ? (
            <table className="console-table min-w-[760px] w-full">
              <thead>
                <tr>
                  <th>集群</th>
                  <th>版本</th>
                  <th>区域</th>
                  <th>状态</th>
                  <th>来源</th>
                </tr>
              </thead>
              <tbody>
                {displayClusters.map((cluster) => (
                  <tr key={cluster.id} className="bg-white/35 hover:bg-white/60">
                    <td>
                      <div className="font-semibold text-primary">{cluster.name}</div>
                      <div className="text-[11px] text-muted">{cluster.description || cluster.id}</div>
                    </td>
                    <td className="font-mono text-xs">{cluster.version || '-'}</td>
                    <td className="font-mono text-xs">{cluster.region || '-'}</td>
                    <td><StatusPill status={cluster.status} /></td>
                    <td className="text-xs text-muted">startorch</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="rounded-lg bg-white/45 px-4 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
              <div className="font-semibold text-on-surface">暂无集群</div>
              <p className="mt-2 text-sm text-muted">后端已联通，但当前筛选条件下没有返回 Kubernetes 集群。</p>
            </div>
          )}
        </div>
      </DataPanel>

      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <DataPanel title="集群凭据" meta={`/api/v1/k8s/cluster-credentials · ${credentialsQuery.data?.length ?? 0} 条元数据`}>
          {credentialsQuery.error ? (
            <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
              集群凭据 API 暂未连接，等待后端 `/api/v1/k8s/cluster-credentials`。
            </div>
          ) : null}
          <div className="overflow-auto">
            {(credentialsQuery.data ?? []).length ? (
              <table className="console-table min-w-[780px] w-full">
                <thead>
                  <tr>
                    <th>凭据</th>
                    <th>集群</th>
                    <th>指纹</th>
                    <th>状态</th>
                    <th>创建时间</th>
                  </tr>
                </thead>
                <tbody>
                  {(credentialsQuery.data ?? []).map((item) => (
                    <tr key={item.secretId} className="bg-white/35 hover:bg-white/60">
                      <td>
                        <div className="font-semibold text-primary">{item.name}</div>
                        <div className="text-[11px] text-muted">{item.secretId}</div>
                      </td>
                      <td className="font-mono text-xs">{item.clusterId}</td>
                      <td className="font-mono text-xs">{item.fingerprint || '-'}</td>
                      <td><StatusPill status={item.status} /></td>
                      <td className="font-mono text-xs">{item.createdAt || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="rounded-lg bg-white/45 px-4 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
                <div className="font-semibold text-on-surface">暂无集群凭据</div>
                <p className="mt-2 text-sm text-muted">录入后只展示 Secret 元数据，kubeconfig 明文不在页面回显。</p>
              </div>
            )}
          </div>
        </DataPanel>

        <section className="console-panel px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-on-surface">凭据录入</div>
              <p className="mt-1 text-xs text-muted">用于真实 API 环境联调；提交后进入 platform/secret，列表和审计不展示明文。</p>
            </div>
            <KeyRound className="h-4 w-4 text-primary" />
          </div>
          {credentialError ? <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-danger">{credentialError}</div> : null}
          {credentialResult ? <div className="mt-3 rounded-lg bg-primary-soft px-3 py-2 text-xs font-semibold text-primary">操作已落审计：{credentialResult.auditId}</div> : null}
          <CredentialInput label="cluster_id" value={credentialClusterId} onChange={setCredentialClusterId} />
          <CredentialInput label="name" value={credentialName} onChange={setCredentialName} />
          <label className="mt-3 block text-xs font-semibold text-muted">
            kubeconfig
            <textarea
              className="console-input mt-2 min-h-40 w-full font-mono text-xs"
              placeholder={'apiVersion: v1\nkind: Config\nclusters: []'}
              value={kubeconfig}
              onChange={(event) => setKubeconfig(event.target.value)}
            />
          </label>
          <p className="mt-2 text-[11px] text-muted">kubeconfig 仅随请求提交，不在页面回显；轮换会创建新的 Secret 版本。</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-60" disabled={!credentialClusterId || !credentialName || !kubeconfig || createCredential.isPending} onClick={() => createCredential.mutate()}>
              <KeyRound className="h-4 w-4" />
              录入
            </button>
            <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-sm font-semibold text-primary shadow-[inset_0_0_0_1px_rgba(17,94,89,0.18)] transition active:scale-[0.98] disabled:opacity-60" disabled={!credentialClusterId || !credentialName || !kubeconfig || rotateCredential.isPending} onClick={() => rotateCredential.mutate()}>
              <RotateCcw className="h-4 w-4" />
              轮换
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

const fallbackClusters = [
  {
    id: 'prod',
    name: 'prod-core',
    version: 'v1.29.4',
    region: 'cn-shanghai',
    description: '生产核心集群，等待 API 联通',
    status: 'unknown',
  },
];

function ClusterMetric({ icon: Icon, label, value, meta }: { icon: typeof Network; label: string; value: string; meta: string }) {
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

function CredentialInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="mt-3 block text-xs font-semibold text-muted">
      {label}
      <input className="console-input mt-2 w-full" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function StatusPill({ status }: { status: string }) {
  const active = status === 'active';
  return (
    <span className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold ${active ? 'bg-primary-soft text-primary' : 'bg-amber-100 text-warning'}`}>
      {active ? '运行中' : status || 'unknown'}
    </span>
  );
}
