import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { EmptyState } from '../../components/EmptyState';
import { api } from '../../services/api';
import { k8sApi } from '../k8s/api';
import {
  platformApi,
  type EnvironmentResourceKind,
  type EnvironmentStage,
  type PlatformEnvironment,
} from './api';

const stageLabels: Record<EnvironmentStage, string> = {
  production: '生产',
  staging: '预发',
  test: '测试',
  development: '开发',
};

const resourceLabels: Record<EnvironmentResourceKind, string> = {
  k8s_cluster: 'K8s 集群',
  host_group: 'VM / 主机组',
};

export function PlatformEnvironmentsPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
	const [editOpen, setEditOpen] = useState(false);
  const [resourceKind, setResourceKind] = useState<EnvironmentResourceKind>('k8s_cluster');
  const [resourceRef, setResourceRef] = useState('');
  const environmentsQuery = useQuery({ queryKey: ['platform-environments'], queryFn: platformApi.listEnvironments, retry: false });
  const environments = environmentsQuery.data ?? [];
  const detailQuery = useQuery({
    queryKey: ['platform-environment', selectedId],
    queryFn: () => platformApi.getEnvironment(selectedId),
    enabled: Boolean(selectedId),
    retry: false,
  });
	const clustersQuery = useQuery({ queryKey: ['k8s-clusters', 'environment-binding'], queryFn: () => k8sApi.listClusters(), retry: false });
	const hostGroupsQuery = useQuery({ queryKey: ['collector-groups', 'environment-binding'], queryFn: () => api.getCollectorGroups(), retry: false });
	const resourceOptions = resourceKind === 'k8s_cluster'
		? (clustersQuery.data ?? []).filter((item) => item.status !== 'deleted').map((item) => ({ id: item.id, label: item.name || item.id }))
		: (hostGroupsQuery.data ?? []).filter((item) => item.status !== 'deleted').map((item) => ({ id: item.id, label: item.displayName || item.name || item.id }));

  useEffect(() => {
    if (selectedId && environments.some((item) => item.id === selectedId)) return;
    setSelectedId(environments[0]?.id ?? '');
  }, [environments, selectedId]);

	useEffect(() => {
		if (resourceOptions.some((item) => item.id === resourceRef)) return;
		setResourceRef(resourceOptions[0]?.id ?? '');
	}, [resourceKind, resourceOptions, resourceRef]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return environments;
    return environments.filter((item) => [item.name, item.id, item.stage, item.description].join(' ').toLowerCase().includes(keyword));
  }, [environments, query]);

  const bindMutation = useMutation({
    mutationFn: () => platformApi.bindEnvironmentResource(selectedId, { resourceKind, resourceRef: resourceRef.trim() }),
    onSuccess: async () => {
      setResourceRef('');
      await queryClient.invalidateQueries({ queryKey: ['platform-environment', selectedId] });
    },
  });
  const unbindMutation = useMutation({
    mutationFn: (bindingId: string) => platformApi.unbindEnvironmentResource(selectedId, bindingId),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['platform-environment', selectedId] }),
  });

  return (
    <div className="console-workbench min-h-0 overflow-hidden">
      <div className="grid h-full min-h-0 grid-cols-1 xl:grid-cols-[minmax(620px,1fr)_380px]">
        <DataPanel
          title="环境"
          help="环境是服务、K8s、VM、日志和指标共享的稳定归属。"
          action={<button type="button" className="console-button console-button-primary h-8 px-3" onClick={() => setCreateOpen(true)}><Plus className="h-3.5 w-3.5" />创建环境</button>}
        >
          {environmentsQuery.isLoading ? <EnvironmentSkeleton /> : environmentsQuery.error ? (
            <EmptyState title="环境加载失败" action={<button type="button" className="console-button" onClick={() => environmentsQuery.refetch()}>重试</button>} />
          ) : environments.length === 0 ? (
            <EmptyState title="尚未登记环境" action={<button type="button" className="console-button console-button-primary" onClick={() => setCreateOpen(true)}>创建环境</button>} />
          ) : (
            <div className="overflow-hidden rounded-md border border-outline bg-white">
              <div className="console-list-toolbar border-b border-outline">
                <label className="console-list-toolbar-search sm:w-[360px]">
                  <span className="sr-only">搜索环境</span>
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                  <input className="console-input h-8 w-full pl-8 text-xs" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称、ID、阶段" />
                </label>
                <button type="button" className="console-icon-button" onClick={() => environmentsQuery.refetch()} disabled={environmentsQuery.isFetching} aria-label="刷新环境" title="刷新环境">
                  <RefreshCw className={`h-3.5 w-3.5 ${environmentsQuery.isFetching ? 'animate-spin' : ''}`} />
                </button>
              </div>
              {filtered.length === 0 ? <div className="py-12"><EmptyState title="未找到匹配环境" /></div> : (
                <div className="overflow-auto">
                  <table className="console-table w-full min-w-[620px] table-fixed">
                    <colgroup><col className="w-[32%]" /><col className="w-[18%]" /><col className="w-[18%]" /><col className="w-[32%]" /></colgroup>
                    <thead><tr><th>环境</th><th>阶段</th><th>状态</th><th>环境 ID</th></tr></thead>
                    <tbody>{filtered.map((item) => <EnvironmentRow key={item.id} item={item} selected={item.id === selectedId} onSelect={() => setSelectedId(item.id)} />)}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </DataPanel>

        <aside className="min-h-0 overflow-auto border-l border-outline bg-white p-4" aria-label="环境详情">
          {!selectedId ? <EmptyState title="请选择环境" /> : detailQuery.isLoading ? <EnvironmentSkeleton /> : detailQuery.error ? (
            <EmptyState title="环境详情加载失败" action={<button type="button" className="console-button" onClick={() => detailQuery.refetch()}>重试</button>} />
          ) : detailQuery.data ? (
            <div className="space-y-5">
              <div>
				<div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><h2 className="truncate text-base font-semibold text-on-surface">{detailQuery.data.environment.name}</h2><EnvironmentStatus status={detailQuery.data.environment.status} /></div><button type="button" className="console-button h-8 px-2" onClick={() => setEditOpen(true)}><Pencil className="h-3.5 w-3.5" />编辑</button></div>
                <div className="mt-1 font-mono text-[11px] text-muted">{detailQuery.data.environment.id}</div>
                {detailQuery.data.environment.description ? <p className="mt-2 text-xs leading-5 text-muted">{detailQuery.data.environment.description}</p> : null}
              </div>

              <section className="border-t border-outline pt-4">
                <h3 className="text-sm font-semibold text-on-surface">环境资源</h3>
                <p className="mt-1 text-xs leading-5 text-muted">资源只能归属一个活动环境。这里保存引用，不复制集群或主机真值。</p>
                <div className="mt-3 space-y-2">
                  {detailQuery.data.resourceBindings.length === 0 ? <div className="rounded border border-dashed border-outline px-3 py-6 text-center text-xs text-muted">尚未绑定运行资源</div> : detailQuery.data.resourceBindings.map((binding) => (
                    <div key={binding.id} className="flex items-center justify-between gap-3 rounded border border-outline px-3 py-2">
                      <div className="min-w-0"><div className="text-xs font-semibold text-on-surface">{resourceLabels[binding.resourceKind]}</div><div className="mt-0.5 truncate font-mono text-[11px] text-muted" title={binding.resourceRef}>{binding.resourceRef}</div></div>
                      <button type="button" className="console-icon-button text-danger" aria-label={`解除绑定 ${binding.resourceRef}`} title="解除资源绑定" onClick={() => unbindMutation.mutate(binding.id)} disabled={unbindMutation.isPending}><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>

                {detailQuery.data.environment.status === 'active' ? (
                  <div className="mt-4 space-y-2 border-t border-outline pt-4">
                    <label className="block text-xs font-semibold text-on-surface">资源类型<select className="console-input mt-1 w-full" value={resourceKind} onChange={(event) => setResourceKind(event.target.value as EnvironmentResourceKind)}><option value="k8s_cluster">K8s 集群</option><option value="host_group">VM / 主机组</option></select></label>
					<label className="block text-xs font-semibold text-on-surface">已登记资源<select className="console-input mt-1 w-full text-xs" value={resourceRef} disabled={(resourceKind === 'k8s_cluster' ? clustersQuery : hostGroupsQuery).isLoading} onChange={(event) => setResourceRef(event.target.value)}>{resourceOptions.length === 0 ? <option value="">暂无可绑定资源</option> : resourceOptions.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.id}</option>)}</select></label>
                    {bindMutation.error ? <div className="text-xs font-semibold text-danger">{errorMessage(bindMutation.error)}</div> : null}
                    <button type="button" className="console-button console-button-primary h-8 w-full" disabled={!resourceRef.trim() || bindMutation.isPending} onClick={() => bindMutation.mutate()}>{bindMutation.isPending ? '绑定中' : '绑定资源'}</button>
                  </div>
                ) : <div className="mt-4 rounded border border-outline bg-surface px-3 py-2 text-xs text-muted">已归档环境不能绑定新资源。</div>}
              </section>
            </div>
          ) : null}
        </aside>
      </div>
      {createOpen ? <CreateEnvironmentDialog onClose={() => setCreateOpen(false)} onCreated={(item) => { setSelectedId(item.id); setCreateOpen(false); }} /> : null}
		{editOpen && detailQuery.data ? <EditEnvironmentDialog environment={detailQuery.data.environment} onClose={() => setEditOpen(false)} onUpdated={async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ['platform-environments'] }), queryClient.invalidateQueries({ queryKey: ['platform-environment', selectedId] })]); setEditOpen(false); }} /> : null}
    </div>
  );
}

function EditEnvironmentDialog({ environment, onClose, onUpdated }: { environment: PlatformEnvironment; onClose: () => void; onUpdated: () => void }) {
	const [name, setName] = useState(environment.name);
	const [stage, setStage] = useState<EnvironmentStage>(environment.stage);
	const [description, setDescription] = useState(environment.description);
	const [status, setStatus] = useState(environment.status);
	const mutation = useMutation({ mutationFn: () => platformApi.updateEnvironment(environment.id, { name: name.trim(), stage, description: description.trim(), status }), onSuccess: onUpdated });
	return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-environment-title"><div className="w-full max-w-lg rounded-lg border border-outline bg-white shadow-xl"><div className="flex items-center justify-between border-b border-outline px-4 py-3"><h2 id="edit-environment-title" className="text-base font-semibold">编辑环境</h2><button type="button" className="console-icon-button" onClick={onClose} aria-label="关闭编辑环境"><X className="h-4 w-4" /></button></div><div className="space-y-4 p-4"><label className="block text-sm font-semibold">环境名称<input className="console-input mt-1 w-full" value={name} onChange={(event) => setName(event.target.value)} autoFocus /></label><label className="block text-sm font-semibold">阶段<select className="console-input mt-1 w-full" value={stage} onChange={(event) => setStage(event.target.value as EnvironmentStage)}>{Object.entries(stageLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="block text-sm font-semibold">状态<select className="console-input mt-1 w-full" value={status} onChange={(event) => setStatus(event.target.value as PlatformEnvironment['status'])}><option value="active">活动</option><option value="archived">归档</option></select></label><label className="block text-sm font-semibold">说明<textarea className="console-input mt-1 min-h-20 w-full resize-y py-2" value={description} onChange={(event) => setDescription(event.target.value)} /></label>{status === 'archived' ? <div className="console-notice console-notice-warning">归档后不能新增资源绑定；已有身份和历史关联会保留。</div> : null}{mutation.error ? <div className="text-xs font-semibold text-danger">{errorMessage(mutation.error)}</div> : null}</div><div className="flex justify-end gap-2 border-t border-outline px-4 py-3"><button type="button" className="console-button" onClick={onClose} disabled={mutation.isPending}>取消</button><button type="button" className="console-button console-button-primary" disabled={!name.trim() || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? '保存中' : '保存'}</button></div></div></div>;
}

function EnvironmentRow({ item, selected, onSelect }: { item: PlatformEnvironment; selected: boolean; onSelect: () => void }) {
  return <tr className={`cursor-pointer ${selected ? 'console-selected-row' : ''}`} onClick={onSelect}><td><div className="truncate font-semibold text-on-surface">{item.name}</div></td><td className="text-xs text-muted">{stageLabels[item.stage]}</td><td><EnvironmentStatus status={item.status} /></td><td><div className="truncate font-mono text-[11px] text-muted" title={item.id}>{item.id}</div></td></tr>;
}

function EnvironmentStatus({ status }: { status: PlatformEnvironment['status'] }) {
  return <span className={`inline-flex items-center gap-1 text-xs font-semibold ${status === 'active' ? 'text-success' : 'text-muted'}`}><span className={`h-1.5 w-1.5 rounded-full ${status === 'active' ? 'bg-success' : 'bg-muted'}`} />{status === 'active' ? '活动' : '已归档'}</span>;
}

function CreateEnvironmentDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (item: PlatformEnvironment) => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [stage, setStage] = useState<EnvironmentStage>('production');
  const [description, setDescription] = useState('');
  const mutation = useMutation({
    mutationFn: () => platformApi.createEnvironment({ name: name.trim(), stage, description: description.trim() }),
    onSuccess: async (item) => {
      await queryClient.invalidateQueries({ queryKey: ['platform-environments'] });
      onCreated(item);
    },
  });
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4" role="dialog" aria-modal="true" aria-labelledby="create-environment-title">
    <div className="w-full max-w-lg rounded-lg border border-outline bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-outline px-4 py-3"><h2 id="create-environment-title" className="text-base font-semibold">创建环境</h2><button type="button" className="console-icon-button" onClick={onClose} aria-label="关闭创建环境"><X className="h-4 w-4" /></button></div>
      <div className="space-y-4 p-4">
        <label className="block text-sm font-semibold">环境名称<input className="console-input mt-1 w-full" value={name} onChange={(event) => setName(event.target.value)} autoFocus /></label>
        <label className="block text-sm font-semibold">阶段<select className="console-input mt-1 w-full" value={stage} onChange={(event) => setStage(event.target.value as EnvironmentStage)}>{Object.entries(stageLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="block text-sm font-semibold">说明<textarea className="console-input mt-1 min-h-20 w-full resize-y py-2" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        {mutation.error ? <div className="text-xs font-semibold text-danger">{errorMessage(mutation.error)}</div> : null}
      </div>
      <div className="flex justify-end gap-2 border-t border-outline px-4 py-3"><button type="button" className="console-button" onClick={onClose} disabled={mutation.isPending}>取消</button><button type="button" className="console-button console-button-primary" onClick={() => mutation.mutate()} disabled={!name.trim() || mutation.isPending}>{mutation.isPending ? '创建中' : '创建环境'}</button></div>
    </div>
  </div>;
}

function EnvironmentSkeleton() {
  return <div className="space-y-2"><div className="h-8 rounded bg-surface" /><div className="h-10 rounded bg-surface" /><div className="h-10 rounded bg-surface" /></div>;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失败';
}
