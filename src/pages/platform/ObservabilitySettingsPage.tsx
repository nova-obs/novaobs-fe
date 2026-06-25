import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, HelpCircle, Plus, RefreshCw, Save, Search, X } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
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

export function ObservabilitySettingsPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [selectedEndpointId, setSelectedEndpointId] = useState('');
  const [form, setForm] = useState(emptyEndpoint);
  const endpointsQuery = useQuery({ queryKey: ['logs-endpoints'], queryFn: () => logsApi.listEndpoints(), retry: false });
  const endpoints = endpointsQuery.data ?? [];
  const selectedEndpoint = endpoints.find((item) => item.id === selectedEndpointId) ?? null;
  const filteredEndpoints = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return endpoints;
    return endpoints.filter((endpoint) => `${endpoint.name} ${endpoint.sinkType} ${endpoint.scopeType} ${endpoint.clusterId} ${endpoint.writeURL} ${endpoint.streamName}`.toLowerCase().includes(keyword));
  }, [endpoints, query]);
  const missing = endpointMissingFields(form);
  const formSaved = Boolean(selectedEndpoint && endpointFormMatchesEndpoint(form, selectedEndpoint));
  const canSubmit = missing.length === 0 && !formSaved;

  useEffect(() => {
    if (selectedEndpointId || endpoints.length === 0) return;
    setSelectedEndpointId(endpoints[0].id);
    setForm(endpointToForm(endpoints[0]));
  }, [endpoints, selectedEndpointId]);

  const saveMutation = useMutation({
    mutationFn: () => selectedEndpoint
      ? logsApi.updateEndpoint(selectedEndpoint.id, form)
      : logsApi.createEndpoint(form),
    onSuccess: async (endpoint) => {
      await queryClient.invalidateQueries({ queryKey: ['logs-endpoints'] });
      await queryClient.invalidateQueries({ queryKey: ['logs-workspace'] });
      setSelectedEndpointId(endpoint.id);
      setForm(endpointToForm(endpoint));
    },
  });

  function startCreate() {
    setSelectedEndpointId('');
    setForm(emptyEndpoint);
  }

  function selectEndpoint(endpoint: LogEndpoint) {
    setSelectedEndpointId(endpoint.id);
    setForm(endpointToForm(endpoint));
  }

  return (
    <div className="space-y-4">
      <DataPanel title="观测接入配置" meta={`${endpoints.length} 个日志下游端点`}>
        <div className="grid items-start gap-4 2xl:grid-cols-[360px_minmax(0,1fr)]">
          <section className="overflow-hidden rounded-md border border-outline bg-surface-lowest">
            <div className="console-panel-header">
              <div className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                <Database className="h-4 w-4 text-primary" />
                日志下游端点
              </div>
              <button className="console-button console-button-primary" onClick={startCreate}>
                <Plus className="h-3.5 w-3.5" />
                新增
              </button>
            </div>
            <div className="space-y-3 p-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                <input className="console-input h-9 w-full pl-8 text-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索端点 / URL / 集群" />
              </div>
              <div className="max-h-[460px] overflow-auto rounded-md border border-outline bg-white">
                {filteredEndpoints.length === 0 ? (
                  <div className="px-3 py-8 text-center text-sm text-muted">暂无日志下游端点</div>
                ) : filteredEndpoints.map((endpoint) => {
                  const selected = endpoint.id === selectedEndpointId;
                  return (
                    <button
                      key={endpoint.id}
                      type="button"
                      className={[
                        'block w-full border-b border-outline/70 px-3 py-3 text-left transition last:border-b-0',
                        selected ? 'bg-primary-soft/70 shadow-[inset_3px_0_0_rgba(13,91,215,0.78)]' : 'hover:bg-surface-low/70',
                      ].join(' ')}
                      onClick={() => selectEndpoint(endpoint)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className={`truncate text-sm font-semibold ${selected ? 'text-primary' : 'text-on-surface'}`}>{endpoint.name}</div>
                        <span className="rounded border border-outline bg-surface px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">{logSinkLabel(endpoint.sinkType)}</span>
                      </div>
                      <div className="mt-1 truncate font-mono text-[11px] text-muted">{endpoint.scopeType}{endpoint.clusterId ? ` · ${endpoint.clusterId}` : ''}</div>
                      <div className="mt-1 truncate font-mono text-[11px] text-muted">{endpoint.writeURL || '-'}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-md border border-outline bg-surface-lowest">
            <div className="console-panel-header flex-col md:flex-row md:items-center">
              <div>
                <div className="text-sm font-semibold text-on-surface">{selectedEndpoint ? '编辑日志下游端点' : '新增日志下游端点'}</div>
                <div className="mt-1 font-mono text-[11px] text-muted">{selectedEndpoint ? selectedEndpoint.id : 'new endpoint'}</div>
              </div>
              <div className="flex gap-2">
                {selectedEndpoint ? (
                  <button className="console-button" onClick={startCreate}>
                    <X className="h-3.5 w-3.5" />
                    取消选择
                  </button>
                ) : null}
                <button className="console-button console-button-primary" disabled={!canSubmit || saveMutation.isPending} onClick={() => saveMutation.mutate()} title={missing.length > 0 ? `还需：${formatMissing(missing)}` : formSaved ? '当前配置已保存' : '保存端点'}>
                  {saveMutation.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  保存
                </button>
              </div>
            </div>
            <div className="space-y-4 p-4">
              <EndpointFormSection title="端点身份" meta="决定这个下游端点服务哪些采集路由">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="名称">
                    <input className="console-input w-full" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="vl-test03" />
                  </Field>
                  <Field label="类型">
                    <select className="console-input w-full" value={form.sinkType} onChange={(event) => setForm({ ...form, sinkType: event.target.value as LogSinkType, accountId: '', projectId: '' })}>
                      {sinkOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </Field>
                  <Field label="作用域">
                    <select className="console-input w-full" value={form.scopeType} onChange={(event) => setForm({ ...form, scopeType: event.target.value, clusterId: event.target.value === 'k8s_cluster' ? form.clusterId : '' })}>
                      <option value="global">全局端点</option>
                      <option value="k8s_cluster">K8s 集群端点</option>
                      <option value="vm">VM 端点</option>
                    </select>
                  </Field>
                  <Field label="Cluster ID">
                    <input className="console-input w-full" value={form.scopeType === 'k8s_cluster' ? form.clusterId : ''} onChange={(event) => setForm({ ...form, clusterId: event.target.value })} disabled={form.scopeType !== 'k8s_cluster'} placeholder="test03" />
                  </Field>
                </div>
              </EndpointFormSection>

              <EndpointFormSection title="地址配置" meta="写入地址用于采集链路投递；查询地址用于检索与验证">
                <div className="grid gap-3 xl:grid-cols-2">
                  <Field label="写入地址" help={<EndpointExampleHelp kind="write" />}>
                    <input className="console-input w-full font-mono" value={form.writeURL} onChange={(event) => setForm({ ...form, writeURL: event.target.value })} placeholder={endpointWritePlaceholder(form.sinkType)} />
                  </Field>
                  {form.sinkType !== 'kafka' && form.sinkType !== 'otel' ? (
                    <Field label="查询地址" help={<EndpointExampleHelp kind="query" />}>
                      <input className="console-input w-full font-mono" value={form.queryURL} onChange={(event) => setForm({ ...form, queryURL: event.target.value })} placeholder={endpointQueryPlaceholder(form.sinkType)} />
                    </Field>
                  ) : (
                    <Field label="Topic">
                      <input className="console-input w-full font-mono" value={form.streamName} onChange={(event) => setForm({ ...form, streamName: event.target.value })} placeholder="novaobs.logs" />
                    </Field>
                  )}
                  {form.sinkType === 'es' ? (
                    <Field label="Index / Stream">
                      <input className="console-input w-full font-mono" value={form.streamName} onChange={(event) => setForm({ ...form, streamName: event.target.value })} placeholder="novaobs-logs" />
                    </Field>
                  ) : null}
                  {form.sinkType === 'vl' ? (
                    <Field label="VMUI URL">
                      <input className="console-input w-full font-mono" value={form.vmuiURL} onChange={(event) => setForm({ ...form, vmuiURL: event.target.value })} placeholder="http://victorialogs:9428/select/vmui/" />
                    </Field>
                  ) : null}
                </div>
              </EndpointFormSection>

              <EndpointFormSection title="租户与凭据" meta="租户 ID 与 Secret Ref 只描述引用，不在前端保存明文密钥">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {form.sinkType === 'vl' ? (
                    <>
                      <Field label="AccountID">
                        <input className="console-input w-full font-mono" inputMode="numeric" value={form.accountId} onChange={(event) => setForm({ ...form, accountId: event.target.value })} placeholder="默认 0" />
                      </Field>
                      <Field label="ProjectID">
                        <input className="console-input w-full font-mono" inputMode="numeric" value={form.projectId} onChange={(event) => setForm({ ...form, projectId: event.target.value })} placeholder="默认 0" />
                      </Field>
                      <div className="flex items-end">
                        <button type="button" className="quiet-button h-9 px-3 text-xs" onClick={() => setForm({ ...form, ...generateVictoriaLogsTenant() })}>
                          生成租户 ID
                        </button>
                      </div>
                    </>
                  ) : null}
                  <Field label="Secret Ref" className={form.sinkType === 'vl' ? '' : 'xl:col-span-2'}>
                    <input className="console-input w-full font-mono" value={form.secretRef} onChange={(event) => setForm({ ...form, secretRef: event.target.value })} placeholder="secret://logs/vl-test03" />
                  </Field>
                  <Field label="状态">
                    <select className="console-input w-full" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                      <option value="active">active</option>
                      <option value="disabled">disabled</option>
                    </select>
                  </Field>
                </div>
              </EndpointFormSection>

              <EndpointFormSection title="说明" meta="记录用途、覆盖范围或变更说明，方便审计回看">
                <Field label="描述">
                  <input className="console-input w-full" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="例如：test03 集群日志写入 VictoriaLogs 租户" />
                </Field>
              </EndpointFormSection>

              {missing.length > 0 ? <InlineNotice tone="warning" message={`保存前还需：${formatMissing(missing)}`} /> : null}
              {formSaved ? <InlineNotice tone="success" message="当前端点配置已保存" /> : null}
              {saveMutation.error ? <InlineNotice tone="danger" message={(saveMutation.error as Error).message} /> : null}
            </div>
          </section>
        </div>
      </DataPanel>
    </div>
  );
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
  if (form.scopeType === 'k8s_cluster' && !form.clusterId.trim()) missing.push('Cluster ID');
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
