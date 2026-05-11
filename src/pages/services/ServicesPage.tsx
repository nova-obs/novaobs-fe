import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Edit3, Plus, RefreshCw, Search, XCircle } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { StatusBadge } from '../../components/StatusBadge';
import { api } from '../../services/api';
import type { CreateServiceInput, Service, UpdateServiceInput } from '../../services/types';

const emptyForm: CreateServiceInput & { description?: string } = {
  name: '',
  environment: 'prod',
  displayName: '',
  cluster: '',
  namespace: '',
  ownerTeam: '',
  owner: '',
  alertRoute: '',
  sloLevel: '',
  identityType: 'k8s_workload',
};

function sourceLabel(source: string) {
  return source === 'cmdb' ? 'CMDB' : '本地录入';
}

function syncLabel(status: string) {
  return status === 'synced' ? '已同步' : '本地';
}

export function ServicesPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ q: '', environment: '', status: '', source: '' });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ['services', filters],
    queryFn: () => api.getServices(filters),
  });

  const createMutation = useMutation({
    mutationFn: () => api.createService({ name: form.name, environment: form.environment, displayName: form.displayName || undefined, cluster: form.cluster || undefined, namespace: form.namespace || undefined, ownerTeam: form.ownerTeam || undefined, owner: form.owner || undefined, alertRoute: form.alertRoute || undefined, sloLevel: form.sloLevel || undefined, identityType: form.identityType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setShowForm(false);
      setForm(emptyForm);
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editingId) throw new Error('缺少服务 ID');
      const patch: UpdateServiceInput = {};
      if (form.name) patch.name = form.name;
      if (form.environment) patch.environment = form.environment;
      if (form.displayName !== undefined) patch.displayName = form.displayName;
      if (form.description !== undefined) patch.description = form.description;
      if (form.cluster !== undefined) patch.cluster = form.cluster;
      if (form.namespace !== undefined) patch.namespace = form.namespace;
      if (form.ownerTeam !== undefined) patch.ownerTeam = form.ownerTeam;
      if (form.owner !== undefined) patch.owner = form.owner;
      if (form.alertRoute !== undefined) patch.alertRoute = form.alertRoute;
      if (form.sloLevel !== undefined) patch.sloLevel = form.sloLevel;
      if (form.identityType !== undefined) patch.identityType = form.identityType;
      return api.updateService(editingId, patch);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setEditingId(null);
      setShowForm(false);
      setForm(emptyForm);
    },
  });

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (svc: Service) => {
    setEditingId(svc.id);
    setForm({ name: svc.name, environment: svc.environment, displayName: svc.displayName, description: svc.description, cluster: svc.cluster, namespace: svc.namespace, ownerTeam: svc.ownerTeam, owner: svc.owner, alertRoute: svc.alertRoute, sloLevel: svc.sloLevel, identityType: svc.identityType });
    setShowForm(true);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-on-surface">服务目录</h1>
          <p className="mt-1 text-sm text-muted">业务、应用、环境、负责人和告警路由的统一控制面。</p>
        </div>
        <button className="rounded bg-primary px-4 py-2 text-sm font-semibold text-white" onClick={openCreate}>
          <Plus className="mr-1 inline h-3.5 w-3.5" />新增服务
        </button>
      </div>

      {error ? (
        <DataPanel title="加载失败" meta="error">
          <div className="flex items-center gap-3 py-4">
            <XCircle className="h-5 w-5 text-red-400" />
            <p className="text-sm text-muted">{(error as Error).message || '无法加载服务列表'}</p>
            <button className="rounded bg-primary px-3 py-1.5 text-xs font-semibold text-white" onClick={() => refetch()}>重试</button>
          </div>
        </DataPanel>
      ) : (
        <>
          <DataPanel title="筛选" meta={isLoading ? '加载中...' : `${data.length} 个服务`}>
            <div className="grid gap-3 md:grid-cols-4">
              <label className="text-sm font-semibold">
                搜索
                <div className="relative mt-2">
                  <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                  <input className="console-input w-full pl-8" placeholder="名称 / CMDB ID / 业务 / 负责人…" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
                </div>
              </label>
              <label className="text-sm font-semibold">
                环境
                <select className="console-input mt-2 w-full" value={filters.environment} onChange={(e) => setFilters({ ...filters, environment: e.target.value })}>
                  <option value="">全部</option>
                  <option value="prod">prod</option>
                  <option value="staging">staging</option>
                  <option value="dev">dev</option>
                </select>
              </label>
              <label className="text-sm font-semibold">
                状态
                <select className="console-input mt-2 w-full" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                  <option value="">全部</option>
                  <option value="active">active</option>
                  <option value="pending">pending</option>
                  <option value="degraded">degraded</option>
                </select>
              </label>
              <label className="text-sm font-semibold">
                来源
                <select className="console-input mt-2 w-full" value={filters.source} onChange={(e) => setFilters({ ...filters, source: e.target.value })}>
                  <option value="">全部</option>
                  <option value="manual">本地录入</option>
                  <option value="cmdb">CMDB</option>
                </select>
              </label>
            </div>
          </DataPanel>

          {showForm ? (
            <DataPanel title={editingId ? '编辑服务' : '新增服务'} meta={editingId ?? 'new'}>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm font-semibold">服务名称 *<input className="console-input mt-2 w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                <label className="text-sm font-semibold">环境 *<select className="console-input mt-2 w-full" value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value })}><option value="prod">prod</option><option value="staging">staging</option><option value="dev">dev</option></select></label>
                <label className="text-sm font-semibold">展示名称<input className="console-input mt-2 w-full" value={form.displayName ?? ''} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></label>
                <label className="text-sm font-semibold">集群<input className="console-input mt-2 w-full" value={form.cluster ?? ''} onChange={(e) => setForm({ ...form, cluster: e.target.value })} /></label>
                <label className="text-sm font-semibold">Namespace<input className="console-input mt-2 w-full" value={form.namespace ?? ''} onChange={(e) => setForm({ ...form, namespace: e.target.value })} /></label>
                <label className="text-sm font-semibold">Owner Team<input className="console-input mt-2 w-full" value={form.ownerTeam ?? ''} onChange={(e) => setForm({ ...form, ownerTeam: e.target.value })} /></label>
                <label className="text-sm font-semibold">Owner<input className="console-input mt-2 w-full" value={form.owner ?? ''} onChange={(e) => setForm({ ...form, owner: e.target.value })} /></label>
                <label className="text-sm font-semibold">告警路由<input className="console-input mt-2 w-full" value={form.alertRoute ?? ''} onChange={(e) => setForm({ ...form, alertRoute: e.target.value })} /></label>
                <label className="text-sm font-semibold">SLO Level<input className="console-input mt-2 w-full" value={form.sloLevel ?? ''} onChange={(e) => setForm({ ...form, sloLevel: e.target.value })} /></label>
                <label className="text-sm font-semibold">运行身份<select className="console-input mt-2 w-full" value={form.identityType ?? 'k8s_workload'} onChange={(e) => setForm({ ...form, identityType: e.target.value as typeof form.identityType })}><option value="k8s_workload">K8s Workload</option><option value="host_process">物理机 / VM 进程</option><option value="syslog_device">Syslog 设备</option></select></label>
              </div>
              <div className="mt-4 flex gap-2">
                <button className="rounded bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={!form.name || !form.environment || isPending} onClick={() => (editingId ? updateMutation.mutate() : createMutation.mutate())}>
                  {isPending ? <RefreshCw className="mr-1 inline h-3.5 w-3.5 animate-spin" /> : null}
                  {editingId ? '保存修改' : '创建服务'}
                </button>
                <button className="rounded border border-outline px-4 py-2 text-sm font-semibold text-on-surface" onClick={() => { setShowForm(false); setEditingId(null); }}>取消</button>
              </div>
              {createMutation.error ? <p className="mt-2 text-sm text-red-400">{(createMutation.error as Error).message}</p> : null}
              {updateMutation.error ? <p className="mt-2 text-sm text-red-400">{(updateMutation.error as Error).message}</p> : null}
            </DataPanel>
          ) : null}

          <DataPanel title="服务清单" meta={`${data.length} 个服务`}>
            {isLoading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted"><RefreshCw className="h-4 w-4 animate-spin" />加载中...</div>
            ) : data.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <p className="text-sm text-muted">暂无服务，请手工录入服务。</p>
                <button className="rounded bg-primary px-4 py-2 text-sm font-semibold text-white" onClick={openCreate}><Plus className="mr-1 inline h-3.5 w-3.5" />新增服务</button>
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="console-table min-w-[1200px] w-full">
                  <thead>
                    <tr>
                      <th>服务</th>
                      <th>环境</th>
                      <th>集群 / Namespace</th>
                      <th>Owner</th>
                      <th>来源</th>
                      <th>同步</th>
                      <th>告警路由</th>
                      <th>运行身份</th>
                      <th>状态</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((svc) => (
                      <tr key={svc.id} className="bg-surface-lowest hover:bg-surface-low">
                        <td>
                          <div className="font-semibold text-primary">{svc.name}</div>
                          <div className="text-[11px] text-muted">{svc.displayName}</div>
                        </td>
                        <td className="font-mono">{svc.environment}</td>
                        <td className="font-mono text-xs">{svc.cluster} / {svc.namespace}</td>
                        <td className="text-sm">{svc.ownerTeam}{svc.owner ? ` · ${svc.owner}` : ''}</td>
                        <td><span className={`text-xs ${svc.source === 'cmdb' ? 'text-info' : 'text-muted'}`}>{sourceLabel(svc.source)}</span></td>
                        <td><span className={`text-xs ${svc.syncStatus === 'synced' ? 'text-emerald-400' : 'text-muted'}`}>{syncLabel(svc.syncStatus)}</span></td>
                        <td className="font-mono text-xs text-muted">{svc.alertRoute || '-'}</td>
                        <td className="font-mono text-xs text-muted">{svc.identityType || 'k8s_workload'}</td>
                        <td><StatusBadge value={svc.status} /></td>
                        <td>
                          <button className="rounded p-1 text-muted hover:bg-surface-low hover:text-primary" onClick={() => openEdit(svc)}><Edit3 className="h-3.5 w-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataPanel>
        </>
      )}
    </div>
  );
}
