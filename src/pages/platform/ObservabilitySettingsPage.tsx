import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, Eye, Gauge, HelpCircle, Layers, Pencil, Plus, RefreshCw, Save, Search, X } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { StatusBadge } from '../../components/StatusBadge';
import { k8sApi } from '../k8s/api';
import { logSinkLabel, logsApi, type LogEndpoint, type LogSinkType } from '../logs/api';

const emptyEndpoint = {
  name: '',
  description: '',
  sinkType: 'vl' as LogSinkType,
  streamName: '',
  writeURL: '',
  queryURL: '',
  vmuiURL: '',
  accountId: '',
  projectId: '',
  secretRef: '',
  scopeType: 'global',
  clusterId: '',
  status: 'active',
};

const sinkOptions: Array<{ value: LogSinkType; label: string }> = [
  { value: 'vl', label: 'VictoriaLogs' },
  { value: 'otel', label: 'OTel / OTLP' },
  { value: 'es', label: 'Elasticsearch' },
  { value: 'kafka', label: 'Kafka' },
];

type EndpointFormState = typeof emptyEndpoint;

function createEmptyEndpoint(): EndpointFormState {
  return { ...emptyEndpoint };
}

export function endpointOperationProfile(endpoint: Partial<LogEndpoint>, registeredClusterIds?: Set<string>) {
  const blockers: string[] = [];
  const strengths: string[] = [];
  let score = 0;
  const status = endpoint.status || 'active';
  const sinkType = endpoint.sinkType || 'vl';
  const scopeType = endpoint.scopeType || 'global';
  const clusterId = endpoint.clusterId || '';
  const runtimeCapable = sinkType === 'vl' && scopeType === 'k8s_cluster' && Boolean(clusterId);

  if (status === 'disabled') {
    blockers.push('端点已停用');
  } else {
    score += 1;
    strengths.push('端点启用');
  }

  if (endpoint.writeURL) {
    score += 1;
    strengths.push('写入地址已配置');
  } else {
    blockers.push('缺少写入地址');
  }

  if (sinkType === 'vl') {
    if (endpoint.queryURL && endpoint.vmuiURL) {
      score += 1;
      strengths.push('查询与 VMUI 完整');
    } else {
      blockers.push('缺少查询或 VMUI 地址');
    }
  } else if (sinkType === 'kafka') {
    if (endpoint.streamName) {
      score += 1;
      strengths.push('Topic 已配置');
    } else {
      blockers.push('缺少 Topic');
    }
  } else {
    score += 1;
    strengths.push('协议字段完整');
  }

  if (scopeType === 'k8s_cluster') {
    if (!clusterId) {
      blockers.push('缺少绑定集群');
    } else if (registeredClusterIds && !registeredClusterIds.has(clusterId)) {
      blockers.push('绑定集群未登记');
    } else {
      score += 1;
      strengths.push('作用域已绑定');
    }
  } else {
    score += 1;
    strengths.push(scopeType === 'vm' ? 'VM 专用作用域' : '全局作用域');
  }

  if (runtimeCapable) {
    score += 1;
    strengths.push('K8s 作用域完整');
  } else if (endpoint.secretRef) {
    score += 1;
    strengths.push('凭据引用已配置');
  } else if (sinkType === 'vl' && endpoint.accountId && endpoint.projectId) {
    score += 1;
    strengths.push('租户已配置');
  } else if (sinkType === 'otel') {
    score += 1;
    strengths.push('OTLP 写入协议');
  }

  const tone: 'success' | 'warning' | 'danger' = blockers.length === 0 ? 'success' : score >= 3 ? 'warning' : 'danger';
  return {
    score,
    scoreLabel: `${score}/5`,
    blockers,
    strengths,
    runtimeCapable,
    tone,
    label: blockers.length === 0 ? '可操作' : '需补齐',
  };
}

export function sortEndpointsForList<T extends Partial<LogEndpoint>>(endpoints: T[], registeredClusterIds?: Set<string>): T[] {
  return [...endpoints].sort((left, right) => {
    const leftActive = (left.status || 'active') !== 'disabled';
    const rightActive = (right.status || 'active') !== 'disabled';
    if (leftActive !== rightActive) return leftActive ? -1 : 1;
    const leftProfile = endpointOperationProfile(left, registeredClusterIds);
    const rightProfile = endpointOperationProfile(right, registeredClusterIds);
    if (leftProfile.score !== rightProfile.score) return rightProfile.score - leftProfile.score;
    const leftUpdated = Date.parse(left.updatedAt || '');
    const rightUpdated = Date.parse(right.updatedAt || '');
    if (!Number.isNaN(leftUpdated) && !Number.isNaN(rightUpdated) && leftUpdated !== rightUpdated) {
      return rightUpdated - leftUpdated;
    }
    return String(left.name || '').localeCompare(String(right.name || ''));
  });
}

export function ObservabilitySettingsPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [selectedEndpointId, setSelectedEndpointId] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'closed' | 'create' | 'edit'>('closed');
  const [form, setForm] = useState(() => createEmptyEndpoint());
  const endpointsQuery = useQuery({ queryKey: ['logs-endpoints'], queryFn: () => logsApi.listEndpoints(), retry: false });
  const clustersQuery = useQuery({ queryKey: ['k8s-clusters'], queryFn: () => k8sApi.listClusters(), retry: false });
  const endpoints = endpointsQuery.data ?? [];
  const clusters = clustersQuery.data ?? [];
  const selectedEndpoint = endpoints.find((item) => item.id === selectedEndpointId) ?? null;
  const creatingEndpoint = editorMode === 'create';
  const editingEndpoint = editorMode === 'edit';
  const registeredClusterIds = useMemo(() => new Set(clusters.map((cluster) => cluster.id)), [clusters]);
  const endpointClusterBlockedReason = form.scopeType !== 'k8s_cluster'
    ? ''
    : clustersQuery.isLoading
      ? '正在加载已登记 K8s 集群'
      : clustersQuery.error
        ? '已登记 K8s 集群加载失败'
      : !form.clusterId.trim()
        ? '请选择已登记的 K8s 集群'
        : !registeredClusterIds.has(form.clusterId)
          ? '日志端点只能绑定已登记的 K8s 集群'
          : '';
  const filteredEndpoints = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return endpoints;
    return endpoints.filter((endpoint) => `${endpoint.name} ${endpoint.sinkType} ${endpoint.scopeType} ${endpoint.clusterId} ${endpoint.writeURL} ${endpoint.streamName}`.toLowerCase().includes(keyword));
  }, [endpoints, query]);
  const clusterRegistry = clustersQuery.isSuccess ? registeredClusterIds : undefined;
  const listedEndpoints = useMemo(() => sortEndpointsForList(filteredEndpoints, clusterRegistry), [clusterRegistry, filteredEndpoints]);
  const formProfile = useMemo(() => endpointOperationProfile({ ...form, id: selectedEndpoint?.id ?? '', updatedAt: selectedEndpoint?.updatedAt ?? '' }, clusterRegistry), [clusterRegistry, form, selectedEndpoint?.id, selectedEndpoint?.updatedAt]);
  const selectedProfile = useMemo(() => selectedEndpoint ? endpointOperationProfile(selectedEndpoint, clusterRegistry) : null, [clusterRegistry, selectedEndpoint]);
  const missing = endpointMissingFields(form);
  const formSaved = Boolean(editingEndpoint && selectedEndpoint && endpointFormMatchesEndpoint(form, selectedEndpoint));
  const canSubmit = editorMode !== 'closed' && missing.length === 0 && !endpointClusterBlockedReason && !formSaved;

  useEffect(() => {
    if (!selectedEndpointId || endpointsQuery.isFetching) return;
    if (endpoints.some((endpoint) => endpoint.id === selectedEndpointId)) return;
    setSelectedEndpointId('');
    setDetailOpen(false);
    if (editingEndpoint) {
      setEditorMode('closed');
      setForm(createEmptyEndpoint());
    }
  }, [editingEndpoint, endpoints, endpointsQuery.isFetching, selectedEndpointId]);

  const saveMutation = useMutation({
    mutationFn: () => editingEndpoint && selectedEndpoint
      ? logsApi.updateEndpoint(selectedEndpoint.id, form)
      : logsApi.createEndpoint(form),
    onSuccess: async (endpoint) => {
      await queryClient.invalidateQueries({ queryKey: ['logs-endpoints'] });
      await queryClient.invalidateQueries({ queryKey: ['logs-workspace'] });
      setEditorMode('closed');
      setSelectedEndpointId(endpoint.id);
      setDetailOpen(true);
      setForm(endpointToForm(endpoint));
    },
  });

  function startCreate() {
    setEditorMode('create');
    setDetailOpen(false);
    setForm(createEmptyEndpoint());
  }

  function openEndpointDetail(endpoint: LogEndpoint) {
    setEditorMode('closed');
    setSelectedEndpointId(endpoint.id);
    setDetailOpen(true);
    setForm(endpointToForm(endpoint));
  }

  function startEdit(endpoint = selectedEndpoint) {
    if (!endpoint) return;
    setSelectedEndpointId(endpoint.id);
    setDetailOpen(false);
    setEditorMode('edit');
    setForm(endpointToForm(endpoint));
  }

  function closeEndpointEditor() {
    setEditorMode('closed');
    if (selectedEndpoint) {
      setForm(endpointToForm(selectedEndpoint));
    } else {
      setForm(createEmptyEndpoint());
    }
  }

  return (
    <div className="space-y-4">
      <DataPanel
        title="接入端点"
        meta={endpointsQuery.isLoading ? '加载日志下游端点' : '日志写入地址、作用域和查询能力'}
        action={(
          <div className="flex w-full flex-wrap items-center justify-end gap-2 md:w-auto">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <input className="console-input h-9 w-full pl-8 text-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索端点、URL、集群或 Topic" />
            </div>
            <button className="console-button" onClick={() => endpointsQuery.refetch()} disabled={endpointsQuery.isFetching} aria-label="刷新日志下游端点">
              {endpointsQuery.isFetching ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              刷新
            </button>
            <button className="console-button console-button-primary" onClick={startCreate}>
              <Plus className="h-3.5 w-3.5" />
              新增端点
            </button>
          </div>
        )}
      >
        <div className="overflow-hidden rounded-md border border-outline bg-surface-lowest">
          {endpointsQuery.error ? (
            <div className="p-3"><InlineNotice tone="danger" message={(endpointsQuery.error as Error).message} /></div>
          ) : listedEndpoints.length === 0 ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 px-6 py-12 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-outline bg-white text-primary">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-on-surface">{query.trim() ? '未找到匹配的日志下游端点' : '暂无日志下游端点'}</div>
                <div className="mt-1 text-xs text-muted">{query.trim() ? '调整关键词后再查看列表。' : '新增端点后，采集路由才能选择写入目标。'}</div>
              </div>
              {!query.trim() ? (
                <button className="console-button console-button-primary" onClick={startCreate}>
                  <Plus className="h-3.5 w-3.5" />
                  新增端点
                </button>
              ) : null}
            </div>
          ) : (
            <div className="max-h-[70vh] overflow-auto">
              <table className="console-table w-full min-w-[1180px] table-fixed">
                <thead>
                  <tr>
                    <th className="w-[180px]">端点</th>
                    <th className="w-[96px]">类型</th>
                    <th className="w-[96px]">状态</th>
                    <th className="w-[190px]">作用域</th>
                    <th>写入地址</th>
                    <th className="w-[190px]">查询能力</th>
                    <th className="w-[140px]">完整度</th>
                    <th className="w-[150px]">更新时间</th>
                    <th className="w-[96px] text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {listedEndpoints.map((endpoint) => (
                    <EndpointTableRow
                      key={endpoint.id}
                      endpoint={endpoint}
                      selected={detailOpen && endpoint.id === selectedEndpointId}
                      profile={endpointOperationProfile(endpoint, clusterRegistry)}
                      onView={() => openEndpointDetail(endpoint)}
                      onEdit={() => startEdit(endpoint)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DataPanel>
      {detailOpen && selectedEndpoint && selectedProfile ? (
        <EndpointDetailDrawer
          endpoint={selectedEndpoint}
          profile={selectedProfile}
          onClose={() => setDetailOpen(false)}
          onEdit={() => startEdit(selectedEndpoint)}
        />
      ) : null}
      {editorMode !== 'closed' ? (
        <EndpointEditorDrawer
          mode={editorMode}
          form={form}
          profile={formProfile}
          selectedEndpoint={selectedEndpoint}
          clusters={clusters}
          registeredClusterIds={registeredClusterIds}
          clustersLoading={clustersQuery.isLoading}
          endpointClusterBlockedReason={endpointClusterBlockedReason}
          missing={missing}
          formSaved={formSaved}
          canSubmit={canSubmit}
          saving={saveMutation.isPending}
          saveError={saveMutation.error}
          onFormChange={setForm}
          onClose={closeEndpointEditor}
          onSave={() => saveMutation.mutate()}
        />
      ) : null}
    </div>
  );
}

function EndpointDetailDrawer({ endpoint, profile, onClose, onEdit }: {
  endpoint: LogEndpoint;
  profile: ReturnType<typeof endpointOperationProfile>;
  onClose: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-slate-900/24">
      <button type="button" className="absolute inset-0 cursor-default border-0 bg-transparent" aria-label="关闭端点详情遮罩" onClick={onClose} />
      <aside className="console-drawer-panel relative flex h-full w-full max-w-[780px] flex-col border-l border-outline bg-white shadow-[0_20px_60px_rgba(24,52,96,0.22)]" role="dialog" aria-modal="true" aria-labelledby="endpoint-detail-title">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-outline bg-surface-lowest px-4 py-3">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <div id="endpoint-detail-title" className="truncate text-sm font-semibold text-on-surface">{endpoint.name}</div>
              <span className="rounded border border-outline bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">{logSinkLabel(endpoint.sinkType)}</span>
              <StatusBadge value={endpoint.status || 'active'} />
            </div>
            <div className="mt-1 truncate font-mono text-[11px] text-muted">{endpoint.id}</div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button className="console-button" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
              编辑
            </button>
            <button className="console-icon-button border-outline bg-white" onClick={onClose} aria-label="关闭端点详情" title="关闭">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-auto bg-surface px-4 py-4">
          <section className="overflow-hidden rounded-md border border-outline bg-white">
            <div className="grid divide-y divide-outline md:grid-cols-4 md:divide-x md:divide-y-0">
              <EndpointSummaryItem icon={<Gauge className="h-4 w-4" />} label="配置完整度" value={profile.scoreLabel} meta={profile.blockers[0] || '关键字段完整'} tone={profile.tone} />
              <EndpointSummaryItem icon={<Layers className="h-4 w-4" />} label="作用域" value={scopeLabel(endpoint)} meta={endpoint.clusterId || '按作用域路由'} />
              <EndpointSummaryItem icon={<Database className="h-4 w-4" />} label="查询能力" value={endpointQuerySummary(endpoint)} meta={endpointAddressMeta(endpoint)} />
              <EndpointSummaryItem icon={<Save className="h-4 w-4" />} label="更新时间" value={formatTimestamp(endpoint.updatedAt || endpoint.createdAt)} meta={endpoint.createdAt ? `created ${formatTimestamp(endpoint.createdAt)}` : '已保存端点'} />
            </div>
          </section>

          {profile.blockers.length > 0 ? <InlineNotice tone="warning" message={`当前阻断：${formatMissing(profile.blockers)}`} /> : null}

          <EndpointFormSection title="生产配置" meta="保存后的端点生产真值">
            <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
              <DetailCell label="名称" value={endpoint.name} />
              <DetailCell label="类型" value={logSinkLabel(endpoint.sinkType)} />
              <DetailCell label="作用域" value={scopeLabel(endpoint)} />
              <DetailCell label="状态" value={endpoint.status || 'active'} />
              <DetailCell label="Secret Ref" value={endpoint.secretRef || '-'} mono />
              <DetailCell label="描述" value={endpoint.description || '-'} />
            </div>
          </EndpointFormSection>

          <EndpointFormSection title="下游地址" meta="采集链路实际投递与查询使用的地址">
            <div className="grid gap-y-3">
              <DetailCell label="写入地址" value={endpoint.writeURL || '-'} mono />
              {endpoint.sinkType === 'kafka' ? <DetailCell label="Topic" value={endpoint.streamName || '-'} mono /> : null}
              {endpoint.sinkType === 'es' ? <DetailCell label="Index / Stream" value={endpoint.streamName || '-'} mono /> : null}
              {endpoint.queryURL ? <DetailCell label="查询地址" value={endpoint.queryURL} mono /> : null}
              {endpoint.vmuiURL ? <DetailCell label="VMUI URL" value={endpoint.vmuiURL} mono /> : null}
              {endpoint.sinkType === 'vl' ? <DetailCell label="租户" value={endpoint.accountId && endpoint.projectId ? `${endpoint.accountId} / ${endpoint.projectId}` : '-'} mono /> : null}
            </div>
          </EndpointFormSection>

          <EndpointFormSection title="审计信息" meta="用于定位端点变更与接口返回">
            <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
              <DetailCell label="端点 ID" value={endpoint.id} mono />
              <DetailCell label="配置状态" value={profile.label} />
              <DetailCell label="创建时间" value={formatTimestamp(endpoint.createdAt)} mono />
              <DetailCell label="更新时间" value={formatTimestamp(endpoint.updatedAt)} mono />
            </div>
          </EndpointFormSection>
        </div>
      </aside>
    </div>
  );
}

function EndpointEditorDrawer({ mode, form, profile, selectedEndpoint, clusters, registeredClusterIds, clustersLoading, endpointClusterBlockedReason, missing, formSaved, canSubmit, saving, saveError, onFormChange, onClose, onSave }: {
  mode: 'create' | 'edit';
  form: EndpointFormState;
  profile: ReturnType<typeof endpointOperationProfile>;
  selectedEndpoint: LogEndpoint | null;
  clusters: Array<{ id: string; name?: string }>;
  registeredClusterIds: Set<string>;
  clustersLoading: boolean;
  endpointClusterBlockedReason: string;
  missing: string[];
  formSaved: boolean;
  canSubmit: boolean;
  saving: boolean;
  saveError: unknown;
  onFormChange: (next: EndpointFormState) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const title = mode === 'edit' ? '编辑日志下游端点' : '新增日志下游端点';
  const meta = mode === 'edit' && selectedEndpoint ? selectedEndpoint.id : 'create draft';
  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-slate-900/28">
      <button type="button" className="absolute inset-0 cursor-default border-0 bg-transparent" aria-label="关闭端点编辑遮罩" onClick={onClose} />
      <aside className="console-drawer-panel relative flex h-full w-full max-w-[760px] flex-col border-l border-outline bg-white shadow-[0_20px_60px_rgba(24,52,96,0.24)]" role="dialog" aria-modal="true" aria-labelledby="endpoint-editor-title">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-outline bg-surface-lowest px-4 py-3">
          <div className="min-w-0">
            <div id="endpoint-editor-title" className="truncate text-sm font-semibold text-on-surface">{title}</div>
            <div className="mt-1 truncate font-mono text-[11px] text-muted">{meta}</div>
          </div>
          <button className="console-icon-button border-outline bg-white" onClick={onClose} aria-label="关闭端点编辑" title="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-auto bg-surface px-4 py-4">
          <EndpointProfileStrip
            profile={profile}
            form={form}
            selectedEndpoint={mode === 'edit' ? selectedEndpoint : null}
            creatingEndpoint={mode === 'create'}
            formSaved={formSaved}
          />
          <EndpointFormFields
            form={form}
            clusters={clusters}
            registeredClusterIds={registeredClusterIds}
            clustersLoading={clustersLoading}
            endpointClusterBlockedReason={endpointClusterBlockedReason}
            onFormChange={onFormChange}
          />
          {saveError ? <InlineNotice tone="danger" message={(saveError as Error).message} /> : null}
        </div>
        <div className="console-action-bar shrink-0">
          <div className="min-w-0 text-xs text-muted">
            {missing.length > 0 ? `保存前还需：${formatMissing(missing)}` : formSaved ? '当前端点配置已保存' : '保存后才会更新端点生产配置。'}
          </div>
          <div className="flex gap-2">
            <button className="console-button" onClick={onClose}>取消</button>
            <button className="console-button console-button-primary" disabled={!canSubmit || saving} onClick={onSave} title={missing.length > 0 ? `还需：${formatMissing(missing)}` : endpointClusterBlockedReason || (formSaved ? '当前配置已保存' : '保存端点')}>
              {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              保存
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function EndpointFormFields({ form, clusters, registeredClusterIds, clustersLoading, endpointClusterBlockedReason, onFormChange }: {
  form: EndpointFormState;
  clusters: Array<{ id: string; name?: string }>;
  registeredClusterIds: Set<string>;
  clustersLoading: boolean;
  endpointClusterBlockedReason: string;
  onFormChange: (next: EndpointFormState) => void;
}) {
  return (
    <>
      <EndpointFormSection title="端点身份" meta="决定这个下游端点服务哪些采集路由">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="名称">
            <input className="console-input w-full" value={form.name} onChange={(event) => onFormChange({ ...form, name: event.target.value })} placeholder="vl-test03" />
          </Field>
          <Field label="类型">
            <select className="console-input w-full" value={form.sinkType} onChange={(event) => onFormChange({ ...form, sinkType: event.target.value as LogSinkType, accountId: '', projectId: '' })}>
              {sinkOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </Field>
          <Field label="作用域">
            <select
              className="console-input w-full"
              value={form.scopeType}
              onChange={(event) => {
                const scopeType = event.target.value;
                const nextClusterId = scopeType === 'k8s_cluster'
                  ? (registeredClusterIds.has(form.clusterId) ? form.clusterId : clusters[0]?.id ?? '')
                  : '';
                onFormChange({ ...form, scopeType, clusterId: nextClusterId });
              }}
            >
              <option value="global">全局端点</option>
              <option value="k8s_cluster">K8s 集群端点</option>
              <option value="vm">VM 端点</option>
            </select>
          </Field>
          <Field label="K8s 集群">
            <select
              className="console-input w-full"
              value={form.scopeType === 'k8s_cluster' ? form.clusterId : ''}
              onChange={(event) => onFormChange({ ...form, clusterId: event.target.value })}
              disabled={form.scopeType !== 'k8s_cluster' || clustersLoading || clusters.length === 0}
            >
              <option value="">{clustersLoading ? '正在加载已登记集群' : '请选择已登记集群'}</option>
              {form.clusterId && !registeredClusterIds.has(form.clusterId) ? (
                <option value={form.clusterId} disabled>{form.clusterId} / 未登记</option>
              ) : null}
              {clusters.map((cluster) => (
                <option key={cluster.id} value={cluster.id}>{cluster.name || cluster.id} / {cluster.id}</option>
              ))}
            </select>
          </Field>
        </div>
        {endpointClusterBlockedReason ? <div className="mt-3"><InlineNotice tone="warning" message={endpointClusterBlockedReason} /></div> : null}
      </EndpointFormSection>

      <EndpointFormSection title="地址配置" meta="写入地址用于采集链路投递；查询地址用于检索与验证">
        <div className="grid gap-3">
          <Field label="写入地址" help={<EndpointExampleHelp kind="write" />}>
            <input className="console-input w-full font-mono" value={form.writeURL} onChange={(event) => onFormChange({ ...form, writeURL: event.target.value })} placeholder={endpointWritePlaceholder(form.sinkType)} />
          </Field>
          {form.sinkType !== 'kafka' && form.sinkType !== 'otel' ? (
            <Field label="查询地址" help={<EndpointExampleHelp kind="query" />}>
              <input className="console-input w-full font-mono" value={form.queryURL} onChange={(event) => onFormChange({ ...form, queryURL: event.target.value })} placeholder={endpointQueryPlaceholder(form.sinkType)} />
            </Field>
          ) : (
            <Field label="Topic">
              <input className="console-input w-full font-mono" value={form.streamName} onChange={(event) => onFormChange({ ...form, streamName: event.target.value })} placeholder="novaobs.logs" />
            </Field>
          )}
          {form.sinkType === 'es' ? (
            <Field label="Index / Stream">
              <input className="console-input w-full font-mono" value={form.streamName} onChange={(event) => onFormChange({ ...form, streamName: event.target.value })} placeholder="novaobs-logs" />
            </Field>
          ) : null}
          {form.sinkType === 'vl' ? (
            <Field label="VMUI URL">
              <input className="console-input w-full font-mono" value={form.vmuiURL} onChange={(event) => onFormChange({ ...form, vmuiURL: event.target.value })} placeholder="http://victorialogs:9428/select/vmui/" />
            </Field>
          ) : null}
        </div>
      </EndpointFormSection>

      <EndpointFormSection title="租户与凭据" meta="租户 ID 与 Secret Ref 只描述引用，不在前端保存明文密钥">
        <div className="grid gap-3 md:grid-cols-2">
          {form.sinkType === 'vl' ? (
            <>
              <Field label="AccountID">
                <input className="console-input w-full font-mono" inputMode="numeric" value={form.accountId} onChange={(event) => onFormChange({ ...form, accountId: event.target.value })} placeholder="默认 0" />
              </Field>
              <Field label="ProjectID">
                <input className="console-input w-full font-mono" inputMode="numeric" value={form.projectId} onChange={(event) => onFormChange({ ...form, projectId: event.target.value })} placeholder="默认 0" />
              </Field>
              <div className="flex items-end">
                <button type="button" className="quiet-button h-9 px-3 text-xs" onClick={() => onFormChange({ ...form, ...generateVictoriaLogsTenant() })}>
                  生成租户 ID
                </button>
              </div>
            </>
          ) : null}
          <Field label="Secret Ref" className={form.sinkType === 'vl' ? '' : 'md:col-span-2'}>
            <input className="console-input w-full font-mono" value={form.secretRef} onChange={(event) => onFormChange({ ...form, secretRef: event.target.value })} placeholder="secret://logs/vl-test03" />
          </Field>
          <Field label="状态">
            <select className="console-input w-full" value={form.status} onChange={(event) => onFormChange({ ...form, status: event.target.value })}>
              <option value="active">active</option>
              <option value="disabled">disabled</option>
            </select>
          </Field>
        </div>
      </EndpointFormSection>

      <EndpointFormSection title="说明" meta="记录用途、覆盖范围或变更说明，方便审计回看">
        <Field label="描述">
          <input className="console-input w-full" value={form.description} onChange={(event) => onFormChange({ ...form, description: event.target.value })} placeholder="例如：test03 集群日志写入 VictoriaLogs 租户" />
        </Field>
      </EndpointFormSection>
    </>
  );
}

function DetailCell({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 border-b border-outline/60 pb-2">
      <div className="text-[11px] font-semibold text-muted">{label}</div>
      <div className={`mt-1 break-words text-sm font-semibold text-on-surface ${mono ? 'font-mono text-xs' : ''}`}>{value}</div>
    </div>
  );
}

function EndpointTableRow({ endpoint, selected, profile, onView, onEdit }: {
  endpoint: LogEndpoint;
  selected: boolean;
  profile: ReturnType<typeof endpointOperationProfile>;
  onView: () => void;
  onEdit: () => void;
}) {
  return (
    <tr className={`cursor-pointer ${selected ? 'console-selected-row' : ''}`} onClick={onView}>
      <td>
        <div className="min-w-0">
          <div className="truncate font-semibold text-on-surface">{endpoint.name}</div>
          <div className="mt-1 truncate font-mono text-[11px] text-muted">{endpoint.id}</div>
        </div>
      </td>
      <td>
        <span className="rounded border border-outline bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">{logSinkLabel(endpoint.sinkType)}</span>
      </td>
      <td><StatusBadge value={endpoint.status || 'active'} /></td>
      <td>
        <div className="truncate text-xs font-semibold text-on-surface">{scopeLabel(endpoint)}</div>
        <div className="mt-1 truncate font-mono text-[11px] text-muted">{endpoint.clusterId || '-'}</div>
      </td>
      <td>
        <div className="truncate font-mono text-[11px] text-muted">{endpoint.writeURL || '-'}</div>
      </td>
      <td>
        <div className="truncate text-xs font-semibold text-on-surface">{endpointQuerySummary(endpoint)}</div>
        <div className="mt-1 truncate font-mono text-[11px] text-muted">{endpointAddressMeta(endpoint)}</div>
      </td>
      <td>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${profile.tone === 'success' ? 'bg-emerald-500' : profile.tone === 'warning' ? 'bg-warning' : 'bg-danger'}`} aria-hidden />
          <div className="min-w-0">
            <div className="font-mono text-xs font-semibold text-on-surface">{profile.scoreLabel}</div>
            <div className="truncate text-[11px] text-muted">{profile.blockers[0] || profile.label}</div>
          </div>
        </div>
      </td>
      <td className="font-mono text-[11px] text-muted">{formatTimestamp(endpoint.updatedAt || endpoint.createdAt)}</td>
      <td className="text-right">
        <div className="flex justify-end gap-2">
          <button type="button" className="console-icon-button h-7 w-7 border-outline bg-white" aria-label="查看端点详情" title="查看端点详情" onClick={(event) => { event.stopPropagation(); onView(); }}>
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button type="button" className="console-icon-button h-7 w-7 border-outline bg-white" aria-label="编辑端点" title="编辑端点" onClick={(event) => { event.stopPropagation(); onEdit(); }}>
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function EndpointProfileStrip({ profile, form, selectedEndpoint, creatingEndpoint, formSaved }: {
  profile: ReturnType<typeof endpointOperationProfile>;
  form: EndpointFormState;
  selectedEndpoint: LogEndpoint | null;
  creatingEndpoint: boolean;
  formSaved: boolean;
}) {
  const draftState = formSaved ? '已保存' : selectedEndpoint ? '未保存变更' : creatingEndpoint ? '新增草稿' : '新增草稿';
  return (
    <section className="overflow-hidden rounded-md border border-outline bg-white">
      <div className="grid divide-y divide-outline md:grid-cols-4 md:divide-x md:divide-y-0">
        <EndpointSummaryItem icon={<Gauge className="h-4 w-4" />} label="配置完整度" value={profile.scoreLabel} meta={profile.blockers[0] || '关键字段完整'} tone={profile.tone} />
        <EndpointSummaryItem icon={<Layers className="h-4 w-4" />} label="作用域" value={scopeLabel(form)} meta={form.clusterId || '按作用域路由'} />
        <EndpointSummaryItem icon={<Database className="h-4 w-4" />} label="下游类型" value={logSinkLabel(form.sinkType)} meta={endpointQuerySummary(form)} />
        <EndpointSummaryItem icon={<Save className="h-4 w-4" />} label="草稿状态" value={draftState} meta={selectedEndpoint?.updatedAt ? `updated ${formatTimestamp(selectedEndpoint.updatedAt)}` : '等待保存'} tone={formSaved ? 'success' : 'warning'} />
      </div>
    </section>
  );
}

function EndpointSummaryItem({ icon, label, value, meta, tone = 'muted' }: { icon: ReactNode; label: string; value: string; meta: string; tone?: 'success' | 'warning' | 'danger' | 'muted' }) {
  const toneClass = tone === 'success'
    ? 'text-emerald-700'
    : tone === 'warning'
      ? 'text-warning'
      : tone === 'danger'
        ? 'text-danger'
        : 'text-muted';
  return (
    <div className="min-w-0 px-3 py-3">
      <div className={`flex items-center gap-1.5 text-[11px] font-semibold ${toneClass}`}>{icon}{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-on-surface">{value}</div>
      <div className="mt-0.5 truncate font-mono text-[11px] text-muted">{meta}</div>
    </div>
  );
}

function scopeLabel(endpoint: Pick<LogEndpoint, 'scopeType' | 'clusterId'> | EndpointFormState) {
  if (endpoint.scopeType === 'k8s_cluster') return endpoint.clusterId ? `K8s · ${endpoint.clusterId}` : 'K8s · 未绑定';
  if (endpoint.scopeType === 'vm') return 'VM 专用';
  return '全局';
}

function endpointQuerySummary(endpoint: Pick<LogEndpoint, 'sinkType' | 'queryURL' | 'vmuiURL' | 'streamName'> | EndpointFormState) {
  if (endpoint.sinkType === 'kafka') return endpoint.streamName ? `Topic ${endpoint.streamName}` : 'Topic 未配置';
  if (endpoint.sinkType === 'es') return endpoint.streamName ? `Index ${endpoint.streamName}` : endpoint.queryURL ? 'HTTP 查询' : '查询未配置';
  if (endpoint.sinkType === 'otel') return 'OTLP 写入';
  if (endpoint.queryURL && endpoint.vmuiURL) return 'LogSQL + VMUI';
  if (endpoint.queryURL) return 'LogSQL';
  if (endpoint.vmuiURL) return 'VMUI';
  return '查询未配置';
}

function endpointAddressMeta(endpoint: Pick<LogEndpoint, 'sinkType' | 'queryURL' | 'vmuiURL' | 'streamName'> | EndpointFormState) {
  if (endpoint.sinkType === 'kafka') return endpoint.streamName || 'Topic -';
  if (endpoint.sinkType === 'es') return endpoint.queryURL || endpoint.streamName || 'query_url -';
  if (endpoint.sinkType === 'otel') return 'write only';
  return endpoint.queryURL || endpoint.vmuiURL || 'query_url -';
}

function formatTimestamp(value?: string) {
  if (!value) return '-';
  const normalized = value.replace('T', ' ').replace(/\.\d+Z$/, 'Z');
  return normalized.length > 16 ? normalized.slice(0, 16) : normalized;
}

function endpointToForm(endpoint: LogEndpoint) {
  return {
    name: endpoint.name ?? '',
    description: endpoint.description ?? '',
    sinkType: endpoint.sinkType || 'vl',
    streamName: endpoint.streamName ?? '',
    writeURL: endpoint.writeURL ?? '',
    queryURL: endpoint.queryURL ?? '',
    vmuiURL: endpoint.vmuiURL ?? '',
    accountId: endpoint.accountId ?? '',
    projectId: endpoint.projectId ?? '',
    secretRef: endpoint.secretRef ?? '',
    scopeType: endpoint.scopeType || 'global',
    clusterId: endpoint.clusterId ?? '',
    status: endpoint.status || 'active',
  };
}

function endpointFormMatchesEndpoint(form: typeof emptyEndpoint, endpoint: LogEndpoint) {
  return form.name === endpoint.name
    && form.description === endpoint.description
    && form.sinkType === endpoint.sinkType
    && form.streamName === endpoint.streamName
    && form.writeURL === endpoint.writeURL
    && form.queryURL === endpoint.queryURL
    && form.vmuiURL === endpoint.vmuiURL
    && form.accountId === endpoint.accountId
    && form.projectId === endpoint.projectId
    && form.secretRef === endpoint.secretRef
    && form.scopeType === endpoint.scopeType
    && form.clusterId === endpoint.clusterId
    && form.status === endpoint.status;
}

function endpointMissingFields(form: typeof emptyEndpoint) {
  const missing: string[] = [];
  if (!form.name.trim()) missing.push('名称');
  if (!form.writeURL.trim()) missing.push('写入地址');
  if (form.scopeType === 'k8s_cluster' && !form.clusterId.trim()) missing.push('K8s 集群');
  if (form.sinkType === 'kafka' && !form.streamName.trim()) missing.push('Topic');
  if (form.sinkType === 'vl' && Boolean(form.accountId.trim()) !== Boolean(form.projectId.trim())) missing.push('完整租户 ID');
  if (form.sinkType === 'vl' && form.accountId && !isUint32(form.accountId)) missing.push('有效的 AccountID');
  if (form.sinkType === 'vl' && form.projectId && !isUint32(form.projectId)) missing.push('有效的 ProjectID');
  return missing;
}

function isUint32(value: string) {
  return /^\d+$/.test(value) && BigInt(value) <= 4294967295n;
}

function generateVictoriaLogsTenant() {
  const ids = new Uint32Array(2);
  crypto.getRandomValues(ids);
  return { accountId: String(ids[0]), projectId: String(ids[1]) };
}

function endpointWritePlaceholder(sinkType: LogSinkType) {
  if (sinkType === 'es') return 'http://elasticsearch:9200/novaobs-logs/_bulk';
  if (sinkType === 'kafka') return 'kafka-0:9092,kafka-1:9092';
  if (sinkType === 'otel') return 'http://otel-gateway:4318/v1/logs';
  return 'http://victorialogs:9428/insert/opentelemetry/v1/logs';
}

function endpointQueryPlaceholder(sinkType: LogSinkType) {
  if (sinkType === 'es') return 'http://elasticsearch:9200/novaobs-logs/_search';
  if (sinkType === 'otel') return '';
  return 'http://victorialogs:9428/select/logsql/query';
}

function formatMissing(items: string[]) {
  return items.join('、');
}

function EndpointFormSection({ title, meta, children }: { title: string; meta: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-outline bg-surface-lowest p-3">
      <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-outline/70 pb-2">
        <div className="text-sm font-semibold text-on-surface">{title}</div>
        <div className="hidden text-[11px] leading-4 text-muted md:block">{meta}</div>
      </div>
      {children}
    </section>
  );
}

function Field({ label, help, className = '', children }: { label: string; help?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={`block min-w-0 space-y-1 ${className}`}>
      <div className="flex min-h-5 items-center gap-1.5">
        <span className="block text-[11px] font-semibold text-muted">{label}</span>
        {help}
      </div>
      {children}
    </div>
  );
}

function EndpointExampleHelp({ kind }: { kind: 'write' | 'query' }) {
  const examples = kind === 'write'
    ? [
      ['VictoriaLogs', 'http://victorialogs:9428/insert/opentelemetry/v1/logs'],
      ['OTel / OTLP', 'http://otel-gateway:4318/v1/logs'],
      ['Elasticsearch', 'http://elasticsearch:9200/novaobs-logs/_bulk'],
      ['Kafka', 'kafka-0:9092,kafka-1:9092，Topic 填 novaobs.logs'],
    ]
    : [
      ['VictoriaLogs', 'http://victorialogs:9428/select/logsql/query'],
      ['OTel / OTLP', '通常只配置写入地址；查询由最终存储后端提供'],
      ['Elasticsearch', 'http://elasticsearch:9200/novaobs-logs/_search'],
      ['Kafka', '通常不配置 HTTP 查询地址，由消费端按 Topic 查询'],
    ];
  return (
    <span className="group relative inline-flex">
      <button type="button" className="flex h-4 w-4 items-center justify-center rounded-full border border-outline bg-surface text-muted transition hover:border-primary/40 hover:text-primary" aria-label={`${kind === 'write' ? '写入地址' : '查询地址'}示例路径`}>
        <HelpCircle className="h-3 w-3" />
      </button>
      <div className="pointer-events-none invisible absolute left-0 top-6 z-30 w-80 translate-y-1 rounded-md border border-outline bg-surface-lowest p-3 opacity-0 shadow-[0_16px_36px_-18px_rgba(18,32,51,0.45)] transition duration-150 group-hover:pointer-events-auto group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
        <div className="mb-2 text-xs font-semibold text-on-surface">{kind === 'write' ? '写入地址示例' : '查询地址示例'}</div>
        <div className="grid gap-2">
          {examples.map(([label, value]) => (
            <div key={label} className="grid gap-0.5">
              <div className="text-[11px] font-semibold text-muted">{label}</div>
              <code className="break-all rounded bg-surface px-2 py-1 font-mono text-[11px] leading-4 text-on-surface">{value}</code>
            </div>
          ))}
        </div>
      </div>
    </span>
  );
}

function InlineNotice({ tone, message }: { tone: 'success' | 'warning' | 'danger'; message: string }) {
  const cls = tone === 'success'
    ? 'border-primary/20 bg-primary-soft text-primary'
    : tone === 'warning'
      ? 'border-amber-300 bg-amber-50 text-warning'
      : 'border-red-200 bg-red-50 text-danger';
  return <div className={`rounded-md border px-3 py-2 text-xs font-semibold ${cls}`}>{message}</div>;
}
