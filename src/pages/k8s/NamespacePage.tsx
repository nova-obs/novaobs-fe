import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Folder, Layers3, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { k8sApi } from './api';
import { useK8sOpsContext } from './context';

export function K8sNamespacePage() {
  const queryClient = useQueryClient();
  const { activeClusterId, activeCluster, clusterError } = useK8sOpsContext();
  const [name, setName] = useState('');
  const [owner, setOwner] = useState('');

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['k8s-namespaces', activeClusterId],
    queryFn: () => k8sApi.listNamespaces(activeClusterId),
    enabled: Boolean(activeClusterId),
    retry: false,
  });
  const namespaces = data;
  const createNamespace = useMutation({
    mutationFn: () => k8sApi.createNamespace({ clusterId: activeClusterId, name, owner }),
    onSuccess: () => {
      setName('');
      setOwner('');
      queryClient.invalidateQueries({ queryKey: ['k8s-namespaces'] });
    },
  });
  const deleteNamespace = useMutation({
    mutationFn: (target: (typeof namespaces)[number]) => k8sApi.deleteNamespace(target),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['k8s-namespaces'] }),
  });
  const writeError = createNamespace.error?.message || deleteNamespace.error?.message || '';

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <NamespaceMetric icon={Folder} label="命名空间" value={String(namespaces.length)} meta={activeClusterId ? `cluster/${activeClusterId}` : '等待集群'} />
        <NamespaceMetric icon={Layers3} label="资源域" value={activeCluster?.region || '-'} meta="region" />
        <NamespaceMetric icon={ShieldCheck} label="写入策略" value={activeCluster?.readOnly ? '只读' : '允许'} meta={activeCluster?.accessMode || '-'} />
      </div>

      <section className="console-panel px-4 py-3">
        <div className="grid gap-3 md:grid-cols-[minmax(220px,320px)_1fr] md:items-end">
          <div className="rounded-lg bg-white/55 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            <div className="text-xs font-semibold text-muted">当前集群</div>
            <div className="mt-1 font-mono text-sm font-semibold text-on-surface">{activeCluster?.name || activeClusterId || '未选择'}</div>
          </div>
          <div className="text-sm font-semibold text-on-surface">{activeCluster?.readOnly ? '只读集群' : '可写集群'}</div>
        </div>
      </section>

      <section className="console-panel px-4 py-3">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(180px,240px)_auto]">
          <label className="block text-xs font-semibold text-muted">
            name
            <input className="console-input mt-2 w-full" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="block text-xs font-semibold text-muted">
            owner
            <input className="console-input mt-2 w-full" value={owner} onChange={(event) => setOwner(event.target.value)} />
          </label>
          <button
            className="quiet-button self-end bg-primary text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!activeClusterId || !name.trim() || createNamespace.isPending}
            onClick={() => createNamespace.mutate()}
          >
            <Plus className="h-4 w-4" />
            创建命名空间
          </button>
        </div>
        {writeError ? <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">{writeError}</div> : null}
      </section>

      <DataPanel title="命名空间列表" meta={activeClusterId ? `${namespaces.length} 个命名空间` : '等待集群上下文'}>
        {isLoading ? (
          <div className="mb-3 rounded-lg bg-white/45 px-3 py-2 text-sm font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
            正在从 `/api/v1/k8s/namespaces` 读取命名空间。
          </div>
        ) : null}
        {error ? (
          <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            命名空间读取失败：{errorMessage(error)}
          </div>
        ) : null}
        {!isLoading && !error && namespaces.length ? (
          <div className="overflow-auto">
            <table className="console-table min-w-[760px] w-full">
              <thead>
                <tr>
                  <th>命名空间</th>
                  <th>集群</th>
                  <th>Phase</th>
                  <th>Owner</th>
                  <th>状态</th>
                  <th>来源</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {namespaces.map((item) => (
                  <tr key={`${item.clusterId}-${item.name}`} className="bg-white/35 hover:bg-white/60">
                    <td>
                      <div className="font-semibold text-primary">{item.name}</div>
                      <div className="text-[11px] text-muted">{item.id}</div>
                    </td>
                    <td className="font-mono text-xs">{item.clusterId}</td>
                    <td className="font-mono text-xs">{item.phase || '-'}</td>
                    <td className="text-xs text-muted">{item.owner || '-'}</td>
                    <td><StatusPill status={item.status} /></td>
                    <td className="text-xs text-muted">{item.id ? 'Kubernetes API' : '-'}</td>
                    <td>
                      <button
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/70 px-3 py-1.5 text-xs font-semibold text-danger shadow-[inset_0_0_0_1px_rgba(169,68,66,0.18)] transition active:scale-[0.98] disabled:opacity-60"
                        disabled={deleteNamespace.isPending}
                        onClick={() => {
                          if (window.confirm(`确认删除命名空间 ${item.name}？`)) {
                            deleteNamespace.mutate(item);
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {!activeClusterId ? (
          <div className="rounded-lg bg-white/45 px-4 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
            <div className="font-semibold text-on-surface">{clusterError ? '集群列表读取失败' : '请先从集群总览进入工作台'}</div>
            <p className="mt-2 text-sm text-muted">{clusterError ? '请检查 NovaObs 后端连接后重试。' : '登记集群并录入凭据后，NovaObs 才会读取 Kubernetes 命名空间。'}</p>
          </div>
        ) : null}
        {activeClusterId && !isLoading && !error && !namespaces.length ? (
          <div className="rounded-lg bg-white/45 px-4 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
            <div className="font-semibold text-on-surface">暂无命名空间</div>
            <p className="mt-2 text-sm text-muted">后端已联通，但当前集群没有返回 Kubernetes 命名空间。</p>
          </div>
        ) : null}
      </DataPanel>
    </div>
  );
}

function NamespaceMetric({ icon: Icon, label, value, meta }: { icon: typeof Folder; label: string; value: string; meta: string }) {
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

function StatusPill({ status }: { status: string }) {
  const active = status === 'active';
  return (
    <span className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold ${active ? 'bg-primary-soft text-primary' : 'bg-amber-100 text-warning'}`}>
      {active ? '运行中' : status || 'unknown'}
    </span>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : '请检查集群凭据、平台 RBAC 与 Kubernetes API 连通性。';
}
