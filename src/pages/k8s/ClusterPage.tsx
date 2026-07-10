import { type ReactNode, useEffect, useState } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Activity, Database, KeyRound, Network, Plus, RotateCcw, ShieldAlert, ShieldCheck, Trash2, X } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { k8sApi, type K8sClusterCredential, type K8sClusterProbe, type K8sWriteResult } from './api';
import { useK8sOpsContext } from './context';

const clusterProbeStaleTimeMs = 2 * 60 * 1000;
const clusterProbeGcTimeMs = 10 * 60 * 1000;

function clusterProbeQueryKey(clusterId: string) {
  return ['k8s-cluster-probe', clusterId] as const;
}

interface ClusterAccessDraft {
  id: string;
  name: string;
  version: string;
  region: string;
  description: string;
  accessMode: string;
  readOnly: boolean;
}

interface CredentialDraft {
  clusterId: string;
  name: string;
  kubeconfig: string;
  expiresAt: string;
}

export function K8sClusterPage() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const { activeClusterId, activeCluster, clusters: data, isLoadingClusters: isLoading, clusterError: error } = useK8sOpsContext();
  const isCredentialView = Boolean(activeClusterId && location.pathname.endsWith('/credentials'));
  const [accessDrawerOpen, setAccessDrawerOpen] = useState(false);
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
    mutationFn: (input?: ClusterAccessDraft) => k8sApi.createCluster({
      id: input?.id ?? clusterId,
      name: input?.name ?? clusterName,
      version: input?.version ?? clusterVersion,
      region: input?.region ?? clusterRegion,
      description: input?.description ?? clusterDescription,
      accessMode: input?.accessMode ?? clusterAccessMode,
      readOnly: input?.readOnly ?? clusterReadOnly,
    }),
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
    mutationFn: (input?: CredentialDraft) => k8sApi.createClusterCredential({
      clusterId: input?.clusterId ?? credentialClusterId,
      name: input?.name ?? credentialName,
      kubeconfig: input?.kubeconfig ?? kubeconfig,
      expiresAt: credentialExpiryISO(input?.expiresAt ?? credentialExpiresAt),
    }),
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
  const clusterWriteError = createCluster.error?.message || deleteCluster.error?.message || '';
  const accessMissing = clusterAccessMissingFields(clusterId, clusterName, kubeconfig);
  const accessSaving = createCluster.isPending || createCredential.isPending;

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

  function openClusterAccessDrawer() {
    createCluster.reset();
    createCredential.reset();
    setClusterId('');
    setClusterName('');
    setClusterVersion('');
    setClusterRegion('');
    setClusterDescription('');
    setClusterAccessMode('direct');
    setClusterReadOnly(true);
    setCredentialExpiresAt('');
    setKubeconfig('');
    setAccessDrawerOpen(true);
  }

  function closeClusterAccessDrawer() {
    setAccessDrawerOpen(false);
  }

  async function submitClusterAccess() {
    const draft = {
      id: clusterId.trim(),
      name: clusterName.trim(),
      version: clusterVersion.trim(),
      region: clusterRegion.trim(),
      description: clusterDescription.trim(),
      accessMode: clusterAccessMode,
      readOnly: clusterReadOnly,
    };
    const credentialDraft = {
      clusterId: draft.id,
      name: draft.name || draft.id,
      kubeconfig: kubeconfig.trim(),
      expiresAt: credentialExpiresAt,
    };
    if (clusterAccessMissingFields(draft.id, draft.name, credentialDraft.kubeconfig).length > 0) return;
    try {
      const cluster = await createCluster.mutateAsync(draft);
      const targetClusterId = cluster.id || draft.id;
      const targetCredentialName = cluster.name || credentialDraft.name;
      setCredentialClusterId(targetClusterId);
      setCredentialName(targetCredentialName);
      await createCredential.mutateAsync({
        ...credentialDraft,
        clusterId: targetClusterId,
        name: targetCredentialName,
      });
      setAccessDrawerOpen(false);
    } catch {
      // mutation 错误由抽屉内的就地提示展示
    }
  }

  useEffect(() => {
    if (activeClusterId) {
      if (accessDrawerOpen) {
        setAccessDrawerOpen(false);
      }
      if (credentialClusterId !== activeClusterId) {
        setCredentialClusterId(activeClusterId);
      }
      return;
    }
    if (accessDrawerOpen) {
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
  }, [accessDrawerOpen, activeClusterId, clusterId, credentialClusterId, displayClusters]);

  if (!activeClusterId) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <ClusterMetric icon={Network} label="连接集群" value={String(displayClusters.length)} meta="已登记" />
          <ClusterMetric icon={Database} label="区域" value={primaryRegion(displayClusters)} meta="来自集群登记" />
          <ClusterMetric icon={ShieldCheck} label="只读保护" value={String(displayClusters.filter((cluster) => cluster.readOnly).length)} meta="read-only policy" />
        </div>

        <DataPanel
          title="集群总览"
          meta="registered clusters · probe cache"
          action={(
            <button className="console-button console-button-primary" onClick={openClusterAccessDrawer}>
              <Plus className="h-3.5 w-3.5" />
              接入集群
            </button>
          )}
        >
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
              <button className="console-button console-button-primary mt-3" onClick={openClusterAccessDrawer}>
                <Plus className="h-3.5 w-3.5" />
                接入集群
              </button>
            </div>
          ) : null}
        </DataPanel>

        {accessDrawerOpen ? createPortal((
          <ClusterAccessDrawer
            clusterId={clusterId}
            clusterName={clusterName}
            clusterVersion={clusterVersion}
            clusterRegion={clusterRegion}
            clusterDescription={clusterDescription}
            clusterAccessMode={clusterAccessMode}
            clusterReadOnly={clusterReadOnly}
            credentialExpiresAt={credentialExpiresAt}
            kubeconfig={kubeconfig}
            missing={accessMissing}
            saving={accessSaving}
            clusterError={clusterWriteError}
            credentialError={credentialError}
            credentialResult={credentialResult}
            onClusterIdChange={(value) => {
              setClusterId(value);
              setCredentialClusterId(value);
            }}
            onClusterNameChange={setClusterName}
            onClusterVersionChange={setClusterVersion}
            onClusterRegionChange={setClusterRegion}
            onClusterDescriptionChange={setClusterDescription}
            onClusterAccessModeChange={setClusterAccessMode}
            onClusterReadOnlyChange={setClusterReadOnly}
            onCredentialExpiresAtChange={setCredentialExpiresAt}
            onKubeconfigChange={setKubeconfig}
            onClose={closeClusterAccessDrawer}
            onSubmit={submitClusterAccess}
          />
        ), document.body) : null}
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
                    <div className="mt-2 truncate text-lg font-semibold text-on-surface">{activeCredential.name || '平台托管凭据'}</div>
                    <div className="mt-1 truncate text-xs text-muted">v{activeCredential.version || 1} · Secret Store 托管</div>
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
              <table className="console-table min-w-[820px] w-full">
                <thead>
                  <tr>
                    <th>版本</th>
                    <th>凭据</th>
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
                        <div className="max-w-64 truncate text-[11px] text-muted">Secret Store 托管</div>
                      </td>
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
                              if (window.confirm(`确认将 ${item.name || '平台托管凭据'} v${item.version || 1} 回滚为当前生效版本？`)) {
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
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-60" disabled={!credentialClusterId || !credentialName || !kubeconfig || createCredential.isPending} onClick={() => createCredential.mutate(undefined)}>
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

function ClusterAccessDrawer({
  clusterId,
  clusterName,
  clusterVersion,
  clusterRegion,
  clusterDescription,
  clusterAccessMode,
  clusterReadOnly,
  credentialExpiresAt,
  kubeconfig,
  missing,
  saving,
  clusterError,
  credentialError,
  credentialResult,
  onClusterIdChange,
  onClusterNameChange,
  onClusterVersionChange,
  onClusterRegionChange,
  onClusterDescriptionChange,
  onClusterAccessModeChange,
  onClusterReadOnlyChange,
  onCredentialExpiresAtChange,
  onKubeconfigChange,
  onClose,
  onSubmit,
}: {
  clusterId: string;
  clusterName: string;
  clusterVersion: string;
  clusterRegion: string;
  clusterDescription: string;
  clusterAccessMode: string;
  clusterReadOnly: boolean;
  credentialExpiresAt: string;
  kubeconfig: string;
  missing: string[];
  saving: boolean;
  clusterError: string;
  credentialError: string;
  credentialResult?: K8sWriteResult<K8sClusterCredential>;
  onClusterIdChange: (value: string) => void;
  onClusterNameChange: (value: string) => void;
  onClusterVersionChange: (value: string) => void;
  onClusterRegionChange: (value: string) => void;
  onClusterDescriptionChange: (value: string) => void;
  onClusterAccessModeChange: (value: string) => void;
  onClusterReadOnlyChange: (value: boolean) => void;
  onCredentialExpiresAtChange: (value: string) => void;
  onKubeconfigChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const disabled = missing.length > 0 || saving;
  const missingLabel = missing.join('、');

  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-slate-900/28">
      <button type="button" className="absolute inset-0 cursor-default border-0 bg-transparent" aria-label="关闭集群接入遮罩" onClick={onClose} />
      <aside className="k8s-cluster-access-drawer console-drawer-panel relative flex h-full w-full max-w-[760px] flex-col border-l border-outline bg-white shadow-[0_20px_60px_rgba(24,52,96,0.24)]" role="dialog" aria-modal="true" aria-labelledby="cluster-access-title">
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-outline bg-surface-lowest px-4 py-3">
            <div className="min-w-0">
              <div id="cluster-access-title" className="truncate text-sm font-semibold text-on-surface">接入 K8s 集群</div>
              <div className="mt-1 truncate font-mono text-[11px] text-muted">cluster metadata / kubeconfig / probe audit</div>
            </div>
            <button type="button" className="console-icon-button border-outline bg-white" onClick={onClose} aria-label="关闭集群接入" title="关闭">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-auto bg-surface px-4 py-4">
            <section className="rounded-md border border-outline bg-surface-lowest px-3 py-3">
              <div className="grid gap-2 text-xs text-muted sm:grid-cols-3">
                <AccessFact label="目标集群" value={clusterId || '-'} />
                <AccessFact label="访问模式" value={clusterAccessMode} />
                <AccessFact label="接入策略" value={clusterReadOnly ? '只读接入' : '允许写操作'} />
              </div>
              {credentialResult ? <InlineNotice tone="success" message={`操作已落审计：${credentialResult.auditId}`} /> : null}
              {credentialResult?.probe ? (
                <InlineNotice tone="success" message={`连接校验通过：server ${credentialResult.probe.serverVersion || 'unknown'} · ${credentialResult.probe.resourceCount} resources`} />
              ) : null}
              {clusterError ? <InlineNotice tone="danger" message={clusterError} /> : null}
              {credentialError ? <InlineNotice tone="danger" message={credentialError} /> : null}
            </section>

            <ClusterAccessFormSection title="基础信息" meta="登记集群生产元数据">
              <div className="grid gap-3 md:grid-cols-2">
                <ClusterAccessField label="cluster_id">
                  <input className="console-input w-full font-mono" value={clusterId} onChange={(event) => onClusterIdChange(event.target.value)} placeholder="prod-cn" autoFocus />
                </ClusterAccessField>
                <ClusterAccessField label="name">
                  <input className="console-input w-full" value={clusterName} onChange={(event) => onClusterNameChange(event.target.value)} placeholder="生产集群" />
                </ClusterAccessField>
                <ClusterAccessField label="version">
                  <input className="console-input w-full font-mono" value={clusterVersion} onChange={(event) => onClusterVersionChange(event.target.value)} placeholder="v1.29.3" />
                </ClusterAccessField>
                <ClusterAccessField label="region">
                  <input className="console-input w-full font-mono" value={clusterRegion} onChange={(event) => onClusterRegionChange(event.target.value)} placeholder="cn-bj2" />
                </ClusterAccessField>
                <ClusterAccessField label="access_mode">
                  <select className="console-input w-full" value={clusterAccessMode} onChange={(event) => onClusterAccessModeChange(event.target.value)}>
                    <option value="direct">direct</option>
                    <option value="agent">agent</option>
                  </select>
                </ClusterAccessField>
                <label className="flex min-h-[58px] items-center justify-between gap-3 rounded-md border border-outline bg-white px-3 py-2 text-xs font-semibold text-muted">
                  <span>
                    只读接入
                    <span className="mt-0.5 block font-normal text-muted">默认不允许写操作</span>
                  </span>
                  <input className="h-4 w-4 accent-primary" type="checkbox" checked={clusterReadOnly} onChange={(event) => onClusterReadOnlyChange(event.target.checked)} />
                </label>
              </div>
              <ClusterAccessField label="description" className="mt-3">
                <textarea className="console-input min-h-20 w-full text-xs" value={clusterDescription} onChange={(event) => onClusterDescriptionChange(event.target.value)} placeholder="记录集群用途、负责人或网络边界" />
              </ClusterAccessField>
            </ClusterAccessFormSection>

            <ClusterAccessFormSection title="连接凭据" meta="kubeconfig 只用于写入 Secret，不在页面回显">
              <div className="grid gap-3">
                <ClusterAccessField label="expires_at">
                  <input className="console-input w-full" type="datetime-local" value={credentialExpiresAt} onChange={(event) => onCredentialExpiresAtChange(event.target.value)} />
                </ClusterAccessField>
                <ClusterAccessField label="kubeconfig">
                  <textarea
                    className="console-input min-h-52 w-full font-mono text-xs"
                    placeholder={'apiVersion: v1\nkind: Config\nclusters: []'}
                    value={kubeconfig}
                    onChange={(event) => onKubeconfigChange(event.target.value)}
                  />
                </ClusterAccessField>
              </div>
            </ClusterAccessFormSection>
          </div>

          <div className="console-action-bar shrink-0">
            <div className="min-w-0 text-xs text-muted">
              {missing.length > 0 ? `保存前还需：${missingLabel}` : '提交后将登记集群、写入初始 kubeconfig 并执行连接校验。'}
            </div>
            <div className="flex gap-2">
              <button type="button" className="console-button" onClick={onClose}>取消</button>
              <button className="console-button console-button-primary" disabled={disabled} title={missing.length > 0 ? `还需：${missingLabel}` : '保存并接入集群'}>
                {saving ? <Activity className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                保存并接入
              </button>
            </div>
          </div>
        </form>
      </aside>
    </div>
  );
}

function ClusterAccessFormSection({ title, meta, children }: { title: string; meta: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-outline bg-surface-lowest px-3 py-3">
      <div className="mb-3">
        <div className="text-sm font-semibold text-on-surface">{title}</div>
        <div className="mt-1 text-[11px] text-muted">{meta}</div>
      </div>
      {children}
    </section>
  );
}

function ClusterAccessField({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={`block text-xs font-semibold text-muted ${className}`}>
      <span className="mb-2 block">{label}</span>
      {children}
    </label>
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

function InlineNotice({ tone, message }: { tone: 'danger' | 'success' | 'warning'; message: string }) {
  const toneClass = tone === 'danger'
    ? 'border-danger/20 bg-rose-50 text-danger'
    : tone === 'warning'
      ? 'border-warning/20 bg-amber-50 text-warning'
      : 'border-primary/20 bg-primary-soft text-primary';
  return (
    <div className={`mt-3 rounded-md border px-3 py-2 text-xs font-semibold ${toneClass}`}>
      {message}
    </div>
  );
}

function AccessFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-outline pb-2 last:border-b-0 last:pb-0">
      <span>{label}</span>
      <span className="max-w-48 truncate font-mono font-semibold text-on-surface">{value}</span>
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

function clusterAccessMissingFields(clusterId: string, clusterName: string, kubeconfig: string) {
  const missing: string[] = [];
  if (!clusterId.trim()) missing.push('cluster_id');
  if (!clusterName.trim()) missing.push('name');
  if (!kubeconfig.trim()) missing.push('kubeconfig');
  return missing;
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

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : '请检查 NovaAPM 后端连接、平台 RBAC 与 Secret 服务状态。';
}

function optionalErrorMessage(error: unknown) {
  return error ? errorMessage(error) : '';
}
