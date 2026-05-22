import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, KeyRound, Network, Plus, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { k8sApi } from './api';

export function K8sClusterPage() {
  const queryClient = useQueryClient();
  const [credentialClusterId, setCredentialClusterId] = useState('');
  const [credentialName, setCredentialName] = useState('');
  const [kubeconfig, setKubeconfig] = useState('');
  const [clusterId, setClusterId] = useState('');
  const [clusterName, setClusterName] = useState('');
  const [clusterVersion, setClusterVersion] = useState('');
  const [clusterRegion, setClusterRegion] = useState('');
  const [clusterDescription, setClusterDescription] = useState('');
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['k8s-clusters'],
    queryFn: () => k8sApi.listClusters(),
    retry: false,
  });
  const createCluster = useMutation({
    mutationFn: () => k8sApi.createCluster({ id: clusterId, name: clusterName, version: clusterVersion, region: clusterRegion, description: clusterDescription }),
    onSuccess: (cluster) => {
      setCredentialClusterId(cluster.id);
      queryClient.invalidateQueries({ queryKey: ['k8s-clusters'] });
    },
  });
  const deleteCluster = useMutation({
    mutationFn: (id: string) => k8sApi.deleteCluster(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['k8s-clusters'] });
      if (credentialClusterId) {
        queryClient.invalidateQueries({ queryKey: ['k8s-cluster-credentials', credentialClusterId] });
      }
    },
  });
  const credentialsQuery = useQuery({
    queryKey: ['k8s-cluster-credentials', credentialClusterId],
    queryFn: () => k8sApi.listClusterCredentials(credentialClusterId),
    enabled: Boolean(credentialClusterId),
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
  const displayClusters = data;
  const credentialResult = createCredential.data ?? rotateCredential.data;
  const credentialError = createCredential.error?.message || rotateCredential.error?.message || '';
  const clusterError = createCluster.error?.message || deleteCluster.error?.message || '';

  useEffect(() => {
    if (!displayClusters.length) {
      if (credentialClusterId) {
        setCredentialClusterId('');
      }
      return;
    }
    const exists = displayClusters.some((cluster) => cluster.id === credentialClusterId);
    if (!credentialClusterId || !exists) {
      setCredentialClusterId(displayClusters[0].id);
    }
  }, [credentialClusterId, displayClusters]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <ClusterMetric icon={Network} label="连接集群" value={String(displayClusters.length)} meta="Mongo-backed API" />
        <ClusterMetric icon={Database} label="区域" value={primaryRegion(displayClusters)} meta="来自集群登记" />
        <ClusterMetric icon={ShieldCheck} label="权限域" value="global" meta="NovaObs RBAC" />
      </div>

      <div className="grid gap-4">
        <DataPanel title="集群列表" meta={isLoading ? '加载中' : `${displayClusters.length} 个集群 · /api/v1/k8s/clusters`}>
        {error ? (
          <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-danger">
            集群 API 请求失败：{error.message}
          </div>
        ) : null}
        <div className="overflow-auto">
          {!isLoading && !error && displayClusters.length ? (
            <table className="console-table min-w-[760px] w-full">
              <thead>
                <tr>
                  <th>集群</th>
                  <th>版本</th>
                  <th>区域</th>
                  <th>状态</th>
                  <th>来源</th>
                  <th>操作</th>
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
                    <td className="text-xs text-muted">novaobs</td>
                    <td>
                      <button
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/70 px-3 py-1.5 text-xs font-semibold text-danger shadow-[inset_0_0_0_1px_rgba(169,68,66,0.18)] transition active:scale-[0.98] disabled:opacity-60"
                        disabled={deleteCluster.isPending}
                        onClick={() => deleteCluster.mutate(cluster.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        删除元数据
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            !isLoading && !error ? (
            <div className="rounded-lg bg-white/45 px-4 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
              <div className="font-semibold text-on-surface">暂无集群</div>
              <p className="mt-2 text-sm text-muted">后端已联通，请先通过右侧入口登记新平台集群元数据。</p>
            </div>
            ) : null
          )}
        </div>
        </DataPanel>

        <section className="console-panel px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-on-surface">集群登记</div>
              <p className="mt-1 text-xs text-muted">写入 NovaObs 新平台数据集合，作为凭据、命名空间与资源同步的入口。</p>
            </div>
            <Plus className="h-4 w-4 text-primary" />
          </div>
          {clusterError ? <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-danger">{clusterError}</div> : null}
          {createCluster.data ? <div className="mt-3 rounded-lg bg-primary-soft px-3 py-2 text-xs font-semibold text-primary">已登记集群：{createCluster.data.name}</div> : null}
          <CredentialInput label="cluster_id" value={clusterId} onChange={setClusterId} />
          <CredentialInput label="name" value={clusterName} onChange={setClusterName} />
          <CredentialInput label="version" value={clusterVersion} onChange={setClusterVersion} />
          <CredentialInput label="region" value={clusterRegion} onChange={setClusterRegion} />
          <label className="mt-3 block text-xs font-semibold text-muted">
            description
            <textarea className="console-input mt-2 min-h-20 w-full text-xs" value={clusterDescription} onChange={(event) => setClusterDescription(event.target.value)} />
          </label>
          <button className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-60" disabled={!clusterId || !clusterName || createCluster.isPending} onClick={() => createCluster.mutate()}>
            <Plus className="h-4 w-4" />
            登记集群
          </button>
        </section>
      </div>

      <div className="grid gap-4">
        <DataPanel title="集群凭据" meta={`/api/v1/k8s/cluster-credentials · ${credentialsQuery.data?.length ?? 0} 条元数据`}>
          {credentialsQuery.error ? (
            <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
              集群凭据读取失败：{errorMessage(credentialsQuery.error)}
            </div>
          ) : null}
          {!credentialClusterId ? (
            <div className="mb-3 rounded-lg bg-white/45 px-3 py-2 text-sm font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
              请先登记或选择集群，再录入 kubeconfig。
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
            <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-sm font-semibold text-primary shadow-[inset_0_0_0_1px_rgba(13,91,215,0.18)] transition active:scale-[0.98] disabled:opacity-60" disabled={!credentialClusterId || !credentialName || !kubeconfig || rotateCredential.isPending} onClick={() => rotateCredential.mutate()}>
              <RotateCcw className="h-4 w-4" />
              轮换
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

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

function primaryRegion(clusters: Array<{ region: string }>) {
  return clusters.find((item) => item.region)?.region || '-';
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

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : '请检查 NovaObs 后端连接、平台 RBAC 与 Secret 服务状态。';
}
