import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { EmptyState } from '../../components/EmptyState';
import { k8sApi, type K8sCluster } from '../k8s/api';
import {
  ClusterCredentialDrawer,
  ClusterRegistrationDrawer,
  emptyClusterRegistrationDraft,
  type ClusterRegistrationDraft,
} from './PlatformK8sClusterDrawers';

export function PlatformK8sClustersPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [credentialClusterId, setCredentialClusterId] = useState('');
  const [registrationDraft, setRegistrationDraft] = useState<ClusterRegistrationDraft>(emptyClusterRegistrationDraft);
  const [credential, setCredential] = useState('');

  const clustersQuery = useQuery({
    queryKey: ['platform-k8s-clusters'],
    queryFn: () => k8sApi.listClustersForAdministration(),
    retry: false,
  });
  const credentialsQuery = useQuery({
    queryKey: ['platform-k8s-credentials'],
    queryFn: () => k8sApi.listClusterCredentials(),
    retry: false,
  });
  const clusters = clustersQuery.data ?? [];
  const credentials = credentialsQuery.data ?? [];
  const selected = clusters.find((item) => item.id === credentialClusterId) ?? null;
  const selectedCredentials = selected ? credentials.filter((item) => item.clusterId === selected.id) : [];
  const visibleClusters = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return clusters;
    return clusters.filter((cluster) => (
      cluster.id.toLowerCase().includes(keyword)
      || cluster.name.toLowerCase().includes(keyword)
      || cluster.region.toLowerCase().includes(keyword)
    ));
  }, [clusters, query]);
  const registeredClusterIds = new Set(clusters.map((cluster) => cluster.id));
  const orphanCredentialClusterIds = Array.from(new Set(
    credentials
      .map((item) => item.clusterId)
      .filter((clusterId) => clusterId && !registeredClusterIds.has(clusterId)),
  )).sort();

  const register = useMutation({
    mutationFn: () => k8sApi.registerCluster({
      id: registrationDraft.id.trim(),
      name: registrationDraft.name.trim(),
      version: '',
      region: registrationDraft.region.trim(),
      description: registrationDraft.description.trim(),
      accessMode: 'direct',
      readOnly: true,
      kubeconfig: registrationDraft.kubeconfig.trim(),
    }),
    onSuccess: async (result) => {
      setRegistrationDraft(emptyClusterRegistrationDraft);
      setRegistrationOpen(false);
      setCredentialClusterId(result.cluster.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['platform-k8s-clusters'] }),
        queryClient.invalidateQueries({ queryKey: ['platform-k8s-credentials'] }),
      ]);
    },
  });
  const probe = useMutation({
    mutationFn: (cluster: K8sCluster) => k8sApi.probeCluster(cluster.id),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['platform-k8s-clusters'] });
    },
  });
  const replaceCredential = useMutation({
    mutationFn: () => k8sApi.createClusterCredential({
      clusterId: selected!.id,
      name: selected!.name || selected!.id,
      kubeconfig: credential.trim(),
    }),
    onSuccess: async () => {
      setCredential('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['platform-k8s-clusters'] }),
        queryClient.invalidateQueries({ queryKey: ['platform-k8s-credentials'] }),
      ]);
    },
  });
  const deleteCredentials = useMutation({
    mutationFn: (clusterId: string) => k8sApi.deleteClusterCredentials(clusterId),
    onSuccess: () => setCredential(''),
    onSettled: async () => {
      await invalidateClusterAccess(queryClient);
    },
  });
  const removeCluster = useMutation({
    mutationFn: (cluster: K8sCluster) => k8sApi.deleteCluster(cluster.id),
    onSuccess: () => {
      setCredentialClusterId('');
      setCredential('');
    },
    onSettled: async () => {
      await invalidateClusterAccess(queryClient);
    },
  });

  function confirmCredentialDeletion(cluster: K8sCluster) {
    const confirmation = window.prompt(
      `此操作会删除集群管理凭据和用户执行凭据，撤销命名空间权限、用户组授权和紧急访问，并清理 NovaAPM 管理的集群权限对象。\n请输入集群 ID “${cluster.id}” 确认：`,
    );
    if (confirmation?.trim() === cluster.id) deleteCredentials.mutate(cluster.id);
  }

  function confirmClusterRetirement(cluster: K8sCluster) {
    const confirmation = window.prompt(
      `退役集群会删除集群目录、集群管理凭据和用户执行凭据，撤销命名空间权限、用户组授权和紧急访问，并清理 NovaAPM 管理的集群权限对象。\n请输入集群 ID “${cluster.id}” 确认：`,
    );
    if (confirmation?.trim() === cluster.id) removeCluster.mutate(cluster);
  }

  const operationError = probe.error || removeCluster.error || deleteCredentials.error || credentialsQuery.error;

  return (
    <div className="space-y-4">
      <DataPanel
        title="K8S 集群接入"
        help="这里维护集群目录和控制面凭据。工作负载访问仍必须通过用户组绑定的命名空间权限分配。"
        action={(
          <button type="button" className="console-button console-button-primary" onClick={() => setRegistrationOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            登记集群
          </button>
        )}
      >
        <div className="console-list-toolbar mb-3">
          <label className="relative min-w-0 flex-1 md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              className="console-input w-full pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索集群名称、ID 或区域"
              aria-label="搜索集群"
            />
          </label>
          <button
            type="button"
            className="console-icon-button"
            title="刷新集群与凭据"
            aria-label="刷新集群与凭据"
            onClick={() => {
              clustersQuery.refetch();
              credentialsQuery.refetch();
            }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${clustersQuery.isFetching || credentialsQuery.isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {operationError ? <OperationError error={operationError} /> : null}
        {clustersQuery.error ? (
          <EmptyState title="集群目录加载失败" action={<button type="button" className="console-button" onClick={() => clustersQuery.refetch()}>重试</button>} />
        ) : clustersQuery.isLoading ? (
          <div className="console-skeleton h-48" />
        ) : clusters.length === 0 ? (
          <EmptyState title="尚未登记 K8S 集群" />
        ) : visibleClusters.length === 0 ? (
          <EmptyState title="没有匹配的集群" />
        ) : (
          <div className="overflow-x-auto rounded-md border border-outline">
            <table className="console-table min-w-[900px] w-full">
              <thead>
                <tr>
                  <th>集群</th>
                  <th>版本与区域</th>
                  <th>连接状态</th>
                  <th>控制面凭据</th>
                  <th className="w-52">操作</th>
                </tr>
              </thead>
              <tbody>
                {visibleClusters.map((cluster) => {
                  const probeState = cluster.lastProbe?.status ?? 'unknown';
                  const credentialCount = credentials.filter((item) => item.clusterId === cluster.id).length;
                  return (
                    <tr key={cluster.id}>
                      <td>
                        <div className="font-semibold text-on-surface">{cluster.name || cluster.id}</div>
                        <div className="mt-0.5 font-mono text-[11px] text-muted">{cluster.id}</div>
                      </td>
                      <td>
                        <div className="text-sm text-on-surface">{cluster.lastProbe?.serverVersion || cluster.version || '尚未探测'}</div>
                        <div className="mt-0.5 text-xs text-muted">{cluster.region || '未设置区域'}</div>
                      </td>
                      <td>
                        <ProbeStatus status={probeState} checkedAt={cluster.lastProbe?.checkedAt ?? ''} />
                      </td>
                      <td>
                        <div className="text-sm text-on-surface">
                          {credentialsQuery.isLoading
                            ? '加载中…'
                            : credentialsQuery.error
                              ? '元数据加载失败'
                              : credentialCount > 0
                                ? `${credentialCount} 个加密版本`
                                : '未配置'}
                        </div>
                        <div className="mt-0.5 text-xs text-muted">管理与用户执行凭据分离</div>
                      </td>
                      <td>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            className="console-table-action"
                            disabled={probe.isPending}
                            onClick={() => probe.mutate(cluster)}
                          >
                            <RefreshCw className={`h-3.5 w-3.5 ${probe.isPending && probe.variables?.id === cluster.id ? 'animate-spin' : ''}`} />
                            探测
                          </button>
                          <button
                            type="button"
                            className="console-table-action"
                            aria-label={`打开凭据管理 ${cluster.name || cluster.id}`}
                            onClick={() => {
                              setCredential('');
                              deleteCredentials.reset();
                              setCredentialClusterId(cluster.id);
                            }}
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            凭据
                          </button>
                          <button
                            type="button"
                            className="console-table-action console-table-action-danger"
                            aria-label={`退役集群 ${cluster.name || cluster.id}`}
                            disabled={removeCluster.isPending}
                            onClick={() => confirmClusterRetirement(cluster)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            退役
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DataPanel>

      {orphanCredentialClusterIds.length > 0 ? (
        <DataPanel title="孤立控制面凭据" help="集群目录已经不存在，但仍残留凭据或授权数据。清理会撤销对应权限并删除全部凭据版本。">
          <div className="grid gap-2">
            {orphanCredentialClusterIds.map((clusterId) => (
              <div key={clusterId} className="flex flex-col gap-2 rounded-md border border-warning/40 bg-amber-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <code className="text-xs">{clusterId}</code>
                <button
                  type="button"
                  className="console-button text-danger"
                  disabled={deleteCredentials.isPending}
                  onClick={() => {
                    const confirmation = window.prompt(`清理会撤销集群 “${clusterId}” 的全部 K8S 权限并删除凭据。\n请输入集群 ID 确认：`);
                    if (confirmation?.trim() === clusterId) deleteCredentials.mutate(clusterId);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  清理孤立凭据与权限
                </button>
              </div>
            ))}
          </div>
        </DataPanel>
      ) : null}

      <ClusterRegistrationDrawer
        open={registrationOpen}
        draft={registrationDraft}
        pending={register.isPending}
        error={register.error}
        onChange={setRegistrationDraft}
        onClose={() => {
          setRegistrationOpen(false);
          register.reset();
        }}
        onSubmit={() => register.mutate()}
      />
      <ClusterCredentialDrawer
        cluster={selected}
        credentials={selectedCredentials}
        loading={credentialsQuery.isLoading}
        kubeconfig={credential}
        pending={replaceCredential.isPending}
        deleting={deleteCredentials.isPending}
        error={replaceCredential.error || deleteCredentials.error || credentialsQuery.error}
        success={replaceCredential.isSuccess}
        probeStatePersisted={replaceCredential.data?.probeStatePersisted}
        deletionSuccess={deleteCredentials.isSuccess}
        clusterStatePersisted={deleteCredentials.data?.clusterStatePersisted}
        onKubeconfigChange={(value) => {
          setCredential(value);
          replaceCredential.reset();
        }}
        onClose={() => {
          setCredentialClusterId('');
          setCredential('');
          replaceCredential.reset();
          deleteCredentials.reset();
        }}
        onReplace={() => replaceCredential.mutate()}
        onDelete={() => {
          if (selected) confirmCredentialDeletion(selected);
        }}
      />
    </div>
  );
}

function ProbeStatus({ status, checkedAt }: { status: string; checkedAt: string }) {
  const presentation = probePresentation(status);
  return (
    <div>
      <div className={`inline-flex items-center gap-1.5 text-sm font-semibold ${presentation.className}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {presentation.label}
      </div>
      <div className="mt-0.5 text-xs text-muted">{checkedAt ? `最近探测 ${formatTime(checkedAt)}` : '尚未执行探测'}</div>
    </div>
  );
}

function probePresentation(status: string) {
  if (status === 'connected') return { label: '连接正常', className: 'text-success' };
  if (status === 'degraded') return { label: '部分 API 异常', className: 'text-warning' };
  if (status === 'unreachable') return { label: '连接失败', className: 'text-danger' };
  return { label: '待探测', className: 'text-muted' };
}

function OperationError({ error }: { error: Error }) {
  return <div className="mb-3 rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm font-semibold text-danger">{error.message}</div>;
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN');
}

async function invalidateClusterAccess(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['platform-k8s-clusters'] }),
    queryClient.invalidateQueries({ queryKey: ['platform-k8s-credentials'] }),
    queryClient.invalidateQueries({ queryKey: ['fixed-access'] }),
    queryClient.invalidateQueries({ queryKey: ['platform-me'] }),
    queryClient.invalidateQueries({ queryKey: ['k8s-clusters'] }),
  ]);
}
