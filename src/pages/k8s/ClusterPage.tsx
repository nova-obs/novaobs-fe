import { useEffect, useState } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { Activity, Database, KeyRound, Network, Plus, RotateCcw, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { k8sApi, type K8sClusterCredential, type K8sClusterProbe, type K8sWriteResult } from './api';
import { useK8sOpsContext } from './context';

const clusterProbeStaleTimeMs = 2 * 60 * 1000;
const clusterProbeGcTimeMs = 10 * 60 * 1000;

function clusterProbeQueryKey(clusterId: string) {
  return ['k8s-cluster-probe', clusterId] as const;
}

export function K8sClusterPage() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const { activeClusterId, activeCluster, clusters: data, isLoadingClusters: isLoading, clusterError: error } = useK8sOpsContext();
  const isAccessView = location.pathname === '/k8s/access';
  const isNewAccessView = isAccessView && !activeClusterId;
  const isCredentialView = Boolean(activeClusterId && location.pathname.endsWith('/credentials'));
  const [credentialClusterId, setCredentialClusterId] = useState('');
  const [credentialName, setCredentialName] = useState('');
  const [credentialExpiresAt, setCredentialExpiresAt] = useState('');
  const [kubeconfig, setKubeconfig] = useState('');
  const [clusterId, setClusterId] = useState('');
  const [clusterName, setClusterName] = useState('');
  const [clusterVersion, setClusterVersion] = useState('');
  const [clusterRegion, setClusterRegion] = useState('');
  const [clusterDescription, setClusterDescription] = useState('');
  const [clusterAccessMode, setClusterAccessMode] = useState('direct');
  const [clusterReadOnly, setClusterReadOnly] = useState(true);
  const [manualProbeIds, setManualProbeIds] = useState<string[]>([]);
  const createCluster = useMutation({
    mutationFn: () => k8sApi.createCluster({ id: clusterId, name: clusterName, version: clusterVersion, region: clusterRegion, description: clusterDescription, accessMode: clusterAccessMode, readOnly: clusterReadOnly }),
    onSuccess: (cluster) => {
      setCredentialClusterId(cluster.id);
      if (!credentialName) {
        setCredentialName(cluster.name || cluster.id);
      }
      queryClient.invalidateQueries({ queryKey: ['k8s-clusters'] });
    },
  });
  const deleteCluster = useMutation({
    mutationFn: (id: string) => k8sApi.deleteCluster(id),
    onSuccess: (_result, id) => {
      queryClient.invalidateQueries({ queryKey: ['k8s-clusters'] });
      queryClient.removeQueries({ queryKey: clusterProbeQueryKey(id), exact: true });
      if (credentialClusterId) {
        queryClient.invalidateQueries({ queryKey: ['k8s-cluster-credentials', credentialClusterId] });
      }
    },
  });
  const credentialsQuery = useQuery({
    queryKey: ['k8s-cluster-credentials', credentialClusterId],
    queryFn: () => k8sApi.listClusterCredentials(credentialClusterId),
    enabled: Boolean(isCredentialView && credentialClusterId),
    retry: false,
  });
  const createCredential = useMutation({
    mutationFn: () => k8sApi.createClusterCredential({ clusterId: credentialClusterId, name: credentialName, kubeconfig, expiresAt: credentialExpiryISO(credentialExpiresAt) }),
    onSuccess: (result) => {
      handleCredentialWriteSuccess(result);
      setKubeconfig('');
    },
  });
  const rotateCredential = useMutation({
    mutationFn: () => k8sApi.rotateClusterCredential({ clusterId: credentialClusterId, name: credentialName, kubeconfig, expiresAt: credentialExpiryISO(credentialExpiresAt) }),
    onSuccess: (result) => {
      handleCredentialWriteSuccess(result);
      setKubeconfig('');
    },
  });
  const rollbackCredential = useMutation({
    mutationFn: (item: K8sClusterCredential) => k8sApi.rollbackClusterCredential({ clusterId: item.clusterId, secretId: item.secretId }),
    onSuccess: handleCredentialWriteSuccess,
  });
  const displayClusters = data;
  const managementCluster = activeCluster ?? displayClusters.find((cluster) => cluster.id === credentialClusterId);
  const managementClusters = activeClusterId ? displayClusters.filter((cluster) => cluster.id === activeClusterId) : displayClusters;
  const probeClusters = activeClusterId ? managementClusters : displayClusters;
  const clusterProbeQueries = useQueries({
    queries: probeClusters.map((cluster) => ({
      queryKey: clusterProbeQueryKey(cluster.id),
      queryFn: () => k8sApi.probeCluster(cluster.id),
      enabled: Boolean(cluster.id && !isLoading),
      staleTime: clusterProbeStaleTimeMs,
      gcTime: clusterProbeGcTimeMs,
      retry: false,
      refetchOnWindowFocus: false,
    })),
  });
  const probeByClusterId = new Map(probeClusters.map((cluster, index) => [cluster.id, clusterProbeQueries[index]]));
  const managementProbe = managementCluster ? probeByClusterId.get(managementCluster.id) : undefined;
  const managementProbeData = managementProbe?.data;
  const managementProbeError = optionalErrorMessage(managementProbe?.error);
  const credentialProbe = credentialClusterId ? probeByClusterId.get(credentialClusterId) : undefined;
  const isCredentialProbing = Boolean(credentialProbe?.isFetching || (credentialClusterId && manualProbeIds.includes(credentialClusterId)));
  const credentials = credentialsQuery.data ?? [];
  const activeCredential = credentials.find(isCredentialActive) ?? credentials[0];
  const historicalCredentials = credentials.filter((item) => item.secretId !== activeCredential?.secretId);
  const credentialResult = createCredential.data ?? rotateCredential.data ?? rollbackCredential.data;
  const credentialError = createCredential.error?.message || rotateCredential.error?.message || rollbackCredential.error?.message || '';
  const clusterError = createCluster.error?.message || deleteCluster.error?.message || '';

  async function runProbe(id: string) {
    if (!id) return;
    setManualProbeIds((current) => (current.includes(id) ? current : [...current, id]));
    try {
      await queryClient.invalidateQueries({ queryKey: clusterProbeQueryKey(id), exact: true });
      await queryClient.refetchQueries({ queryKey: clusterProbeQueryKey(id), exact: true });
    } finally {
      setManualProbeIds((current) => current.filter((item) => item !== id));
    }
  }

  function handleCredentialWriteSuccess(result: K8sWriteResult<K8sClusterCredential>) {
    const targetClusterId = result.item?.clusterId || credentialClusterId;
    if (result.probe?.clusterId) {
      queryClient.setQueryData(clusterProbeQueryKey(result.probe.clusterId), result.probe);
    }
    if (targetClusterId) {
      queryClient.invalidateQueries({ queryKey: ['k8s-cluster-credentials', targetClusterId] });
    }
  }

  useEffect(() => {
    if (activeClusterId) {
      if (credentialClusterId !== activeClusterId) {
        setCredentialClusterId(activeClusterId);
      }
      return;
    }
    if (isNewAccessView) {
      if (!credentialClusterId && clusterId) {
        setCredentialClusterId(clusterId);
      }
      return;
    }
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
  }, [activeClusterId, clusterId, credentialClusterId, displayClusters, isNewAccessView]);

  if (!activeClusterId && !isAccessView) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <ClusterMetric icon={Network} label="连接集群" value={String(displayClusters.length)} meta="已登记" />
          <ClusterMetric icon={Database} label="区域" value={primaryRegion(displayClusters)} meta="来自集群登记" />
          <ClusterMetric icon={ShieldCheck} label="只读保护" value={String(displayClusters.filter((cluster) => cluster.readOnly).length)} meta="read-only policy" />
        </div>

        <DataPanel title="集群总览" meta="registered clusters · probe cache">
          {error ? (
            <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-danger">
              集群 API 请求失败：{error.message}
            </div>
          ) : null}
          {isLoading ? (
            <div className="rounded-lg bg-white/45 px-4 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
              <div className="font-semibold text-on-surface">正在读取集群</div>
            </div>
          ) : null}
          {!isLoading && !error && displayClusters.length ? (
            <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              {displayClusters.map((cluster) => (
                <ClusterOverviewCard
                    key={cluster.id}
                    cluster={cluster}
                    probeResult={probeByClusterId.get(cluster.id)?.data}
                    probeError={optionalErrorMessage(probeByClusterId.get(cluster.id)?.error)}
                    isProbing={Boolean(probeByClusterId.get(cluster.id)?.isFetching || manualProbeIds.includes(cluster.id))}
                    isDeleting={deleteCluster.isPending}
                    onProbe={() => runProbe(cluster.id)}
                    onDelete={() => {
                      if (window.confirm(`确认删除集群 ${cluster.name || cluster.id} 的登记元数据？`)) {
                        deleteCluster.mutate(cluster.id);
                      }
                    }}
                  />
              ))}
            </div>
          ) : null}
          {!isLoading && !error && !displayClusters.length ? (
            <div className="rounded-lg bg-white/45 px-4 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
              <div className="font-semibold text-on-surface">集群清单为空</div>
            </div>
          ) : null}
        </DataPanel>
      </div>
    );
  }

  if (isNewAccessView) {
    return (
      <div className="space-y-4">
        <section className="console-panel px-4 py-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs font-semibold text-primary">新集群登记</div>
              <div className="mt-1 text-sm text-muted">凭据维护在集群卡片内处理。</div>
            </div>
            <Link className="quiet-button h-9 justify-center bg-white/70 px-3 text-xs text-primary" to="/k8s">
              返回集群总览
            </Link>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="console-panel px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-on-surface">集群登记</div>
              </div>
              <Plus className="h-4 w-4 text-primary" />
            </div>
            {clusterError ? <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-danger">{clusterError}</div> : null}
            {createCluster.data ? <div className="mt-3 rounded-lg bg-primary-soft px-3 py-2 text-xs font-semibold text-primary">已登记集群：{createCluster.data.name}</div> : null}
            <CredentialInput label="cluster_id" value={clusterId} onChange={(value) => {
              setClusterId(value);
              setCredentialClusterId(value);
            }} />
            <CredentialInput label="name" value={clusterName} onChange={setClusterName} />
            <CredentialInput label="version" value={clusterVersion} onChange={setClusterVersion} />
            <CredentialInput label="region" value={clusterRegion} onChange={setClusterRegion} />
            <label className="mt-3 block text-xs font-semibold text-muted">
              access_mode
              <select className="console-input mt-2 w-full" value={clusterAccessMode} onChange={(event) => setClusterAccessMode(event.target.value)}>
                <option value="direct">direct</option>
                <option value="agent">agent</option>
              </select>
            </label>
            <label className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-outline/70 bg-white/50 px-3 py-2 text-xs font-semibold text-muted">
              <span>
                只读接入
                <span className="mt-0.5 block font-normal text-muted/80">默认只读</span>
              </span>
              <input className="h-4 w-4 accent-primary" type="checkbox" checked={clusterReadOnly} onChange={(event) => setClusterReadOnly(event.target.checked)} />
            </label>
            <label className="mt-3 block text-xs font-semibold text-muted">
              description
              <textarea className="console-input mt-2 min-h-20 w-full text-xs" value={clusterDescription} onChange={(event) => setClusterDescription(event.target.value)} />
            </label>
            <button className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-60" disabled={!clusterId || !clusterName || createCluster.isPending} onClick={() => createCluster.mutate()}>
              <Plus className="h-4 w-4" />
              登记集群
            </button>
          </section>

          <section className="console-panel px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-on-surface">初始凭据录入</div>
                <p className="mt-1 text-xs text-muted">probe passed · Secret version</p>
              </div>
              <KeyRound className="h-4 w-4 text-primary" />
            </div>
            {credentialError ? <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-danger">{credentialError}</div> : null}
            {credentialResult ? <div className="mt-3 rounded-lg bg-primary-soft px-3 py-2 text-xs font-semibold text-primary">操作已落审计：{credentialResult.auditId}</div> : null}
            {credentialResult?.probe ? (
              <div className="mt-3 rounded-lg bg-white/65 px-3 py-2 text-xs font-semibold text-primary shadow-[inset_0_0_0_1px_rgba(13,91,215,0.16)]">
                连接校验通过：server {credentialResult.probe.serverVersion || 'unknown'} · {credentialResult.probe.resourceCount} resources
              </div>
            ) : null}
            <CredentialInput label="cluster_id" value={credentialClusterId} onChange={setCredentialClusterId} />
            <CredentialInput label="name" value={credentialName} onChange={setCredentialName} />
            <label className="mt-3 block text-xs font-semibold text-muted">
              expires_at
              <input className="console-input mt-2 w-full" type="datetime-local" value={credentialExpiresAt} onChange={(event) => setCredentialExpiresAt(event.target.value)} />
            </label>
            <label className="mt-3 block text-xs font-semibold text-muted">
              kubeconfig
              <textarea
                className="console-input mt-2 min-h-44 w-full font-mono text-xs"
                placeholder={'apiVersion: v1\nkind: Config\nclusters: []'}
                value={kubeconfig}
                onChange={(event) => setKubeconfig(event.target.value)}
              />
            </label>
            <p className="mt-2 text-[11px] text-muted">kubeconfig 不在页面回显；保存前执行 probe。</p>
            <button className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-60" disabled={!credentialClusterId || !credentialName || !kubeconfig || createCredential.isPending} onClick={() => createCredential.mutate()}>
              <KeyRound className="h-4 w-4" />
              录入初始凭据
            </button>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DataPanel title="当前集群" meta={`${activeClusterId} · 资源操作上下文`}>
        {activeClusterMissing(activeClusterId, isLoading, managementCluster) ? (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            当前路由中的集群尚未登记或列表仍在同步，请返回集群总览确认。
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-4">
            <ClusterDatum label="Cluster" value={managementCluster?.name || activeClusterId} />
            <ClusterDatum label="Version" value={managementCluster?.version || '-'} />
            <ClusterDatum label="Region" value={managementCluster?.region || '-'} />
            <ClusterDatum label="Mode" value={`${managementCluster?.accessMode || 'direct'}${managementCluster?.readOnly ? ' / read-only' : ''}`} />
          </div>
        )}
      </DataPanel>

      <DataPanel title="连接探测" meta={managementCluster ? `${managementCluster.id} · ${managementCluster.accessMode}` : '选择集群后执行只读 probe'}>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="rounded-lg border border-outline/70 bg-white/55 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-8 items-center gap-2 rounded-lg bg-primary-soft/70 px-3 text-xs font-semibold text-primary">
                <Activity className="h-3.5 w-3.5" />
                {managementProbe?.isFetching ? '探测中' : managementProbeData?.status ?? '等待探测'}
              </span>
              <span className="inline-flex h-8 items-center rounded-lg bg-white/75 px-3 font-mono text-xs font-semibold text-on-surface shadow-[inset_0_0_0_1px_rgba(216,226,239,0.8)]">
                server {managementProbeData?.serverVersion || managementCluster?.version || 'unknown'}
              </span>
              <span className={`inline-flex h-8 items-center gap-2 rounded-lg px-3 text-xs font-semibold ${managementCluster?.readOnly || managementProbeData?.readOnly ? 'bg-amber-50 text-warning' : 'bg-primary-soft text-primary'}`}>
                <ShieldAlert className="h-3.5 w-3.5" />
                {managementCluster?.readOnly || managementProbeData?.readOnly ? '只读接入' : '允许写操作'}
              </span>
            </div>
            <div className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-3">
              <ProbeDatum label="访问模式" value={managementProbeData?.accessMode || managementCluster?.accessMode || '-'} />
              <ProbeDatum label="资源发现" value={managementProbeData ? `${managementProbeData.resourceCount} resources` : '-'} />
              <ProbeDatum label="检查时间" value={managementProbeData?.checkedAt || '-'} />
            </div>
            {managementProbeData?.warnings?.length ? (
              <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-warning">
                {managementProbeData.warnings[0]}
              </div>
            ) : null}
            {managementProbeError ? (
              <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-danger">
                {managementProbeError}
              </div>
            ) : null}
          </div>
          <div className="rounded-lg border border-outline/70 bg-primary-soft/35 p-3">
            <div className="text-xs font-semibold text-on-surface">连接检查</div>
            <div className="mt-1 text-[11px] leading-5 text-muted">API discovery · resource count</div>
            <button
              className="quiet-button mt-3 h-10 w-full bg-primary text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!credentialClusterId || isCredentialProbing}
              onClick={() => runProbe(credentialClusterId)}
            >
              <Activity className="h-4 w-4" />
              {isCredentialProbing ? '探测中' : '执行探测'}
            </button>
          </div>
        </div>
      </DataPanel>

      <div className="grid gap-4">
        <DataPanel title="集群凭据" meta={`/api/v1/k8s/cluster-credentials · ${credentials.length} 条元数据`}>
          {credentialsQuery.error ? (
            <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
              集群凭据读取失败：{errorMessage(credentialsQuery.error)}
            </div>
          ) : null}
          {!credentialClusterId ? (
            <div className="mb-3 rounded-lg bg-white/45 px-3 py-2 text-sm font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
              未选择集群
            </div>
          ) : null}
          {activeCredential ? (
            <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="rounded-lg border border-primary/20 bg-primary-soft/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-primary">当前生效版本</div>
                    <div className="mt-2 truncate text-lg font-semibold text-on-surface">{activeCredential.name || activeCredential.secretId}</div>
                    <div className="mt-1 truncate font-mono text-xs text-muted">v{activeCredential.version || 1} · {shortFingerprint(activeCredential.fingerprint)}</div>
                  </div>
                  <span className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${credentialStatusClass(activeCredential)}`}>
                    {credentialStatusText(activeCredential)}
                  </span>
                </div>
                <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
                  <ClusterDatum label="Cluster" value={activeCredential.clusterId || '-'} />
                  <ClusterDatum label="创建时间" value={credentialTime(activeCredential.createdAt)} />
                  <ClusterDatum label="过期时间" value={credentialTime(activeCredential.expiresAt)} />
                </div>
                {activeCredential.expiresSoon ? (
                  <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-warning">
                    凭据即将过期，请尽快录入新 kubeconfig 并完成轮换探测。
                  </div>
                ) : null}
                {activeCredential.expired ? (
                  <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-danger">
                    凭据已过期，资源读取和导出能力可能不可用。
                  </div>
                ) : null}
              </div>
              <div className="rounded-lg border border-outline/80 bg-white/55 p-4">
                <div className="text-sm font-semibold text-on-surface">最近操作</div>
                <div className="mt-3 space-y-2 text-xs text-muted">
                  <div className="flex items-center justify-between gap-3">
                    <span>审计</span>
                    <span className="truncate font-mono text-on-surface">{credentialResult?.auditId || '-'}</span>
                  </div>
                  {credentialResult?.probe ? (
                    <div className="rounded-lg bg-primary-soft/60 px-3 py-2 font-semibold text-primary">
                      凭据连接探测通过：server {credentialResult.probe.serverVersion || 'unknown'} · {credentialResult.probe.resourceCount} resources
                    </div>
                  ) : (
                    <div className="rounded-lg bg-white/65 px-3 py-2 font-semibold text-muted shadow-[inset_0_0_0_1px_rgba(216,226,239,0.7)]">
                      轮换或回滚成功后显示连接校验结果。
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
          <div className="overflow-auto">
            {credentials.length ? (
              <>
              <div className="mb-2 text-xs font-semibold text-muted">历史版本</div>
              <table className="console-table min-w-[920px] w-full">
                <thead>
                  <tr>
                    <th>版本</th>
                    <th>凭据</th>
                    <th>指纹</th>
                    <th>状态</th>
                    <th>有效期</th>
                    <th>最近更新时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {credentials.map((item) => (
                    <tr key={item.secretId} className="bg-white/35 hover:bg-white/60">
                      <td className="font-mono text-xs">v{item.version || 1}</td>
                      <td>
                        <div className="font-semibold text-primary">{item.name}</div>
                        <div className="max-w-64 truncate text-[11px] text-muted">{item.secretId}</div>
                      </td>
                      <td className="font-mono text-xs">{shortFingerprint(item.fingerprint)}</td>
                      <td>
                        <span className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold ${credentialStatusClass(item)}`}>
                          {credentialStatusText(item)}
                        </span>
                      </td>
                      <td className="font-mono text-xs">{credentialTime(item.expiresAt)}</td>
                      <td className="font-mono text-xs">{credentialTime(item.rotatedAt || item.createdAt)}</td>
                      <td>
                        {isCredentialActive(item) ? (
                          <span className="inline-flex rounded-lg bg-primary-soft px-2 py-1 text-[11px] font-semibold text-primary">当前生效</span>
                        ) : (
                          <button
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/75 px-3 py-1.5 text-xs font-semibold text-primary shadow-[inset_0_0_0_1px_rgba(13,91,215,0.18)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55"
                            disabled={item.expired || rollbackCredential.isPending}
                            title={item.expired ? '过期版本不可回滚' : '将该历史版本重新探测并提升为当前生效版本'}
                            onClick={() => {
                              if (window.confirm(`确认将 ${item.name || item.secretId} v${item.version || 1} 回滚为当前生效版本？`)) {
                                rollbackCredential.mutate(item);
                              }
                            }}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            回滚为当前
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!historicalCredentials.length ? (
                <div className="mt-3 rounded-lg bg-white/50 px-3 py-2 text-xs font-semibold text-muted">
                  暂无可回滚的历史版本。
                </div>
              ) : null}
              </>
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
              <p className="mt-1 text-xs text-muted">Secret Store · metadata only</p>
            </div>
            <KeyRound className="h-4 w-4 text-primary" />
          </div>
          {credentialError ? <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-danger">{credentialError}</div> : null}
          {credentialResult ? <div className="mt-3 rounded-lg bg-primary-soft px-3 py-2 text-xs font-semibold text-primary">操作已落审计：{credentialResult.auditId}</div> : null}
          {credentialResult?.probe ? (
            <div className="mt-3 rounded-lg bg-white/65 px-3 py-2 text-xs font-semibold text-primary shadow-[inset_0_0_0_1px_rgba(13,91,215,0.16)]">
              连接探测通过：server {credentialResult.probe.serverVersion || 'unknown'} · {credentialResult.probe.resourceCount} resources
            </div>
          ) : null}
          <CredentialInput label="cluster_id" value={credentialClusterId} onChange={setCredentialClusterId} />
          <CredentialInput label="name" value={credentialName} onChange={setCredentialName} />
          <label className="mt-3 block text-xs font-semibold text-muted">
            expires_at
            <input className="console-input mt-2 w-full" type="datetime-local" value={credentialExpiresAt} onChange={(event) => setCredentialExpiresAt(event.target.value)} />
          </label>
          <label className="mt-3 block text-xs font-semibold text-muted">
            kubeconfig
            <textarea
              className="console-input mt-2 min-h-40 w-full font-mono text-xs"
              placeholder={'apiVersion: v1\nkind: Config\nclusters: []'}
              value={kubeconfig}
              onChange={(event) => setKubeconfig(event.target.value)}
            />
          </label>
          <p className="mt-2 text-[11px] text-muted">kubeconfig 不在页面回显；轮换创建新的 Secret 版本。</p>
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

function ClusterOverviewCard({
  cluster,
  probeResult,
  probeError,
  isProbing,
  isDeleting,
  onProbe,
  onDelete,
}: {
  cluster: { id: string; name: string; version: string; region: string; accessMode: string; readOnly: boolean };
  probeResult?: K8sClusterProbe;
  probeError?: string;
  isProbing: boolean;
  isDeleting: boolean;
  onProbe: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-lg border border-outline/80 bg-white/55 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.74)] transition hover:border-primary/35 hover:bg-white/75">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link className="truncate text-base font-semibold text-primary hover:underline" to={`/k8s/clusters/${encodeURIComponent(cluster.id)}`}>
            {cluster.name || cluster.id}
          </Link>
          <div className="mt-1 truncate font-mono text-[11px] text-muted">{cluster.id}</div>
        </div>
        <span className={`shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-semibold ${cluster.readOnly ? 'bg-amber-50 text-warning' : 'bg-primary-soft text-primary'}`}>
          {cluster.readOnly ? 'read-only' : 'write-enabled'}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
        <ClusterDatum label="Version" value={probeResult?.serverVersion || cluster.version || '-'} />
        <ClusterDatum label="Region" value={cluster.region || '-'} />
        <ClusterDatum label="Mode" value={cluster.accessMode || 'direct'} />
      </div>
      {probeResult ? (
        <div className="mt-3 rounded-lg bg-primary-soft/45 px-3 py-2 text-xs font-semibold text-primary">
          {probeResult.status || 'checked'} · {probeResult.resourceCount} resources · {compactProbeTime(probeResult.checkedAt)}
        </div>
      ) : probeError ? (
        <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-danger">
          探测失败：{probeError}
        </div>
      ) : (
        <div className="mt-3 rounded-lg bg-white/60 px-3 py-2 text-xs font-semibold text-muted">
          {isProbing ? '正在自动探测' : '等待自动探测'}
        </div>
      )}
      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <Link className="quiet-button h-9 justify-center bg-primary text-xs text-white hover:bg-primary/90" to={`/k8s/clusters/${encodeURIComponent(cluster.id)}`}>
          工作台
        </Link>
        <Link className="quiet-button h-9 justify-center bg-white/70 text-xs text-primary" to={`/k8s/clusters/${encodeURIComponent(cluster.id)}/credentials`}>
          <KeyRound className="h-3.5 w-3.5" />
          进入凭据维护
        </Link>
        <button className="quiet-button h-9 justify-center bg-white/70 text-xs text-primary" disabled={isProbing} onClick={onProbe}>
          <Activity className="h-3.5 w-3.5" />
          {isProbing ? '测试中' : '测试连接'}
        </button>
        <button className="quiet-button h-9 justify-center bg-white/70 text-xs text-danger" disabled={isDeleting} onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
          删除登记
        </button>
      </div>
    </div>
  );
}

function ProbeDatum({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-low/70 px-3 py-2">
      <div className="font-semibold text-muted">{label}</div>
      <div className="mt-1 truncate font-mono text-[11px] text-on-surface">{value}</div>
    </div>
  );
}

function ClusterDatum({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-primary-soft/35 px-2.5 py-2">
      <div className="text-muted">{label}</div>
      <div className="mt-1 truncate font-mono font-semibold text-on-surface">{value}</div>
    </div>
  );
}

function activeClusterMissing(clusterId: string, isLoading: boolean, cluster?: { id: string }) {
  return Boolean(clusterId && !isLoading && !cluster);
}

function compactProbeTime(value?: string) {
  if (!value) return 'checked';
  return value.includes('T') ? value.slice(11, 19) : value;
}

function credentialExpiryISO(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? trimmed : parsed.toISOString();
}

function shortFingerprint(value: string) {
  if (!value) return '-';
  if (value.length <= 24) return value;
  return `${value.slice(0, 14)}...${value.slice(-8)}`;
}

function credentialTime(value: string) {
  if (!value) return '-';
  return value.includes('T') ? value.replace('T', ' ').slice(0, 19) : value;
}

function credentialStatusText(item: K8sClusterCredential) {
  if (item.expired) return '已过期';
  if (isCredentialActive(item)) return item.expiresSoon ? '凭据即将过期' : '当前生效';
  if (item.expiresSoon) return '即将过期';
  return item.status === 'superseded' ? '历史版本' : item.status || 'unknown';
}

function credentialStatusClass(item: K8sClusterCredential) {
  if (item.expired) return 'bg-rose-50 text-danger';
  if (item.expiresSoon) return 'bg-amber-50 text-warning';
  if (isCredentialActive(item)) return 'bg-primary-soft text-primary';
  return 'bg-white/70 text-muted shadow-[inset_0_0_0_1px_rgba(216,226,239,0.8)]';
}

function isCredentialActive(item: K8sClusterCredential) {
  return item.active || item.status === 'active';
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

function optionalErrorMessage(error: unknown) {
  return error ? errorMessage(error) : '';
}
