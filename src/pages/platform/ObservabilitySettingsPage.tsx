import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, Eye, Pencil, Plus, RefreshCw, Save, ScanSearch, Search, X } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { HelpTip } from '../../components/HelpTip';
import { StatusBadge } from '../../components/StatusBadge';
import { k8sApi } from '../k8s/api';
import { logSinkLabel, logsApi, type LogEndpoint, type LogSinkType } from '../logs/api';
import { observabilityEndpointsApi, type VictoriaMetricsEndpoint } from './observabilityEndpointsApi';

type EndpointKind = LogSinkType | 'vm';
export type EndpointDomain = 'logs' | 'metrics';
type EndpointItem = Omit<LogEndpoint, 'sinkType'> & {
  sinkType: EndpointKind;
  healthStatus?: string;
  healthMessage?: string;
  healthCheckedAt?: string;
  healthResponseTimeMS?: number;
};

function victoriaMetricsEndpointToItem(endpoint: VictoriaMetricsEndpoint): EndpointItem {
  return {
    id: endpoint.id,
    name: endpoint.name,
    description: endpoint.description,
    sinkType: 'vm',
    streamName: '',
    writeURL: endpoint.remoteWriteURL,
    queryURL: endpoint.queryURL,
    vmuiURL: endpoint.uiURL,
    accountId: '',
    projectId: '',
    scopeType: endpoint.scopeType,
    clusterId: endpoint.clusterId,
    status: endpoint.status,
    healthStatus: endpoint.health.status,
    healthMessage: endpoint.health.message,
    healthCheckedAt: endpoint.health.checkedAt,
    healthResponseTimeMS: endpoint.health.responseTimeMS,
    createdAt: endpoint.createdAt,
    updatedAt: endpoint.updatedAt,
  };
}

function victoriaMetricsInput(form: EndpointFormState) {
  return {
    name: form.name,
    description: form.description,
    scopeType: form.scopeType,
    clusterId: form.clusterId,
    remoteWriteURL: form.writeURL,
    queryURL: form.queryURL,
    uiURL: form.vmuiURL,
    status: form.status,
  };
}

const emptyEndpoint = {
  name: '',
  description: '',
  sinkType: 'vl' as EndpointKind,
  streamName: '',
  writeURL: '',
  queryURL: '',
  vmuiURL: '',
  scopeType: 'global',
  clusterId: '',
  status: 'active',
};

const sinkOptions: Array<{ value: EndpointKind; label: string }> = [
  { value: 'vm', label: 'VictoriaMetrics' },
  { value: 'vl', label: 'VictoriaLogs' },
  { value: 'otel', label: 'OTel / OTLP' },
  { value: 'es', label: 'Elasticsearch' },
  { value: 'kafka', label: 'Kafka' },
];

type EndpointFormState = typeof emptyEndpoint;

export function endpointKindOptions(domain: EndpointDomain) {
  return domain === 'metrics'
    ? sinkOptions.filter((item) => item.value === 'vm')
    : sinkOptions.filter((item) => item.value !== 'vm');
}

export function createEmptyEndpoint(domain: EndpointDomain = 'logs'): EndpointFormState {
  return { ...emptyEndpoint, sinkType: domain === 'metrics' ? 'vm' : 'vl' };
}

export async function listEndpointsByDomain(domain: EndpointDomain): Promise<EndpointItem[]> {
  if (domain === 'metrics') {
    const endpoints = await observabilityEndpointsApi.listVictoriaMetrics();
    return endpoints.map(victoriaMetricsEndpointToItem);
  }
  return logsApi.listEndpoints();
}

export function endpointOperationProfile(endpoint: Partial<EndpointItem>, registeredClusterIds?: Set<string>) {
  const blockers: string[] = [];
  const strengths: string[] = [];
  let score = 0;
  const status = endpoint.status || 'active';
  const sinkType = endpoint.sinkType || 'vl';
  const scopeType = endpoint.scopeType || 'global';
  const clusterId = endpoint.clusterId || '';
  const runtimeCapable = (sinkType === 'vl' || sinkType === 'vm') && Boolean(endpoint.queryURL);

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

  if (sinkType === 'vl' || sinkType === 'vm') {
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
    strengths.push('可作为 vmalert 数据源');
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

export function sortEndpointsForList<T extends Partial<EndpointItem>>(endpoints: T[], registeredClusterIds?: Set<string>): T[] {
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

export function ObservabilitySettingsPage({ domain = 'logs' }: { domain?: EndpointDomain }) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [selectedEndpointId, setSelectedEndpointId] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'closed' | 'create' | 'edit'>('closed');
  const [form, setForm] = useState(() => createEmptyEndpoint(domain));
  const endpointsQuery = useQuery({
    queryKey: ['observability-endpoints', domain],
    queryFn: () => listEndpointsByDomain(domain),
    retry: false,
  });
  const clustersQuery = useQuery({ queryKey: ['k8s-clusters'], queryFn: () => k8sApi.listClusters(), retry: false });
  const endpoints = endpointsQuery.data ?? [];
  const clusters = clustersQuery.data ?? [];
  const selectedEndpoint = endpoints.find((item) => item.id === selectedEndpointId) ?? null;
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
          ? '端点只能绑定已登记的 K8s 集群'
          : '';
  const filteredEndpoints = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return endpoints;
    return endpoints.filter((endpoint) => `${endpoint.name} ${endpoint.sinkType} ${endpoint.scopeType} ${endpoint.clusterId} ${endpoint.writeURL} ${endpoint.streamName}`.toLowerCase().includes(keyword));
  }, [endpoints, query]);
  const clusterRegistry = clustersQuery.isSuccess ? registeredClusterIds : undefined;
  const listedEndpoints = useMemo(() => sortEndpointsForList(filteredEndpoints, clusterRegistry), [clusterRegistry, filteredEndpoints]);
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
      setForm(createEmptyEndpoint(domain));
    }
  }, [domain, editingEndpoint, endpoints, endpointsQuery.isFetching, selectedEndpointId]);

  const saveMutation = useMutation({
    mutationFn: async (): Promise<EndpointItem> => {
      if (domain === 'metrics') {
        if (form.sinkType !== 'vm') throw new Error('指标下游端点仅支持 VictoriaMetrics');
        const input = victoriaMetricsInput(form);
        const endpoint = editingEndpoint && selectedEndpoint
          ? await observabilityEndpointsApi.updateVictoriaMetrics(selectedEndpoint.id, input)
          : await observabilityEndpointsApi.createVictoriaMetrics(input);
        return victoriaMetricsEndpointToItem(endpoint);
      }
      if (form.sinkType === 'vm') throw new Error('Logs 下游端点不支持 VictoriaMetrics');
      return editingEndpoint && selectedEndpoint
        ? logsApi.updateEndpoint(selectedEndpoint.id, { ...form, sinkType: form.sinkType })
        : logsApi.createEndpoint({ ...form, sinkType: form.sinkType });
    },
    onSuccess: async (endpoint) => {
      await queryClient.invalidateQueries({ queryKey: ['observability-endpoints'] });
      await queryClient.invalidateQueries({ queryKey: ['metrics-write-destinations'] });
      await queryClient.invalidateQueries({ queryKey: ['logs-workspace'] });
      setEditorMode('closed');
      setSelectedEndpointId(endpoint.id);
      setDetailOpen(true);
      setForm(endpointToForm(endpoint));
    },
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => observabilityEndpointsApi.test(id),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['observability-endpoints'] }),
  });

  useEffect(() => {
    setQuery('');
    setSelectedEndpointId('');
    setDetailOpen(false);
    setEditorMode('closed');
    setForm(createEmptyEndpoint(domain));
    saveMutation.reset();
    testMutation.reset();
  }, [domain]);

  function startCreate() {
    setEditorMode('create');
    setDetailOpen(false);
    setForm(createEmptyEndpoint(domain));
  }

  function openEndpointDetail(endpoint: EndpointItem) {
    testMutation.reset();
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
      setForm(createEmptyEndpoint(domain));
    }
  }

  return (
    <div className="space-y-4">
      <DataPanel
        action={(
          <div className="flex w-full flex-wrap items-center justify-end gap-2 md:w-auto">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <input className="console-input h-9 w-full pl-8 text-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={domain === 'metrics' ? '搜索指标端点、URL 或集群' : '搜索 Logs 端点、URL、集群或 Topic'} />
            </div>
            <button className="console-button" onClick={() => endpointsQuery.refetch()} disabled={endpointsQuery.isFetching} aria-label="刷新观测端点">
              {endpointsQuery.isFetching ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              刷新
            </button>
            <button className="console-button console-button-primary" onClick={startCreate}>
              <Plus className="h-3.5 w-3.5" />
              {domain === 'metrics' ? '新增指标端点' : '新增 Logs 端点'}
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
                <div className="text-sm font-semibold text-on-surface">{query.trim() ? '未找到匹配的下游端点' : domain === 'metrics' ? '暂无指标下游端点' : '暂无 Logs 下游端点'}</div>
                <div className="mt-1 text-xs text-muted">{query.trim() ? '调整关键词后再查看列表。' : domain === 'metrics' ? '登记 VictoriaMetrics 后，环境指标接入才能选择写入目标。' : '登记日志下游后，Logs 接入才能选择写入目标。'}</div>
              </div>
              {!query.trim() ? (
                <button className="console-button console-button-primary" onClick={startCreate}>
                  <Plus className="h-3.5 w-3.5" />
                  {domain === 'metrics' ? '新增指标端点' : '新增 Logs 端点'}
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
          onTest={selectedEndpoint.sinkType === 'vm' ? () => testMutation.mutate(selectedEndpoint.id) : undefined}
          testing={testMutation.isPending}
          testMessage={testMutation.data?.message ?? ''}
          testError={testMutation.error instanceof Error ? testMutation.error.message : ''}
        />
      ) : null}
      {editorMode !== 'closed' ? (
        <EndpointEditorDrawer
          domain={domain}
          mode={editorMode}
          form={form}
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

function EndpointDetailDrawer({ endpoint, profile, onClose, onEdit, onTest, testing, testMessage, testError }: {
  endpoint: EndpointItem;
  profile: ReturnType<typeof endpointOperationProfile>;
  onClose: () => void;
  onEdit: () => void;
  onTest?: () => void;
  testing: boolean;
  testMessage: string;
  testError: string;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-slate-900/24">
      <button type="button" className="absolute inset-0 cursor-default border-0 bg-transparent" aria-label="关闭端点详情遮罩" onClick={onClose} />
      <aside className="console-drawer-panel relative flex h-full w-full max-w-[780px] flex-col border-l border-outline bg-white shadow-[0_20px_60px_rgba(24,52,96,0.22)]" role="dialog" aria-modal="true" aria-labelledby="endpoint-detail-title">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-outline bg-surface-lowest px-4 py-3">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <div id="endpoint-detail-title" className="truncate text-sm font-semibold text-on-surface">{endpoint.name}</div>
              <span className="rounded border border-outline bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">{endpointKindLabel(endpoint.sinkType)}</span>
              <StatusBadge value={endpoint.status || 'active'} />
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            {onTest ? <button className="console-button" onClick={onTest} disabled={testing}><ScanSearch className={`h-3.5 w-3.5 ${testing ? 'animate-pulse' : ''}`} />{testing ? '测试中' : '测试连接'}</button> : null}
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
          {testMessage ? <InlineNotice tone="success" message={testMessage} /> : null}
          {testError ? <InlineNotice tone="danger" message={testError} /> : null}
          {profile.blockers.length > 0 ? <InlineNotice tone="warning" message={`当前阻断：${formatMissing(profile.blockers)}`} /> : null}

          <EndpointFormSection title="生产配置" description="这里展示当前已保存并实际生效的端点配置。">
            <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
              <DetailCell label="名称" value={endpoint.name} />
              <DetailCell label="类型" value={endpointKindLabel(endpoint.sinkType)} />
              <DetailCell label="作用域" value={scopeLabel(endpoint)} />
              <DetailCell label="状态" value={endpoint.status || 'active'} />
              {endpoint.sinkType === 'vm' ? <DetailCell label="连接健康" value={endpoint.healthStatus === 'healthy' ? '健康' : endpoint.healthStatus || 'unknown'} /> : null}
              <DetailCell label="描述" value={endpoint.description || '-'} />
            </div>
          </EndpointFormSection>

          <EndpointFormSection title="下游地址" description="采集链路实际投递、查询和验证时使用这些地址。">
            <div className="grid gap-y-3">
              <DetailCell label="写入地址" value={endpoint.writeURL || '-'} mono />
              {endpoint.sinkType === 'kafka' ? <DetailCell label="Topic" value={endpoint.streamName || '-'} mono /> : null}
              {endpoint.sinkType === 'es' ? <DetailCell label="Index / Stream" value={endpoint.streamName || '-'} mono /> : null}
              {endpoint.queryURL ? <DetailCell label="查询地址" value={endpoint.queryURL} mono /> : null}
              {endpoint.vmuiURL ? <DetailCell label="VMUI URL" value={endpoint.vmuiURL} mono /> : null}
              {endpoint.sinkType === 'vm' && endpoint.healthMessage ? <DetailCell label="最近测试" value={`${endpoint.healthMessage}${endpoint.healthResponseTimeMS ? ` · ${endpoint.healthResponseTimeMS}ms` : ''}`} /> : null}
            </div>
          </EndpointFormSection>

          <EndpointFormSection title="审计信息" description="时间与配置状态用于定位端点变更。">
            <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
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

function EndpointEditorDrawer({ domain, mode, form, clusters, registeredClusterIds, clustersLoading, endpointClusterBlockedReason, missing, formSaved, canSubmit, saving, saveError, onFormChange, onClose, onSave }: {
  domain: EndpointDomain;
  mode: 'create' | 'edit';
  form: EndpointFormState;
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
  const domainLabel = domain === 'metrics' ? '指标下游端点' : 'Logs 下游端点';
  const title = mode === 'edit' ? `编辑${domainLabel}` : `新增${domainLabel}`;
  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-slate-900/28">
      <button type="button" className="absolute inset-0 cursor-default border-0 bg-transparent" aria-label="关闭端点编辑遮罩" onClick={onClose} />
      <aside className="console-drawer-panel relative flex h-full w-full max-w-[760px] flex-col border-l border-outline bg-white shadow-[0_20px_60px_rgba(24,52,96,0.24)]" role="dialog" aria-modal="true" aria-labelledby="endpoint-editor-title">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-outline bg-surface-lowest px-4 py-3">
          <div id="endpoint-editor-title" className="truncate text-sm font-semibold text-on-surface">{title}</div>
          <button className="console-icon-button border-outline bg-white" onClick={onClose} aria-label="关闭端点编辑" title="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-auto bg-surface px-4 py-4">
          <EndpointFormFields
            domain={domain}
            form={form}
            clusters={clusters}
            registeredClusterIds={registeredClusterIds}
            clustersLoading={clustersLoading}
            endpointClusterBlockedReason={endpointClusterBlockedReason}
            typeLocked={mode === 'edit' || domain === 'metrics'}
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

function EndpointFormFields({ domain, form, clusters, registeredClusterIds, clustersLoading, endpointClusterBlockedReason, typeLocked, onFormChange }: {
  domain: EndpointDomain;
  form: EndpointFormState;
  clusters: Array<{ id: string; name?: string }>;
  registeredClusterIds: Set<string>;
  clustersLoading: boolean;
  endpointClusterBlockedReason: string;
  typeLocked: boolean;
  onFormChange: (next: EndpointFormState) => void;
}) {
  return (
    <>
      <EndpointFormSection title="端点身份" description="名称、类型与作用域决定该端点可被日志接入还是环境指标接入使用。">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="名称">
            <input className="console-input w-full" value={form.name} onChange={(event) => onFormChange({ ...form, name: event.target.value })} placeholder={form.sinkType === 'vm' ? 'vms-production' : 'vl-test03'} />
          </Field>
          <Field label="类型">
            <select className="console-input w-full" value={form.sinkType} disabled={typeLocked} title={typeLocked ? '端点创建后不能变更类型' : undefined} onChange={(event) => {
              const sinkType = event.target.value as EndpointKind;
              const scopeType = sinkType === 'vm' && form.scopeType === 'vm' ? 'global' : form.scopeType;
              onFormChange({ ...form, sinkType, scopeType, streamName: '', queryURL: '', vmuiURL: '' });
            }}>
              {endpointKindOptions(domain).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
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
              {form.sinkType !== 'vm' ? <option value="vm">VM 端点</option> : null}
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
          <Field label="状态">
            <select className="console-input w-full" value={form.status} onChange={(event) => onFormChange({ ...form, status: event.target.value })}>
              <option value="active">active</option>
              <option value="disabled">disabled</option>
            </select>
          </Field>
        </div>
        {endpointClusterBlockedReason ? <div className="mt-3"><InlineNotice tone="warning" message={endpointClusterBlockedReason} /></div> : null}
      </EndpointFormSection>

      <EndpointFormSection title="地址配置" description="写入地址用于采集链路投递，查询地址用于检索与验证。">
        <div className="grid gap-3">
          <Field label={form.sinkType === 'vm' ? 'Remote Write 地址' : '写入地址'} help={<EndpointExampleHelp kind="write" />}>
            <input className="console-input w-full font-mono" value={form.writeURL} onChange={(event) => onFormChange({ ...form, writeURL: event.target.value })} placeholder={endpointWritePlaceholder(form.sinkType)} />
          </Field>
          {form.sinkType !== 'kafka' && form.sinkType !== 'otel' ? (
            <Field label={form.sinkType === 'vm' ? 'Query 地址' : '查询地址'} help={<EndpointExampleHelp kind="query" />}>
              <input className="console-input w-full font-mono" value={form.queryURL} onChange={(event) => onFormChange({ ...form, queryURL: event.target.value })} placeholder={endpointQueryPlaceholder(form.sinkType)} />
            </Field>
          ) : (
            <Field label="Topic">
              <input className="console-input w-full font-mono" value={form.streamName} onChange={(event) => onFormChange({ ...form, streamName: event.target.value })} placeholder="novaapm.logs" />
            </Field>
          )}
          {form.sinkType === 'es' ? (
            <Field label="Index / Stream">
              <input className="console-input w-full font-mono" value={form.streamName} onChange={(event) => onFormChange({ ...form, streamName: event.target.value })} placeholder="novaapm-logs" />
            </Field>
          ) : null}
          {form.sinkType === 'vl' || form.sinkType === 'vm' ? (
            <Field label="VMUI URL">
              <input className="console-input w-full font-mono" value={form.vmuiURL} onChange={(event) => onFormChange({ ...form, vmuiURL: event.target.value })} placeholder={form.sinkType === 'vm' ? 'http://vmselect:8481/select/0/vmui/' : 'http://victorialogs:9428/select/vmui/'} />
            </Field>
          ) : null}
        </div>
      </EndpointFormSection>

      <EndpointFormSection title="说明" description="可记录用途、覆盖范围或变更原因，便于审计回看。">
        <Field label="描述">
          <input className="console-input w-full" value={form.description} onChange={(event) => onFormChange({ ...form, description: event.target.value })} placeholder={form.sinkType === 'vm' ? '例如：生产环境指标写入 VictoriaMetrics' : '例如：test03 集群日志写入 VictoriaLogs'} />
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
  endpoint: EndpointItem;
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
        </div>
      </td>
      <td>
        <span className="rounded border border-outline bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">{endpointKindLabel(endpoint.sinkType)}</span>
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

function endpointKindLabel(kind: EndpointKind) {
  return kind === 'vm' ? 'VictoriaMetrics' : logSinkLabel(kind);
}

function scopeLabel(endpoint: Pick<EndpointItem, 'scopeType' | 'clusterId'> | EndpointFormState) {
  if (endpoint.scopeType === 'k8s_cluster') return endpoint.clusterId ? `K8s · ${endpoint.clusterId}` : 'K8s · 未绑定';
  if (endpoint.scopeType === 'vm') return 'VM 专用';
  return '全局';
}

function endpointQuerySummary(endpoint: Pick<EndpointItem, 'sinkType' | 'queryURL' | 'vmuiURL' | 'streamName'> | EndpointFormState) {
  if (endpoint.sinkType === 'kafka') return endpoint.streamName ? `Topic ${endpoint.streamName}` : 'Topic 未配置';
  if (endpoint.sinkType === 'es') return endpoint.streamName ? `Index ${endpoint.streamName}` : endpoint.queryURL ? 'HTTP 查询' : '查询未配置';
  if (endpoint.sinkType === 'otel') return 'OTLP 写入';
  if (endpoint.sinkType === 'vm') return endpoint.queryURL && endpoint.vmuiURL ? 'PromQL + VMUI' : endpoint.queryURL ? 'PromQL' : '查询未配置';
  if (endpoint.queryURL && endpoint.vmuiURL) return 'LogSQL + VMUI';
  if (endpoint.queryURL) return 'LogSQL';
  if (endpoint.vmuiURL) return 'VMUI';
  return '查询未配置';
}

function endpointAddressMeta(endpoint: Pick<EndpointItem, 'sinkType' | 'queryURL' | 'vmuiURL' | 'streamName'> | EndpointFormState) {
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

function endpointToForm(endpoint: EndpointItem) {
  return {
    name: endpoint.name ?? '',
    description: endpoint.description ?? '',
    sinkType: endpoint.sinkType || 'vl',
    streamName: endpoint.streamName ?? '',
    writeURL: endpoint.writeURL ?? '',
    queryURL: endpoint.queryURL ?? '',
    vmuiURL: endpoint.vmuiURL ?? '',
    scopeType: endpoint.scopeType || 'global',
    clusterId: endpoint.clusterId ?? '',
    status: endpoint.status || 'active',
  };
}

function endpointFormMatchesEndpoint(form: typeof emptyEndpoint, endpoint: EndpointItem) {
  return form.name === endpoint.name
    && form.description === endpoint.description
    && form.sinkType === endpoint.sinkType
    && form.streamName === endpoint.streamName
    && form.writeURL === endpoint.writeURL
    && form.queryURL === endpoint.queryURL
    && form.vmuiURL === endpoint.vmuiURL
    && form.scopeType === endpoint.scopeType
    && form.clusterId === endpoint.clusterId
    && form.status === endpoint.status;
}

function endpointMissingFields(form: typeof emptyEndpoint) {
  const missing: string[] = [];
  if (!form.name.trim()) missing.push('名称');
  if (!form.writeURL.trim()) missing.push(form.sinkType === 'vm' ? 'Remote Write 地址' : '写入地址');
	if (form.sinkType === 'vm' && !form.queryURL.trim()) missing.push('Query 地址');
	if (form.sinkType === 'vm' && !form.vmuiURL.trim()) missing.push('VMUI URL');
  if (form.scopeType === 'k8s_cluster' && !form.clusterId.trim()) missing.push('K8s 集群');
  if (form.sinkType === 'kafka' && !form.streamName.trim()) missing.push('Topic');
  return missing;
}

function endpointWritePlaceholder(sinkType: EndpointKind) {
  if (sinkType === 'vm') return 'http://vminsert:8480/insert/0/prometheus/api/v1/write';
  if (sinkType === 'es') return 'http://elasticsearch:9200/novaapm-logs/_bulk';
  if (sinkType === 'kafka') return 'kafka-0:9092,kafka-1:9092';
  if (sinkType === 'otel') return 'http://otel-gateway:4318/v1/logs';
  return 'http://victorialogs:9428/insert/opentelemetry/v1/logs';
}

function endpointQueryPlaceholder(sinkType: EndpointKind) {
  if (sinkType === 'vm') return 'http://vmselect:8481/select/0/prometheus';
  if (sinkType === 'es') return 'http://elasticsearch:9200/novaapm-logs/_search';
  if (sinkType === 'otel') return '';
  return 'http://victorialogs:9428/select/logsql/query';
}

function formatMissing(items: string[]) {
  return items.join('、');
}

function EndpointFormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-outline bg-surface-lowest p-3">
      <div className="mb-3 flex items-center gap-1.5 border-b border-outline/70 pb-2">
        <div className="text-sm font-semibold text-on-surface">{title}</div>
        {description ? <HelpTip content={description} label={`${title}说明`} /> : null}
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
      ['VictoriaMetrics', 'http://vminsert:8480/insert/0/prometheus/api/v1/write'],
      ['VictoriaLogs', 'http://victorialogs:9428/insert/opentelemetry/v1/logs'],
      ['OTel / OTLP', 'http://otel-gateway:4318/v1/logs'],
      ['Elasticsearch', 'http://elasticsearch:9200/novaapm-logs/_bulk'],
      ['Kafka', 'kafka-0:9092,kafka-1:9092，Topic 填 novaapm.logs'],
    ]
    : [
      ['VictoriaMetrics', 'http://vmselect:8481/select/0/prometheus'],
      ['VictoriaLogs', 'http://victorialogs:9428/select/logsql/query'],
      ['OTel / OTLP', '通常只配置写入地址；查询由最终存储后端提供'],
      ['Elasticsearch', 'http://elasticsearch:9200/novaapm-logs/_search'],
      ['Kafka', '通常不配置 HTTP 查询地址，由消费端按 Topic 查询'],
    ];
  return (
    <HelpTip
      label={`${kind === 'write' ? '写入地址' : '查询地址'}示例路径`}
      content={(
        <div className="w-72">
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
      )}
    />
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
