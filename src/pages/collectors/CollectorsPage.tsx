import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ExternalLink, Info, Link2, Plus, RefreshCw, Search, Trash2, Unlink, XCircle } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { StatusBadge } from '../../components/StatusBadge';
import { api } from '../../services/api';
import type { CollectorGroup, CollectorGroupMode, CollectorGroupStatus, CollectorInstance, OpAMPAgent, ReceiverProfile } from '../../services/types';

function modeLabel(mode: CollectorGroupMode) { return mode === 'shared_gateway' ? '共享 Gateway' : '独立 Collector'; }
function publishLabel(status: string) {
  const map: Record<string, string> = { none: '未发布', pending: '待发布', applying: '下发中', applied: '已生效', partial_failed: '部分失败', failed: '失败' };
  return map[status] ?? status;
}
function publishColor(status: string) {
  if (status === 'applied') return 'text-emerald-400';
  if (status === 'failed' || status === 'partial_failed') return 'text-red-400';
  if (status === 'applying' || status === 'pending') return 'text-amber-400';
  return 'text-muted';
}
function runtimeStatusLabel(s: string) { const m: Record<string, string> = { online: '在线', stale: '心跳超时', offline: '离线' }; return m[s] ?? s; }
function runtimeStatusColor(s: string) {
  if (s === 'online') return 'text-emerald-400';
  if (s === 'stale') return 'text-amber-400';
  return 'text-muted';
}

const emptyForm = {
  name: '', displayName: '', mode: 'shared_gateway' as CollectorGroupMode, environment: 'prod',
  cluster: '', namespace: '', ownerTeam: '', receiverProfile: 'mixed' as ReceiverProfile,
  exporterProfile: 'otlphttp/victorialogs', desiredReplicas: 0, maxServices: 0,
};

export function CollectorsPage({ embedded }: { embedded?: boolean }) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<{ environment: string; cluster: string; mode: string; status: CollectorGroupStatus | 'deleted' | ''; receiver_profile: ReceiverProfile | ''; q: string }>({ environment: '', cluster: '', mode: '', status: '', receiver_profile: '', q: '' });
  const [showForm, setShowForm] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const { data: groups = [], isLoading, error, refetch } = useQuery({
    queryKey: ['collector-groups', filters],
    queryFn: () => api.getCollectorGroups({
      environment: filters.environment || undefined,
      cluster: filters.cluster || undefined,
      mode: filters.mode || undefined,
      status: (filters.status || undefined) as CollectorGroupStatus | 'deleted' | undefined,
      receiver_profile: filters.receiver_profile || undefined,
      q: filters.q || undefined,
    }),
  });

  const [form, setForm] = useState(emptyForm);
  const createMutation = useMutation({
    mutationFn: () => api.createCollectorGroup({
      name: form.name, displayName: form.displayName || undefined, mode: form.mode, environment: form.environment,
      cluster: form.cluster || undefined, namespace: form.namespace || undefined, ownerTeam: form.ownerTeam || undefined,
      receiverProfile: form.receiverProfile, exporterProfile: form.exporterProfile,
      desiredReplicas: form.desiredReplicas || undefined, maxServices: form.maxServices || undefined,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['collector-groups'] }); setShowForm(false); setForm(emptyForm); },
  });

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;

  return (
    <div className="space-y-6">
      {!embedded ? (
      <div className="flex items-start justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted">
            <span>Logs</span>
            <span>/</span>
            <span>Pipelines</span>
            <span>/</span>
            <span className="text-primary">Collector Groups</span>
          </div>
          <h1 className="font-display text-2xl font-semibold text-on-surface">Collector Groups</h1>
          <p className="mt-1 text-sm text-muted">Collector Group 承载平台模板、服务增量配置、实例纳管和 Remote Config 发布状态。</p>
        </div>
        <button className="rounded bg-primary px-4 py-2 text-sm font-semibold text-white" onClick={() => { setForm(emptyForm); setShowForm(true); }}>
          <Plus className="mr-1 inline h-3.5 w-3.5" />新增 Group
        </button>
      </div>
      ) : (
      <div className="flex items-start justify-between">
        <div />
        <button className="rounded bg-primary px-4 py-2 text-sm font-semibold text-white" onClick={() => { setForm(emptyForm); setShowForm(true); }}>
          <Plus className="mr-1 inline h-3.5 w-3.5" />新增 Group
        </button>
      </div>
      )}

      {error ? (
        <DataPanel title="加载失败" meta="error">
          <div className="flex items-center gap-3 py-4">
            <XCircle className="h-5 w-5 text-red-400" />
            <p className="text-sm text-muted">{(error as Error).message || '无法加载 Collector Group 列表'}</p>
            <button className="rounded bg-primary px-3 py-1.5 text-xs font-semibold text-white" onClick={() => refetch()}>重试</button>
          </div>
        </DataPanel>
      ) : selectedGroup ? (
        <GroupDetail
          group={selectedGroup}
          onClose={() => setSelectedGroupId(null)}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['collector-groups'] })}
        />
      ) : (
        <>
          <DataPanel title="筛选" meta={isLoading ? '加载中...' : `${groups.length} 个 Group`}>
            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
              <label className="text-sm font-semibold">搜索<div className="relative mt-2"><Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" /><input className="console-input w-full pl-8" placeholder="名称…" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} /></div></label>
              <label className="text-sm font-semibold">环境<select className="console-input mt-2 w-full" value={filters.environment} onChange={(e) => setFilters({ ...filters, environment: e.target.value })}><option value="">全部</option><option value="prod">prod</option><option value="staging">staging</option><option value="dev">dev</option></select></label>
              <label className="text-sm font-semibold">集群<input className="console-input mt-2 w-full" value={filters.cluster} onChange={(e) => setFilters({ ...filters, cluster: e.target.value })} /></label>
              <label className="text-sm font-semibold">模式<select className="console-input mt-2 w-full" value={filters.mode} onChange={(e) => setFilters({ ...filters, mode: e.target.value })}><option value="">全部</option><option value="shared_gateway">共享 Gateway</option><option value="dedicated_collector">独立 Collector</option></select></label>
              <label className="text-sm font-semibold">状态<select className="console-input mt-2 w-full" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value as CollectorGroupStatus })}><option value="">全部</option><option value="active">active</option><option value="draft">draft</option><option value="draining">draining</option><option value="disabled">disabled</option><option value="deleted">deleted</option></select></label>
              <label className="text-sm font-semibold">Receiver<select className="console-input mt-2 w-full" value={filters.receiver_profile} onChange={(e) => setFilters({ ...filters, receiver_profile: e.target.value as ReceiverProfile | '' })}><option value="">全部</option><option value="otlp">OTLP</option><option value="kafka">Kafka</option><option value="syslog">Syslog</option><option value="filelog">Filelog</option><option value="mixed">Mixed</option></select></label>
            </div>
          </DataPanel>

          {showForm ? (
            <DataPanel title="新增 Collector Group" meta="new">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm font-semibold">名称 *<input className="console-input mt-2 w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                <label className="text-sm font-semibold">展示名称<input className="console-input mt-2 w-full" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></label>
                <label className="text-sm font-semibold">
                  模式 *
                  <select className="console-input mt-2 w-full" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as CollectorGroupMode })}>
                    <option value="shared_gateway">共享 Gateway</option>
                    <option value="dedicated_collector">独立 Collector</option>
                  </select>
                  <span className="mt-1 block text-[11px] leading-4 text-muted">
                    {form.mode === 'shared_gateway'
                      ? '多服务共用，适合 Kafka/syslog/OTLP 统一入口。配置发布会影响该 Group 下多个服务。'
                      : '面向单服务或单 namespace，隔离配置和资源。默认最大服务数为 1。'}
                  </span>
                </label>
                <label className="text-sm font-semibold">环境 *<select className="console-input mt-2 w-full" value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value })}><option value="prod">prod</option><option value="staging">staging</option><option value="dev">dev</option></select></label>
                <label className="text-sm font-semibold">集群<input className="console-input mt-2 w-full" value={form.cluster} onChange={(e) => setForm({ ...form, cluster: e.target.value })} /></label>
                <label className="text-sm font-semibold">Namespace<input className="console-input mt-2 w-full" value={form.namespace} onChange={(e) => setForm({ ...form, namespace: e.target.value })} /></label>
                <label className="text-sm font-semibold">Owner Team<input className="console-input mt-2 w-full" value={form.ownerTeam} onChange={(e) => setForm({ ...form, ownerTeam: e.target.value })} /></label>
                <label className="text-sm font-semibold">Receiver Profile<select className="console-input mt-2 w-full" value={form.receiverProfile} onChange={(e) => setForm({ ...form, receiverProfile: e.target.value as ReceiverProfile })}><option value="otlp">OTLP</option><option value="kafka">Kafka</option><option value="syslog">Syslog</option><option value="filelog">Filelog</option><option value="mixed">Mixed</option></select></label>
                <label className="text-sm font-semibold">Exporter Profile<input className="console-input mt-2 w-full" value={form.exporterProfile} onChange={(e) => setForm({ ...form, exporterProfile: e.target.value })} /></label>
                <label className="text-sm font-semibold">期望副本数<input className="console-input mt-2 w-full" type="number" value={form.desiredReplicas || ''} onChange={(e) => setForm({ ...form, desiredReplicas: Number(e.target.value) || 0 })} /></label>
                <label className="text-sm font-semibold">最大服务数<input className="console-input mt-2 w-full" type="number" value={form.maxServices || ''} onChange={(e) => setForm({ ...form, maxServices: Number(e.target.value) || 0 })} /></label>
              </div>
              <div className="mt-4 flex gap-2">
                <button className="rounded bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={!form.name || !form.mode || !form.environment || createMutation.isPending} onClick={() => createMutation.mutate()}>
                  {createMutation.isPending ? <RefreshCw className="mr-1 inline h-3.5 w-3.5 animate-spin" /> : null}创建 Group
                </button>
                <button className="rounded border border-outline px-4 py-2 text-sm font-semibold text-on-surface" onClick={() => setShowForm(false)}>取消</button>
              </div>
              {createMutation.error ? <p className="mt-2 text-sm text-red-400">{(createMutation.error as Error).message}</p> : null}
            </DataPanel>
          ) : null}

          <DataPanel title="Group 列表" meta={`${groups.length} 个 Group（点击行查看详情）`}>
            {isLoading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted"><RefreshCw className="h-4 w-4 animate-spin" />加载中...</div>
            ) : groups.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <p className="text-sm text-muted">暂无 Collector Group，请创建一个。</p>
                <button className="rounded bg-primary px-4 py-2 text-sm font-semibold text-white" onClick={() => { setForm(emptyForm); setShowForm(true); }}><Plus className="mr-1 inline h-3.5 w-3.5" />新增 Group</button>
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="console-table min-w-[1400px] w-full">
                  <thead>
                    <tr>
                      <th>名称</th>
                      <th>模式</th>
                      <th>环境/集群/NS</th>
                      <th>Receiver</th>
                      <th>实例</th>
                      <th>服务容量</th>
                      <th>发布状态</th>
                      <th>配置版本</th>
                      <th>更新时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group) => (
                      <tr key={group.id} className="cursor-pointer bg-surface-lowest hover:bg-surface-low" onClick={() => setSelectedGroupId(group.id)}>
                        <td>
                          <div className="font-semibold text-primary">{group.name}</div>
                          {group.displayName ? <div className="text-[11px] text-muted">{group.displayName}</div> : null}
                        </td>
                        <td className="text-xs">{modeLabel(group.mode)}</td>
                        <td className="font-mono text-xs">{group.environment} / {group.cluster || '-'} / {group.namespace || '-'}</td>
                        <td className="text-xs">{group.receiverProfile} → {group.exporterProfile}</td>
                        <td className="font-mono text-xs">
                          <span className="text-emerald-400">{group.onlineInstances ?? 0} online</span>
                          {' / '}<span>{group.healthyInstances ?? 0} healthy</span>
                          {group.instanceCount ? <> / <span className="text-muted">{group.instanceCount} total</span></> : null}
                        </td>
                        <td className="font-mono text-xs">{group.maxServices || '-'}</td>
                        <td>
                          <span className={`text-xs font-semibold ${publishColor(group.lastPublishStatus)}`}>{publishLabel(group.lastPublishStatus)}</span>
                          {group.lastPublishMessage ? <div className="text-[11px] text-muted truncate max-w-[120px]">{group.lastPublishMessage}</div> : null}
                        </td>
                        <td className="font-mono text-[10px] text-muted">
                          {group.desiredConfigHash ? <div>desired: {group.desiredConfigHash.slice(0, 12)}</div> : null}
                          {group.lastAppliedConfigHash ? <div>applied: {group.lastAppliedConfigHash.slice(0, 12)}</div> : null}
                          {!group.desiredConfigHash && !group.lastAppliedConfigHash ? '-' : null}
                        </td>
                        <td className="font-mono text-xs text-muted">{group.updatedAt ? group.updatedAt.replace('T', ' ').replace('Z', '') : '-'}</td>
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

function GroupDetail({ group, onClose, onRefresh }: { group: CollectorGroup; onClose: () => void; onRefresh: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: instances = [], isLoading: instLoading, error: instError, refetch: refetchInst } = useQuery({
    queryKey: ['collector-instances', group.id],
    queryFn: () => api.getCollectorInstances(group.id),
  });

  const { data: configVersions = [], isLoading: cvLoading } = useQuery({
    queryKey: ['collector-config-versions', group.id],
    queryFn: () => api.getCollectorGroupConfigVersions(group.id),
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['opamp-agents'],
    queryFn: () => api.getOpAMPAgents(),
    refetchInterval: 10000,
  });

  const unassignedAgents = agents.filter((a: OpAMPAgent) => !a.collectorGroupId || a.collectorGroupId === '');

  const bindMutation = useMutation({
    mutationFn: (instanceUid: string) => api.assignInstanceGroup(instanceUid, group.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collector-instances', group.id] });
      queryClient.invalidateQueries({ queryKey: ['opamp-agents'] });
      onRefresh();
    },
  });

  const unbindMutation = useMutation({
    mutationFn: (instanceUid: string) => api.unassignInstanceGroup(instanceUid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collector-instances', group.id] });
      queryClient.invalidateQueries({ queryKey: ['opamp-agents'] });
      onRefresh();
    },
  });

  const deleteInstMutation = useMutation({
    mutationFn: (instanceUid: string) => api.deleteCollectorInstance(instanceUid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collector-instances', group.id] });
      queryClient.invalidateQueries({ queryKey: ['opamp-agents'] });
      onRefresh();
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: () => api.deleteCollectorGroup(group.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collector-groups'] });
      onClose();
    },
  });

  const onlineCount = instances.filter((i: CollectorInstance) => i.runtimeStatus === 'online').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button className="rounded p-1 text-muted hover:bg-surface-low hover:text-on-surface" onClick={onClose}>
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="font-display text-xl font-semibold text-on-surface">{group.name}</h2>
            <p className="text-sm text-muted">{group.displayName || group.id} · {modeLabel(group.mode)} · {group.environment}</p>
          </div>
        </div>
        {!confirmDelete ? (
          <button className="flex items-center gap-1 rounded border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-900/10" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-3.5 w-3.5" />删除 Group
          </button>
        ) : (
          <div className="flex items-center gap-2 rounded border border-red-500/30 bg-red-900/10 px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <span className="text-xs text-red-400">确认删除？此操作不可撤销。</span>
            <button className="rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-60" disabled={deleteGroupMutation.isPending} onClick={() => deleteGroupMutation.mutate()}>确认</button>
            <button className="rounded border border-outline px-2 py-1 text-xs font-semibold text-on-surface" onClick={() => setConfirmDelete(false)}>取消</button>
          </div>
        )}
      </div>

      {deleteGroupMutation.error ? (
        <div className="rounded border border-red-500/30 bg-red-900/10 p-4">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-400" />
            <span className="text-sm font-semibold text-red-400">无法删除 Group</span>
          </div>
          <p className="mt-2 text-sm text-muted">{(deleteGroupMutation.error as Error).message}</p>
          <p className="mt-1 text-xs text-muted">请先处理以上依赖后重试：解除服务接入引用、解绑或删除实例、确认没有未完成发布。</p>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <DataPanel title="实例列表" meta={`${instances.length} 个实例 · ${onlineCount} online`}>
            {instLoading ? (
              <div className="flex items-center gap-2 py-3 text-sm text-muted"><RefreshCw className="h-4 w-4 animate-spin" />加载中...</div>
            ) : instError ? (
              <div className="flex items-center gap-2 py-3 text-sm text-red-400"><XCircle className="h-4 w-4" />加载失败 <button className="text-primary underline" onClick={() => refetchInst()}>重试</button></div>
            ) : instances.length === 0 ? (
              <p className="py-3 text-sm text-muted">暂无实例归属于此 Group。</p>
            ) : (
              <div className="overflow-auto">
                <table className="console-table min-w-[750px] w-full">
                  <thead>
                    <tr>
                      <th>Instance UID</th>
                      <th>Host / Pod</th>
                      <th>运行状态</th>
                      <th>健康</th>
                      <th>Remote Config</th>
                      <th>Config Hash</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {instances.map((inst: CollectorInstance) => (
                      <tr key={inst.id} className="bg-surface-lowest">
                        <td className="font-mono text-xs text-primary" title={inst.instanceUid}>{inst.instanceUid.slice(0, 16)}…</td>
                        <td className="text-xs">{inst.hostname || inst.podName || '-'}</td>
                        <td><span className={`text-xs font-semibold ${runtimeStatusColor(inst.runtimeStatus)}`}>{runtimeStatusLabel(inst.runtimeStatus)}{inst.lastSeenAgeSeconds < Infinity ? ` (${inst.lastSeenAgeSeconds}s)` : ''}</span></td>
                        <td>{inst.healthy ? <span className="text-xs text-emerald-400">healthy</span> : <span className="text-xs text-muted">unhealthy</span>}</td>
                        <td><span className={`text-xs ${inst.remoteConfigStatus === 'applied' ? 'text-emerald-400' : inst.remoteConfigStatus === 'failed' ? 'text-red-400' : 'text-muted'}`}>{inst.remoteConfigStatus}</span></td>
                        <td className="font-mono text-[10px] text-muted">{inst.lastConfigHash ? inst.lastConfigHash.slice(0, 12) : '-'}</td>
                        <td>
                          <div className="flex gap-1">
                            <button className="rounded p-1 text-muted hover:bg-surface-low hover:text-primary" title="详情" onClick={() => navigate(`/collectors/agents/${inst.instanceUid}`)}><ExternalLink className="h-3.5 w-3.5" /></button>
                            <button className="rounded p-1 text-muted hover:bg-surface-low hover:text-amber-400" title="解绑" onClick={() => unbindMutation.mutate(inst.instanceUid)} disabled={unbindMutation.isPending}><Unlink className="h-3.5 w-3.5" /></button>
                            {inst.runtimeStatus !== 'online' ? (
                              <button className="rounded p-1 text-muted hover:bg-surface-low hover:text-red-400" title="删除记录" onClick={() => deleteInstMutation.mutate(inst.instanceUid)} disabled={deleteInstMutation.isPending}><Trash2 className="h-3.5 w-3.5" /></button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {(unbindMutation.error || deleteInstMutation.error) ? (
              <p className="mt-2 text-xs text-red-400">{((unbindMutation.error || deleteInstMutation.error) as Error).message}</p>
            ) : null}
          </DataPanel>

          <DataPanel title="接入说明" meta="Gateway 搭建步骤">
            <ol className="list-inside list-decimal space-y-1 text-xs text-muted">
              <li>创建 <span className="font-semibold text-primary">shared_gateway</span> Group。</li>
              <li>部署一组 OTel Collector，启用 OpAMP extension。</li>
              <li>Collector 启动后连接平台，在<span className="text-primary">未归属 Agent</span>中出现。</li>
              <li>将 Agent <span className="text-primary">绑定</span>到该 Group。</li>
              <li>在<span className="text-primary">服务接入</span>页面选择该 Group 完成服务接入。</li>
              <li>在 Logs / Pipelines <span className="text-primary">发布配置</span>后，Group 内 Collector 自动收到 remote config。</li>
            </ol>
          </DataPanel>
        </div>

        <div className="space-y-4">
          {unassignedAgents.length > 0 ? (
            <DataPanel title="未归属 Agent" meta={`${unassignedAgents.length} 个可绑定`}>
              <div className="space-y-2 max-h-60 overflow-auto">
                {unassignedAgents.map((agent: OpAMPAgent) => (
                  <div key={agent.instanceUid} className="flex items-center justify-between rounded border border-outline bg-surface-lowest p-3">
                    <div>
                      <div className="font-mono text-xs text-on-surface">{agent.instanceUid}</div>
                      <div className="text-[11px] text-muted">
                        <span className={runtimeStatusColor(agent.runtimeStatus)}>{runtimeStatusLabel(agent.runtimeStatus)}</span>
                        {agent.remoteConfigStatus ? <> · {agent.remoteConfigStatus}</> : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="rounded p-1 text-muted hover:bg-surface-low hover:text-primary"
                        title="详情"
                        onClick={() => navigate(`/collectors/agents/${agent.instanceUid}`)}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                        disabled={bindMutation.isPending}
                        onClick={() => bindMutation.mutate(agent.instanceUid)}
                      >
                        <Link2 className="h-3 w-3" />绑定到 {group.name}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {bindMutation.error ? <p className="mt-2 text-xs text-red-400">{(bindMutation.error as Error).message}</p> : null}
            </DataPanel>
          ) : (
            <div className="rounded border border-outline bg-surface-lowest p-4">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-muted mt-0.5" />
                <div>
                  <p className="text-sm text-on-surface">无可绑定 Instance</p>
                  <p className="mt-1 text-xs text-muted">请部署 OTel Collector 并配置 OpAMP endpoint 指向本平台。Collector 启动后会自动出现在此处。</p>
                </div>
              </div>
            </div>
          )}

          <DataPanel title="配置版本历史" meta={`${configVersions.length} 条`}>
            {cvLoading ? (
              <div className="flex items-center gap-2 py-3 text-sm text-muted"><RefreshCw className="h-4 w-4 animate-spin" />加载中...</div>
            ) : configVersions.length === 0 ? (
              <p className="py-3 text-sm text-muted">暂无配置版本记录。</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-auto">
                {configVersions.map((cv) => (
                  <div key={cv.id} className="rounded border border-outline bg-surface-lowest p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-primary">v{cv.version}</span>
                      <span className={`text-xs font-semibold ${publishColor(cv.status)}`}>{publishLabel(cv.status)}</span>
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-muted">{cv.configHash.slice(0, 16)}</div>
                    <div className="flex gap-2 text-[10px] text-muted">
                      <span>{cv.createdAt ? cv.createdAt.replace('T', ' ').replace('Z', '') : ''}</span>
                      {cv.message ? <span>· {cv.message}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DataPanel>

          <DataPanel title="配置入口" meta="Config Sources">
            <p className="py-3 text-sm text-muted">配置编辑已收敛到 Logs / Pipelines / Config。服务接入继续绑定到 Group，发布前会按平台模板、Group Override、服务 Enrichment 和业务 Patch 渲染最终配置。</p>
          </DataPanel>
        </div>
      </div>
    </div>
  );
}
