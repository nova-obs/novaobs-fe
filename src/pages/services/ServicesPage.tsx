import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Bell, Cpu, Edit3, Eye, GitBranch, Plus, RefreshCw, Search, Server, Trash2, X, XCircle } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { StatusBadge } from '../../components/StatusBadge';
import { api } from '../../services/api';
import type { CreateServiceInput, Service, ServiceObservabilityGraph, ServiceTargetType, UpdateServiceInput } from '../../services/types';
import { graphStatItems, targetLocationSummary, targetTypeLabel } from './servicesViewModel';

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
  if (source === 'k8s') return 'K8s 同步';
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
  const [confirmDeleteServiceId, setConfirmDeleteServiceId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [targetForm, setTargetForm] = useState(emptyTargetForm);

  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ['services', filters],
    queryFn: () => api.getServices(filters),
  });

  const selectedService = data.find((svc) => svc.id === selectedServiceId) ?? null;
  const activeServiceId = selectedService?.id ?? null;
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
      setForm({ ...emptyForm });
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
      setForm({ ...emptyForm });
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

  const deleteMutation = useMutation({
    mutationFn: (svc: Service) => api.deleteService(svc.id),
    onSuccess: (_, svc) => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.removeQueries({ queryKey: ['service-observability-graph', svc.id] });
      if (selectedServiceId === svc.id) {
        setSelectedServiceId(null);
      }
      if (editingId === svc.id) {
        setEditingId(null);
        setShowForm(false);
        setForm({ ...emptyForm });
      }
      setConfirmDeleteServiceId(null);
    },
  });

  const openCreate = () => { setEditingId(null); setConfirmDeleteServiceId(null); setForm({ ...emptyForm }); setShowForm(true); };
  const openEdit = (svc: Service) => {
    setConfirmDeleteServiceId(null);
    setEditingId(svc.id);
    setForm({ name: svc.name, environment: svc.environment, displayName: svc.displayName, description: svc.description, cluster: svc.cluster, namespace: svc.namespace, ownerTeam: svc.ownerTeam, owner: svc.owner, alertRoute: svc.alertRoute, sloLevel: svc.sloLevel, identityType: svc.identityType });
    setShowForm(true);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const closeEditor = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(selectedService ? { name: selectedService.name, environment: selectedService.environment, displayName: selectedService.displayName, description: selectedService.description, cluster: selectedService.cluster, namespace: selectedService.namespace, ownerTeam: selectedService.ownerTeam, owner: selectedService.owner, alertRoute: selectedService.alertRoute, sloLevel: selectedService.sloLevel, identityType: selectedService.identityType } : { ...emptyForm });
  };

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">服务目录</h1>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold text-muted">
            <span className="status-badge border-outline bg-surface-lowest">服务</span>
            <span className="status-badge border-outline bg-surface-lowest">运行目标</span>
            <span className="status-badge border-outline bg-surface-lowest">日志路由</span>
            <span className="status-badge border-outline bg-surface-lowest">告警规则</span>
          </div>
        </div>
      </div>

      {error ? (
        <DataPanel title="加载失败" meta="error">
          <div className="flex items-center gap-3 py-4">
            <XCircle className="h-5 w-5 text-danger" />
            <p className="text-sm text-muted">{(error as Error).message || '无法加载服务列表'}</p>
            <button className="console-button console-button-primary" onClick={() => refetch()}>重试</button>
          </div>
        </DataPanel>
      ) : (
        <>
          <DataPanel
            title="服务清单"
            meta={isLoading ? '加载中' : '服务真值与观测关系入口'}
          >
            {deleteMutation.error ? (
              <div className="console-notice console-notice-danger mb-3">
                <XCircle className="h-4 w-4" />{(deleteMutation.error as Error).message}
              </div>
            ) : null}
            <div className="console-list-toolbar -mx-3 -mt-3 mb-3">
              <div className="console-list-toolbar-actions">
                <button className="console-button console-button-primary" onClick={openCreate}>
                  <Plus className="h-3.5 w-3.5" />
                  新增服务
                </button>
                <button className="console-button" onClick={() => refetch()} disabled={isLoading}>
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  刷新
                </button>
                <select className="console-input h-8 w-28 text-xs" value={filters.environment} onChange={(e) => setFilters({ ...filters, environment: e.target.value })} aria-label="按环境筛选服务">
                  <option value="">全部环境</option>
                  <option value="prod">prod</option>
                  <option value="staging">staging</option>
                  <option value="dev">dev</option>
                </select>
                <select className="console-input h-8 w-28 text-xs" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} aria-label="按状态筛选服务">
                  <option value="">全部状态</option>
                  <option value="active">active</option>
                  <option value="pending">pending</option>
                  <option value="degraded">degraded</option>
                </select>
                <select className="console-input h-8 w-32 text-xs" value={filters.source} onChange={(e) => setFilters({ ...filters, source: e.target.value })} aria-label="按来源筛选服务">
                  <option value="">全部来源</option>
                  <option value="manual">本地录入</option>
                  <option value="cmdb">CMDB</option>
                  <option value="k8s">K8s 同步</option>
                </select>
              </div>
              <label className="console-list-toolbar-search sm:w-[340px]">
                <span className="sr-only">搜索服务</span>
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                <input className="console-input h-8 w-full pl-8" placeholder="名称 / CMDB ID / 业务 / 负责人…" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
              </label>
            </div>
            {isLoading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted"><RefreshCw className="h-4 w-4 animate-spin" />加载中...</div>
            ) : data.length === 0 ? (
              <div className="console-empty-state">
                <p className="text-sm text-muted">服务清单为空</p>
                <button className="console-button console-button-primary" onClick={openCreate}><Plus className="h-3.5 w-3.5" />新增服务</button>
              </div>
            ) : (
              <div className="console-resource-list">
                <table className="console-table min-w-[1200px] w-full">
                  <thead>
                    <tr>
                      <th>服务</th>
                      <th>环境</th>
                      <th>定位</th>
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
                      <tr key={svc.id} className={`cursor-pointer ${svc.id === activeServiceId ? 'console-selected-row' : ''}`} onClick={() => { setConfirmDeleteServiceId(null); setSelectedServiceId(svc.id); }}>
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
                          <div className="flex items-center gap-1">
                            <button aria-label="编辑服务" title="编辑服务" className="console-icon-button h-7 w-7" onClick={(event) => { event.stopPropagation(); openEdit(svc); }}><Edit3 className="h-3.5 w-3.5" /></button>
                            <button aria-label="查看观测关系" title="查看观测关系" className="console-icon-button h-7 w-7" onClick={(event) => { event.stopPropagation(); setConfirmDeleteServiceId(null); setSelectedServiceId(svc.id); }}><Eye className="h-3.5 w-3.5" /></button>
                            <button
                              aria-label={confirmDeleteServiceId === svc.id ? `确认删除服务 ${svc.name}` : `删除服务 ${svc.name}`}
                              title={confirmDeleteServiceId === svc.id ? '确认删除服务' : '删除服务'}
                              className={`inline-flex items-center rounded border px-1.5 py-1 text-xs font-semibold ${confirmDeleteServiceId === svc.id ? 'console-danger-zone' : ''} ${
                                confirmDeleteServiceId === svc.id
                                  ? 'border-red-500/30 bg-red-50 text-red-600'
                                  : 'border-transparent text-muted hover:border-red-500/20 hover:bg-red-50 hover:text-red-600'
                              }`}
                              disabled={deleteMutation.isPending && confirmDeleteServiceId === svc.id}
                              onClick={(event) => {
                                event.stopPropagation();
                                if (confirmDeleteServiceId === svc.id) {
                                  deleteMutation.mutate(svc);
                                  return;
                                }
                                setConfirmDeleteServiceId(svc.id);
                              }}
                            >
                              {deleteMutation.isPending && confirmDeleteServiceId === svc.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                              {confirmDeleteServiceId === svc.id ? <span className="ml-1">确认</span> : null}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataPanel>

          {selectedService ? (
            <ServiceDetailDrawer
              service={selectedService}
              graph={graph}
              loading={graphLoading}
              error={graphError as Error | null}
              targetForm={targetForm}
              setTargetForm={setTargetForm}
              onCreateTarget={() => createTargetMutation.mutate()}
              creatingTarget={createTargetMutation.isPending}
              createTargetError={createTargetMutation.error as Error | null}
              onEdit={() => openEdit(selectedService)}
              onClose={() => setSelectedServiceId(null)}
            />
          ) : null}
          {showForm ? (
            <ServiceEditorDrawer
              editing={Boolean(editingId)}
              editingId={editingId}
              form={form}
              setForm={setForm}
              pending={isPending}
              createError={createMutation.error as Error | null}
              updateError={updateMutation.error as Error | null}
              onSave={() => (editingId ? updateMutation.mutate() : createMutation.mutate())}
              onClose={closeEditor}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function ServiceDetailDrawer({
  service,
  graph,
  loading,
  error,
  targetForm,
  setTargetForm,
  onCreateTarget,
  creatingTarget,
  createTargetError,
  onEdit,
  onClose,
}: {
  service: Service;
  graph?: ServiceObservabilityGraph;
  loading: boolean;
  error: Error | null;
  targetForm: typeof emptyTargetForm;
  setTargetForm: (value: typeof emptyTargetForm) => void;
  onCreateTarget: () => void;
  creatingTarget: boolean;
  createTargetError: Error | null;
  onEdit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-slate-900/24">
      <button type="button" className="absolute inset-0 cursor-default border-0 bg-transparent" aria-label="关闭服务详情遮罩" onClick={onClose} />
      <aside className="console-drawer-panel console-detail-rail relative flex h-full w-full max-w-[860px] flex-col border-l border-outline bg-white shadow-[0_20px_60px_rgba(24,52,96,0.22)]" role="dialog" aria-modal="true" aria-labelledby="service-detail-title">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-outline bg-surface-lowest px-4 py-3">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <div id="service-detail-title" className="truncate text-sm font-semibold text-on-surface">{service.displayName || service.name}</div>
              <span className="rounded border border-outline bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">{service.environment || '-'}</span>
              <StatusBadge value={service.status || 'unknown'} />
            </div>
            <div className="mt-1 truncate font-mono text-[11px] text-muted">{service.id}</div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button className="console-button" onClick={onEdit}>
              <Edit3 className="h-3.5 w-3.5" />
              编辑
            </button>
            <button className="console-icon-button border-outline bg-white" onClick={onClose} aria-label="关闭服务详情" title="关闭">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-auto bg-surface px-4 py-4">
          <ServiceProductionDetails service={service} />
          <ServiceGraphPanel
            graph={graph}
            loading={loading}
            error={error}
            targetForm={targetForm}
            setTargetForm={setTargetForm}
            onCreateTarget={onCreateTarget}
            creatingTarget={creatingTarget}
            createTargetError={createTargetError}
          />
        </div>
      </aside>
    </div>
  );
}

function ServiceProductionDetails({ service }: { service: Service }) {
  return (
    <section className="overflow-hidden rounded-md border border-outline bg-white">
      <div className="flex items-center justify-between border-b border-outline px-4 py-3">
        <div className="text-sm font-semibold text-on-surface">生产配置</div>
        <span className="text-[11px] font-semibold text-muted">服务真值</span>
      </div>
      <div className="grid gap-x-6 gap-y-3 px-4 py-3 md:grid-cols-3">
        <ServiceDetailCell label="名称" value={service.name} />
        <ServiceDetailCell label="别名" value={service.displayName || '-'} />
        <ServiceDetailCell label="环境" value={service.environment || '-'} mono />
        <ServiceDetailCell label="定位" value={service.cluster ? `${service.cluster}${service.namespace ? ` / ${service.namespace}` : ''}` : '-'} mono />
        <ServiceDetailCell label="Owner" value={service.ownerTeam || service.owner ? `${service.ownerTeam || '-'}${service.owner ? ` / ${service.owner}` : ''}` : '-'} />
        <ServiceDetailCell label="来源" value={sourceLabel(service.source)} />
        <ServiceDetailCell label="同步" value={syncLabel(service.syncStatus)} />
        <ServiceDetailCell label="告警路由" value={service.alertRoute || '-'} mono />
        <ServiceDetailCell label="运行身份" value={service.identityType || 'k8s_workload'} mono />
      </div>
    </section>
  );
}

function ServiceDetailCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-semibold text-muted">{label}</div>
      <div className={`mt-1 truncate text-sm font-semibold text-on-surface ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}

function ServiceEditorDrawer({
  editing,
  editingId,
  form,
  setForm,
  pending,
  createError,
  updateError,
  onSave,
  onClose,
}: {
  editing: boolean;
  editingId: string | null;
  form: CreateServiceInput & { description?: string };
  setForm: (value: CreateServiceInput & { description?: string }) => void;
  pending: boolean;
  createError: Error | null;
  updateError: Error | null;
  onSave: () => void;
  onClose: () => void;
}) {
  const disabledReason = !form.name || !form.environment ? '请先填写服务名称和环境' : undefined;
  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-slate-900/28">
      <button type="button" className="absolute inset-0 cursor-default border-0 bg-transparent" aria-label="关闭服务编辑遮罩" onClick={onClose} />
      <aside className="console-drawer-panel relative flex h-full w-full max-w-[760px] flex-col border-l border-outline bg-white shadow-[0_20px_60px_rgba(24,52,96,0.24)]" role="dialog" aria-modal="true" aria-labelledby="service-editor-title">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-outline bg-surface-lowest px-4 py-3">
          <div className="min-w-0">
            <div id="service-editor-title" className="truncate text-sm font-semibold text-on-surface">{editing ? '编辑服务' : '新增服务'}</div>
            <div className="mt-1 truncate font-mono text-[11px] text-muted">{editingId ?? 'create draft'}</div>
          </div>
          <button className="console-icon-button border-outline bg-white" onClick={onClose} aria-label="关闭服务编辑" title="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-surface px-4 py-4">
          <section className="rounded-md border border-outline bg-white px-4 py-3">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm font-semibold">服务名称 *<input className="console-input mt-2 w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label className="text-sm font-semibold">环境 *<select className="console-input mt-2 w-full" value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value })}><option value="prod">prod</option><option value="staging">staging</option><option value="dev">dev</option></select></label>
              <label className="text-sm font-semibold">别名<input className="console-input mt-2 w-full" value={form.displayName ?? ''} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></label>
              <label className="text-sm font-semibold">集群<input className="console-input mt-2 w-full" value={form.cluster ?? ''} onChange={(e) => setForm({ ...form, cluster: e.target.value })} /></label>
              <label className="text-sm font-semibold">Namespace<input className="console-input mt-2 w-full" value={form.namespace ?? ''} onChange={(e) => setForm({ ...form, namespace: e.target.value })} /></label>
              <label className="text-sm font-semibold">Owner Team<input className="console-input mt-2 w-full" value={form.ownerTeam ?? ''} onChange={(e) => setForm({ ...form, ownerTeam: e.target.value })} /></label>
              <label className="text-sm font-semibold">Owner<input className="console-input mt-2 w-full" value={form.owner ?? ''} onChange={(e) => setForm({ ...form, owner: e.target.value })} /></label>
              <label className="text-sm font-semibold">告警路由<input className="console-input mt-2 w-full" value={form.alertRoute ?? ''} onChange={(e) => setForm({ ...form, alertRoute: e.target.value })} /></label>
              <label className="text-sm font-semibold">SLO Level<input className="console-input mt-2 w-full" value={form.sloLevel ?? ''} onChange={(e) => setForm({ ...form, sloLevel: e.target.value })} /></label>
              <label className="text-sm font-semibold">运行身份<select className="console-input mt-2 w-full" value={form.identityType ?? 'k8s_workload'} onChange={(e) => setForm({ ...form, identityType: e.target.value as typeof form.identityType })}><option value="k8s_workload">K8s Workload</option><option value="host_process">物理机 / VM 进程</option></select></label>
            </div>
            {createError ? <p className="console-notice console-notice-danger mt-3">{createError.message}</p> : null}
            {updateError ? <p className="console-notice console-notice-danger mt-3">{updateError.message}</p> : null}
          </section>
        </div>
        <div className="console-action-bar shrink-0">
          <div className="min-w-0 text-xs text-muted">{disabledReason ?? (editing ? `正在编辑 ${editingId}` : '保存后创建新的服务真值')}</div>
          <div className="flex gap-2">
            <button className="console-button" onClick={onClose}>取消</button>
            <button className="console-button console-button-primary" title={disabledReason} disabled={Boolean(disabledReason) || pending} onClick={onSave}>
              {pending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
              {editing ? '保存修改' : '创建服务'}
            </button>
          </div>
        </div>
      </aside>
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
        <div className="console-notice console-notice-danger"><XCircle className="h-4 w-4" />{error.message}</div>
      ) : graph ? (
        <div className="space-y-5">
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
                <input className="console-input w-full" placeholder="别名" value={targetForm.displayName} onChange={(e) => setTargetForm({ ...targetForm, displayName: e.target.value })} />
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
                <button className="console-button console-button-primary h-9" disabled={creatingTarget} onClick={onCreateTarget}>
                  {creatingTarget ? <RefreshCw className="mr-1 inline h-3.5 w-3.5 animate-spin" /> : null}
                  保存目标
                </button>
                {createTargetError ? <p className="console-notice console-notice-danger">{createTargetError.message}</p> : null}
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <RelationList icon={<Cpu className="h-4 w-4 text-primary" />} title="Agent" empty="暂无 Agent" items={graph.agents.map((agent) => ({ id: agent.instanceUid, title: agent.instanceUid, meta: `${agent.runtimeStatus} · ${agent.remoteConfigStatus || 'unset'}` }))} />
            <RelationList icon={<GitBranch className="h-4 w-4 text-primary" />} title="日志路由" empty="暂无日志路由" items={graph.logRoutes.routes.map((item) => ({ id: item.route.id, title: item.source?.sourceType === 'vm_file' ? item.source.pathPattern : `${item.source?.workloadKind || '-'} / ${item.source?.workloadName || '-'}`, meta: `${item.route.sourceType} · ${item.route.lastPublishStatus || item.route.status || 'unknown'}` }))} />
            <RelationList icon={<Bell className="h-4 w-4 text-primary" />} title="告警规则" empty="暂无告警规则" items={graph.alertRules.map((rule) => ({ id: rule.id, title: rule.spec.name, meta: `${rule.spec.notification.severity} · ${rule.state}` }))} />
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
