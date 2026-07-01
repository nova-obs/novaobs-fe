import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import { Folder, Layers3, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { k8sApi, type K8sNamespace } from './api';
import { useK8sOpsContext } from './context';

export function K8sNamespacePage() {
  const queryClient = useQueryClient();
  const { activeClusterId, activeCluster, clusterError } = useK8sOpsContext();
  const [name, setName] = useState('');
  const [owner, setOwner] = useState('');
  const [selectedNamespaceName, setSelectedNamespaceName] = useState('');

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
  const selectedNamespace = namespaces.find((item) => item.name === selectedNamespaceName) ?? namespaces[0];

  useEffect(() => {
    if (!namespaces.length) {
      if (selectedNamespaceName) setSelectedNamespaceName('');
      return;
    }
    if (!namespaces.some((item) => item.name === selectedNamespaceName)) {
      setSelectedNamespaceName(namespaces[0].name);
    }
  }, [namespaces, selectedNamespaceName]);

  return (
    <div className="console-workbench flex min-h-[720px] flex-col gap-3 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <div className="console-summary-strip grid shrink-0 divide-y divide-outline md:grid-cols-3 md:divide-x md:divide-y-0">
        <NamespaceSummary icon={Folder} label="命名空间" value={String(namespaces.length)} meta={activeClusterId ? `cluster/${activeClusterId}` : '等待集群'} />
        <NamespaceSummary icon={Layers3} label="资源域" value={activeCluster?.region || '-'} meta="region" />
        <NamespaceSummary icon={ShieldCheck} label="写入策略" value={activeCluster?.readOnly ? '只读' : '允许'} meta={activeCluster?.accessMode || '-'} />
      </div>

      <div className="console-split-workbench grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="console-panel flex min-h-0 flex-col overflow-hidden">
          <div className="console-panel-header shrink-0">
            <div className="min-w-0">
              <h2 className="console-section-title">命名空间列表</h2>
              <p className="console-section-meta">{activeClusterId ? `${namespaces.length} 个命名空间 · /api/v1/k8s/namespaces` : '等待集群上下文'}</p>
            </div>
            <div className="hidden min-w-0 text-right md:block">
              <div className="text-[11px] font-semibold text-muted">当前集群</div>
              <div className="mt-0.5 max-w-56 truncate font-mono text-xs font-semibold text-on-surface">{activeCluster?.name || activeClusterId || '未选择'}</div>
            </div>
          </div>

          <div className="console-list-toolbar shrink-0">
            <div className="grid min-w-0 flex-1 gap-2 lg:grid-cols-[minmax(180px,1fr)_minmax(160px,240px)_auto]">
              <label className="block min-w-0 text-xs font-semibold text-muted">
                name
                <input className="console-input mt-1.5 h-8 w-full" value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <label className="block min-w-0 text-xs font-semibold text-muted">
                owner
                <input className="console-input mt-1.5 h-8 w-full" value={owner} onChange={(event) => setOwner(event.target.value)} />
              </label>
              <button
                className="console-button console-button-primary self-end"
                disabled={!activeClusterId || !name.trim() || createNamespace.isPending}
                onClick={() => createNamespace.mutate()}
              >
                <Plus className="h-3.5 w-3.5" />
                创建命名空间
              </button>
            </div>
          </div>

          {writeError ? <div className="mx-3 mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">{writeError}</div> : null}
          {isLoading ? (
            <div className="mx-3 mt-3 rounded-md border border-outline bg-surface px-3 py-2 text-sm font-semibold text-muted">
              正在从 `/api/v1/k8s/namespaces` 读取命名空间。
            </div>
          ) : null}
          {error ? (
            <div className="mx-3 mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
              命名空间读取失败：{errorMessage(error)}
            </div>
          ) : null}
          {!isLoading && !error && namespaces.length ? (
            <div className="console-resource-list min-w-0 flex-1">
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
                    <tr
                      key={`${item.clusterId}-${item.name}`}
                      className={`cursor-pointer ${selectedNamespace?.name === item.name ? 'console-selected-row' : ''}`}
                      onClick={() => setSelectedNamespaceName(item.name)}
                    >
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
                          className="console-table-action console-table-action-danger"
                          disabled={deleteNamespace.isPending}
                          onClick={(event) => {
                            event.stopPropagation();
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
            <div className="m-3 console-empty-state">
              <div className="font-semibold text-on-surface">{clusterError ? '集群列表读取失败' : '请先从集群总览进入工作台'}</div>
              <p className="mt-1 text-sm text-muted">{clusterError ? '请检查 NovaObs 后端连接后重试。' : '登记集群并录入凭据后，NovaObs 才会读取 Kubernetes 命名空间。'}</p>
            </div>
          ) : null}
          {activeClusterId && !isLoading && !error && !namespaces.length ? (
            <div className="m-3 console-empty-state">
              <div className="font-semibold text-on-surface">暂无命名空间</div>
              <p className="mt-1 text-sm text-muted">后端已联通，但当前集群没有返回 Kubernetes 命名空间。</p>
            </div>
          ) : null}
        </section>

        <NamespaceInspector
          namespace={selectedNamespace}
          activeClusterId={activeClusterId}
          activeClusterName={activeCluster?.name || activeClusterId}
          readOnly={Boolean(activeCluster?.readOnly)}
          accessMode={activeCluster?.accessMode || '-'}
        />
      </div>
    </div>
  );
}

function NamespaceInspector({
  accessMode,
  activeClusterId,
  activeClusterName,
  namespace,
  readOnly,
}: {
  accessMode: string;
  activeClusterId: string;
  activeClusterName: string;
  namespace: K8sNamespace | undefined;
  readOnly: boolean;
}) {
  return (
    <aside className="console-detail-rail console-inspector hidden xl:block" aria-label="命名空间详情">
      <div className="text-[11px] font-semibold text-muted">当前集群</div>
      <div className="mt-1 truncate font-mono text-sm font-semibold text-on-surface">{activeClusterName || '未选择'}</div>
      <div className="mt-4 h-px bg-outline" />
      {namespace ? (
        <>
          <div className="mt-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-muted">当前命名空间</div>
              <h2 className="mt-1 truncate text-base font-semibold text-on-surface">{namespace.name}</h2>
              <div className="mt-1 break-all font-mono text-[11px] text-muted">{namespace.id}</div>
            </div>
            <StatusPill status={namespace.status} />
          </div>
          <div className="mt-4 grid gap-2 text-xs">
            <InspectorLine label="Cluster" value={namespace.clusterId || activeClusterId || '-'} />
            <InspectorLine label="Phase" value={namespace.phase || '-'} />
            <InspectorLine label="Owner" value={namespace.owner || '-'} />
            <InspectorLine label="来源" value={namespace.id ? 'Kubernetes API' : '-'} />
            <InspectorLine label="写入策略" value={readOnly ? '只读' : '允许'} />
            <InspectorLine label="接入模式" value={accessMode} />
          </div>
        </>
      ) : (
        <div className="console-empty-state mt-4">
          <div className="font-semibold text-on-surface">等待命名空间</div>
          <p className="text-xs text-muted">选择集群并读取命名空间后，这里展示当前对象详情。</p>
        </div>
      )}
    </aside>
  );
}

function InspectorLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-outline bg-surface px-3 py-2">
      <span className="text-muted">{label}</span>
      <span className="min-w-0 truncate font-mono font-semibold text-on-surface">{value}</span>
    </div>
  );
}

function NamespaceSummary({ icon: Icon, label, value, meta }: { icon: LucideIcon; label: string; value: string; meta: string }) {
  return (
    <section className="console-summary-item">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="console-summary-label">{label}</div>
          <div className="console-summary-value">{value}</div>
          <div className="console-summary-meta">{meta}</div>
        </div>
        <Icon className="h-4 w-4 shrink-0 text-primary" />
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
