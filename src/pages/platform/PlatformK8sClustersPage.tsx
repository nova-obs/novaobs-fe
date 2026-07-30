import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Plus, RefreshCw, ServerCog, Trash2 } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { EmptyState } from '../../components/EmptyState';
import { k8sApi, type K8sCluster } from '../k8s/api';

interface ClusterDraft {
  id: string;
  name: string;
  version: string;
  region: string;
  description: string;
  kubeconfig: string;
}

const emptyDraft: ClusterDraft = {
  id: '',
  name: '',
  version: '',
  region: '',
  description: '',
  kubeconfig: '',
};

export function PlatformK8sClustersPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState('');
  const [showRegistration, setShowRegistration] = useState(false);
  const [draft, setDraft] = useState<ClusterDraft>(emptyDraft);
  const [credential, setCredential] = useState('');
  const clustersQuery = useQuery({
    queryKey: ['platform-k8s-clusters'],
    queryFn: () => k8sApi.listClustersForAdministration(),
    retry: false,
  });
  const clusters = clustersQuery.data ?? [];
  const selected = clusters.find((item) => item.id === selectedId) ?? clusters[0] ?? null;

  useEffect(() => {
    if (!selectedId && clusters[0]) setSelectedId(clusters[0].id);
  }, [clusters, selectedId]);

  const credentialsQuery = useQuery({
    queryKey: ['platform-k8s-credentials', selected?.id],
    queryFn: () => k8sApi.listClusterCredentials(selected?.id ?? ''),
    enabled: Boolean(selected?.id),
    retry: false,
  });

  const register = useMutation({
    mutationFn: async () => {
      const result = await k8sApi.registerCluster({
        id: draft.id.trim(),
        name: draft.name.trim(),
        version: draft.version.trim(),
        region: draft.region.trim(),
        description: draft.description.trim(),
        accessMode: 'direct',
        readOnly: true,
        kubeconfig: draft.kubeconfig.trim(),
      });
      return result.cluster;
    },
    onSuccess: async (cluster) => {
      setDraft(emptyDraft);
      setSelectedId(cluster.id);
      setShowRegistration(false);
      await queryClient.invalidateQueries({ queryKey: ['platform-k8s-clusters'] });
      await queryClient.invalidateQueries({ queryKey: ['platform-k8s-credentials', cluster.id] });
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
      await queryClient.invalidateQueries({ queryKey: ['platform-k8s-credentials', selected?.id] });
    },
  });

  const removeCluster = useMutation({
    mutationFn: (cluster: K8sCluster) => k8sApi.deleteCluster(cluster.id),
    onSuccess: async () => {
      setSelectedId('');
      await queryClient.invalidateQueries({ queryKey: ['platform-k8s-clusters'] });
    },
  });

  const registrationDisabled = !draft.id.trim() || !draft.name.trim() || !draft.kubeconfig.trim() || register.isPending;

  return (
    <div className="console-workbench min-h-0">
      <section className="min-w-0 space-y-3">
        <DataPanel
          title="K8S 集群接入"
          help="平台管理员只登记集群和维护 Controller/Broker 凭据；工作负载访问仍必须通过用户组绑定的 Access Profile。"
          action={(
            <button type="button" className="console-button console-button-primary" onClick={() => setShowRegistration((value) => !value)}>
              <Plus className="h-3.5 w-3.5" />
              登记集群
            </button>
          )}
        >
          {showRegistration ? (
            <div className="mb-4 rounded-md border border-outline bg-surface/60 p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="集群 ID" value={draft.id} onChange={(value) => setDraft((current) => ({ ...current, id: value }))} />
                <Field label="显示名称" value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} />
                <Field label="版本（可选）" value={draft.version} onChange={(value) => setDraft((current) => ({ ...current, version: value }))} />
                <Field label="区域（可选）" value={draft.region} onChange={(value) => setDraft((current) => ({ ...current, region: value }))} />
              </div>
              <label className="mt-3 block text-xs font-semibold text-on-surface">
                描述（可选）
                <input className="console-input mt-1 w-full" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
              </label>
              <label className="mt-3 block text-xs font-semibold text-on-surface">
                Controller Kubeconfig
                <textarea
                  className="console-input mt-1 min-h-32 w-full font-mono text-[11px]"
                  value={draft.kubeconfig}
                  onChange={(event) => setDraft((current) => ({ ...current, kubeconfig: event.target.value }))}
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <p className="mt-2 text-xs text-muted">只用于加密保存 Controller 凭据并初始化固定 RBAC；平台不会返回明文。</p>
              {register.error ? <div className="mt-2 text-sm font-semibold text-danger">{register.error.message}</div> : null}
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" className="console-button" onClick={() => setShowRegistration(false)}>取消</button>
                <button type="button" className="console-button console-button-primary" disabled={registrationDisabled} onClick={() => register.mutate()}>
                  {register.isPending ? '登记中…' : '确认登记'}
                </button>
              </div>
            </div>
          ) : null}

          {clustersQuery.error ? (
            <EmptyState title="集群目录加载失败" action={<button type="button" className="console-button" onClick={() => clustersQuery.refetch()}>重试</button>} />
          ) : clustersQuery.isLoading ? (
            <div className="console-skeleton h-48" />
          ) : clusters.length === 0 ? (
            <EmptyState title="尚未登记 K8S 集群" />
          ) : (
            <div className="overflow-auto rounded-md border border-outline">
              <table className="console-table min-w-[720px]">
                <thead><tr><th>集群</th><th>版本 / 区域</th><th>连接模式</th><th>状态</th><th className="w-24">操作</th></tr></thead>
                <tbody>
                  {clusters.map((cluster) => (
                    <tr key={cluster.id} className={selected?.id === cluster.id ? 'bg-primary/5' : ''}>
                      <td>
                        <button type="button" className="text-left" onClick={() => setSelectedId(cluster.id)}>
                          <div className="font-semibold text-on-surface">{cluster.name || cluster.id}</div>
                          <div className="font-mono text-[11px] text-muted">{cluster.id}</div>
                        </button>
                      </td>
                      <td>{cluster.version || '待探测'} / {cluster.region || '未设置'}</td>
                      <td>{cluster.accessMode || 'direct'}</td>
                      <td>{cluster.status || 'unknown'}</td>
                      <td>
                        <button
                          type="button"
                          className="console-icon-button text-danger"
                          title="删除集群登记"
                          aria-label={`删除集群 ${cluster.name || cluster.id}`}
                          disabled={removeCluster.isPending}
                          onClick={() => {
                            if (window.confirm(`确认删除集群 ${cluster.name || cluster.id} 的 NovaAPM 登记信息？`)) removeCluster.mutate(cluster);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DataPanel>
      </section>

      <aside className="min-w-0 space-y-3">
        <DataPanel
          title="控制面凭据"
          action={(
            <button type="button" className="console-icon-button" title="刷新凭据元数据" disabled={!selected || credentialsQuery.isFetching} onClick={() => credentialsQuery.refetch()}>
              <RefreshCw className={`h-3.5 w-3.5 ${credentialsQuery.isFetching ? 'animate-spin' : ''}`} />
            </button>
          )}
        >
          {!selected ? (
            <EmptyState title="请选择集群" />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-md bg-surface px-3 py-2 text-sm">
                <ServerCog className="h-4 w-4 text-primary" />
                <span className="font-semibold">{selected.name || selected.id}</span>
              </div>
              <div className="space-y-2">
                {(credentialsQuery.data ?? []).map((item) => (
                  <div key={item.secretId} className="rounded-md border border-outline px-3 py-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-on-surface">{item.name}</span>
                      <span className="text-muted">v{item.version}</span>
                    </div>
                    <div className="mt-1 break-all font-mono text-[10px] text-muted">{item.fingerprint || '无指纹'}</div>
                  </div>
                ))}
                {!credentialsQuery.isLoading && !(credentialsQuery.data ?? []).length ? <EmptyState title="暂无控制面凭据" /> : null}
              </div>
              <label className="block text-xs font-semibold text-on-surface">
                替换 Controller Kubeconfig
                <textarea
                  className="console-input mt-1 min-h-28 w-full font-mono text-[11px]"
                  value={credential}
                  onChange={(event) => setCredential(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <button
                type="button"
                className="console-button console-button-primary w-full"
                disabled={!credential.trim() || replaceCredential.isPending}
                onClick={() => replaceCredential.mutate()}
              >
                <KeyRound className="h-3.5 w-3.5" />
                {replaceCredential.isPending ? '保存中…' : '加密保存并重新同步'}
              </button>
              {replaceCredential.error ? <div className="text-sm font-semibold text-danger">{replaceCredential.error.message}</div> : null}
              {replaceCredential.isSuccess ? <div className="text-sm font-semibold text-success">凭据已替换，明文未保留。</div> : null}
            </div>
          )}
        </DataPanel>
      </aside>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-xs font-semibold text-on-surface">
      {label}
      <input className="console-input mt-1 w-full" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
