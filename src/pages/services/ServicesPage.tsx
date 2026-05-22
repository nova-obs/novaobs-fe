import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Bell, Cpu, Edit3, Eye, GitBranch, Link2, Plus, RefreshCw, Search, Server, ShieldCheck, XCircle } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { StatusBadge } from '../../components/StatusBadge';
import { api } from '../../services/api';
import type { CreateServiceInput, Service, ServiceObservabilityGraph, ServiceTargetType, UpdateServiceInput } from '../../services/types';
import { graphStatItems, runningTargetPurposeItems, targetLocationSummary, targetPurposeLabel, targetTypeLabel } from './servicesViewModel';

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

const targetAttributeFields: Record<ServiceTargetType, Array<{ key: string; label: string; placeholder: string }>> = {
  cloud_native_workload: [
    { key: 'k8s.cluster.name', label: 'Cluster', placeholder: 'prod-1' },
    { key: 'k8s.namespace.name', label: 'Namespace', placeholder: 'orders' },
    { key: 'k8s.deployment.name', label: 'Workload', placeholder: 'orders-api' },
  ],
  host_process: [
    { key: 'host.name', label: 'Host', placeholder: 'vm-01' },
    { key: 'process.executable.name', label: 'Process', placeholder: 'orders-api' },
    { key: 'net.host.port', label: 'Port', placeholder: '8080' },
  ],
  physical_or_network_device: [
    { key: 'device.name', label: 'Device', placeholder: 'edge-fw-01' },
    { key: 'net.host.ip', label: 'IP', placeholder: '10.0.0.8' },
    { key: 'vendor', label: 'Vendor', placeholder: 'Cisco / Huawei' },
  ],
};

const emptyTargetForm = {
  targetType: 'cloud_native_workload' as ServiceTargetType,
  displayName: '',
  environment: '',
  identityAttributes: {} as Record<string, string>,
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
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [targetForm, setTargetForm] = useState(emptyTargetForm);

  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ['services', filters],
    queryFn: () => api.getServices(filters),
  });

  const selectedService = data.find((svc) => svc.id === selectedServiceId) ?? data[0] ?? null;
  const activeServiceId = selectedServiceId ?? selectedService?.id ?? null;
  const { data: graph, isLoading: graphLoading, error: graphError } = useQuery({
    queryKey: ['service-observability-graph', activeServiceId],
    queryFn: () => api.getServiceObservabilityGraph(activeServiceId!),
    enabled: !!activeServiceId,
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

  const createTargetMutation = useMutation({
    mutationFn: () => {
      if (!activeServiceId) throw new Error('缺少服务 ID');
      const attrs = Object.fromEntries(Object.entries(targetForm.identityAttributes).filter(([, value]) => value.trim() !== ''));
      return api.createServiceTarget(activeServiceId, {
        targetType: targetForm.targetType,
        environment: targetForm.environment || selectedService?.environment,
        displayName: targetForm.displayName || undefined,
        identityAttributes: attrs,
        matchRules: attrs,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-observability-graph', activeServiceId] });
      setTargetForm(emptyTargetForm);
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
                      <th>默认定位</th>
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
                        <td className="font-mono text-xs">{svc.cluster || '-'}{svc.namespace ? ` / ${svc.namespace}` : ''}</td>
                        <td className="text-sm">{svc.ownerTeam}{svc.owner ? ` · ${svc.owner}` : ''}</td>
                        <td><span className={`text-xs ${svc.source === 'cmdb' ? 'text-info' : 'text-muted'}`}>{sourceLabel(svc.source)}</span></td>
                        <td><span className={`text-xs ${svc.syncStatus === 'synced' ? 'text-primary' : 'text-muted'}`}>{syncLabel(svc.syncStatus)}</span></td>
                        <td className="font-mono text-xs text-muted">{svc.alertRoute || '-'}</td>
                        <td className="font-mono text-xs text-muted">{svc.identityType || 'k8s_workload'}</td>
                        <td><StatusBadge value={svc.status} /></td>
                        <td>
                          <button className="rounded p-1 text-muted hover:bg-surface-low hover:text-primary" onClick={() => openEdit(svc)}><Edit3 className="h-3.5 w-3.5" /></button>
                          <button className="ml-1 rounded p-1 text-muted hover:bg-surface-low hover:text-primary" onClick={() => setSelectedServiceId(svc.id)}><Eye className="h-3.5 w-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataPanel>

          {activeServiceId ? (
            <ServiceGraphPanel
              graph={graph}
              loading={graphLoading}
              error={graphError as Error | null}
              targetForm={targetForm}
              setTargetForm={setTargetForm}
              onCreateTarget={() => createTargetMutation.mutate()}
              creatingTarget={createTargetMutation.isPending}
              createTargetError={createTargetMutation.error as Error | null}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function ServiceGraphPanel({
  graph,
  loading,
  error,
  targetForm,
  setTargetForm,
  onCreateTarget,
  creatingTarget,
  createTargetError,
}: {
  graph?: ServiceObservabilityGraph;
  loading: boolean;
  error: Error | null;
  targetForm: typeof emptyTargetForm;
  setTargetForm: (value: typeof emptyTargetForm) => void;
  onCreateTarget: () => void;
  creatingTarget: boolean;
  createTargetError: Error | null;
}) {
  const fields = targetAttributeFields[targetForm.targetType];
  return (
    <DataPanel title="观测关系" meta={graph?.service.name ?? 'service'}>
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted"><RefreshCw className="h-4 w-4 animate-spin" />加载中...</div>
      ) : error ? (
        <div className="flex items-center gap-2 py-4 text-sm text-red-400"><XCircle className="h-4 w-4" />{error.message}</div>
      ) : graph ? (
        <div className="space-y-5">
          <div className="rounded-lg bg-primary-soft/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/70 text-primary">
                <Link2 className="h-4 w-4" />
              </div>
              <div>
                <div className="font-display text-sm font-semibold text-on-surface">运行目标的作用</div>
                <p className="mt-1 text-xs leading-5 text-muted">
                  运行目标把服务目录里的业务服务映射到真实运行实体，是日志归属、Agent 绑定、Pipeline 下发和告警定位的共同锚点。
                </p>
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {runningTargetPurposeItems().map((item) => (
                <div key={item.title} className="rounded-lg bg-white/58 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
                  <div className="flex items-center gap-2 text-xs font-semibold text-on-surface">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    {item.title}
                  </div>
                  <p className="mt-1 text-[11px] leading-4 text-muted">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            {graphStatItems(graph).map((item) => (
              <div key={item.label} className="rounded border border-outline bg-surface-lowest px-3 py-2">
                <div className="text-[11px] text-muted">{item.label}</div>
                <div className="mt-1 font-display text-xl font-semibold text-on-surface">{item.value}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded border border-outline bg-surface-lowest">
              <div className="flex items-center justify-between border-b border-outline px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold"><Server className="h-4 w-4 text-primary" />运行目标</div>
                <span className="text-xs text-muted">{graph.targets.length}</span>
              </div>
              <div className="divide-y divide-outline">
                {graph.targets.length === 0 ? <EmptyRelation label="暂无运行目标" /> : graph.targets.map((target) => (
                  <div key={target.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-on-surface">{target.displayName || targetTypeLabel(target.targetType)}</div>
                      <span className="rounded bg-surface-low px-2 py-1 text-[11px] text-muted">{targetTypeLabel(target.targetType)}</span>
                    </div>
                    <div className="mt-1 font-mono text-xs text-muted">{targetLocationSummary(target)}</div>
                    <div className="mt-2 text-[11px] leading-4 text-muted">{targetPurposeLabel(target.targetType)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded border border-outline bg-surface-lowest p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Plus className="h-4 w-4 text-primary" />新增运行目标</div>
              <div className="grid gap-3">
                <select className="console-input w-full" value={targetForm.targetType} onChange={(e) => setTargetForm({ ...emptyTargetForm, targetType: e.target.value as ServiceTargetType })}>
                  <option value="cloud_native_workload">云原生工作负载</option>
                  <option value="host_process">VM / 物理机进程</option>
                  <option value="physical_or_network_device">物理设备 / 网络设备</option>
                </select>
                <input className="console-input w-full" placeholder="展示名称" value={targetForm.displayName} onChange={(e) => setTargetForm({ ...targetForm, displayName: e.target.value })} />
                <input className="console-input w-full" placeholder="环境" value={targetForm.environment} onChange={(e) => setTargetForm({ ...targetForm, environment: e.target.value })} />
                {fields.map((field) => (
                  <input
                    key={field.key}
                    className="console-input w-full"
                    placeholder={`${field.label}: ${field.placeholder}`}
                    value={targetForm.identityAttributes[field.key] ?? ''}
                    onChange={(e) => setTargetForm({ ...targetForm, identityAttributes: { ...targetForm.identityAttributes, [field.key]: e.target.value } })}
                  />
                ))}
                <button className="rounded bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={creatingTarget} onClick={onCreateTarget}>
                  {creatingTarget ? <RefreshCw className="mr-1 inline h-3.5 w-3.5 animate-spin" /> : null}
                  保存目标
                </button>
                {createTargetError ? <p className="text-sm text-red-400">{createTargetError.message}</p> : null}
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <RelationList icon={<Cpu className="h-4 w-4 text-primary" />} title="Agent" empty="暂无 Agent" items={graph.agents.map((agent) => ({ id: agent.instanceUid, title: agent.instanceUid, meta: `${agent.runtimeStatus} · ${agent.remoteConfigStatus || 'unset'}` }))} />
            <RelationList icon={<GitBranch className="h-4 w-4 text-primary" />} title="Pipeline" empty="暂无 Pipeline 片段" items={graph.pipelines.sourceBreakdown.map((source) => ({ id: source.id || source.name, title: source.name || source.type, meta: `${source.type} · ${source.status || 'unknown'}` }))} />
            <RelationList icon={<Bell className="h-4 w-4 text-primary" />} title="告警规则" empty="暂无告警规则" items={graph.alertRules.map((rule) => ({ id: rule.id, title: rule.name, meta: `${rule.severity} · ${rule.status}` }))} />
          </div>
        </div>
      ) : null}
    </DataPanel>
  );
}

function RelationList({ icon, title, items, empty }: { icon: ReactNode; title: string; items: Array<{ id: string; title: string; meta: string }>; empty: string }) {
  return (
    <div className="rounded border border-outline bg-surface-lowest">
      <div className="flex items-center gap-2 border-b border-outline px-3 py-2 text-sm font-semibold">{icon}{title}</div>
      <div className="divide-y divide-outline">
        {items.length === 0 ? <EmptyRelation label={empty} /> : items.map((item) => (
          <div key={item.id} className="px-3 py-2">
            <div className="truncate text-sm font-semibold text-on-surface">{item.title}</div>
            <div className="mt-0.5 truncate text-[11px] text-muted">{item.meta}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyRelation({ label }: { label: string }) {
  return <div className="px-3 py-4 text-sm text-muted">{label}</div>;
}
