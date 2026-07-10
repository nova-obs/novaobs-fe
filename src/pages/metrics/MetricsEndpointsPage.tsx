import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, Loader2, Pencil, Plus, RefreshCw, Save, Scan, X } from 'lucide-react';
import { HelpTip } from '../../components/HelpTip';
import { metricsApi, type EndpointTestResult, type MetricEndpoint, type MetricEndpointInput } from './api';

const emptyForm: MetricEndpointInput = {
  name: '',
  description: '',
  remoteWriteURL: '',
  queryURL: '',
  vmuiURL: '',
  scopeType: 'global',
  clusterId: '',
  status: 'active',
};

function statusClass(status: string) {
  if (['active', 'healthy', 'verified'].includes(status)) return 'border-emerald-600/20 bg-emerald-50 text-emerald-700';
  if (['failed', 'error', 'disabled'].includes(status)) return 'border-danger/20 bg-red-50 text-danger';
  if (['pending', 'pending_verification'].includes(status)) return 'border-warning/25 bg-amber-50 text-warning';
  return 'border-outline bg-surface-lowest text-muted';
}

function isSafeHTTPURL(rawURL: string) {
  try {
    const parsed = new URL(rawURL);
    return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password && !parsed.hash;
  } catch {
    return false;
  }
}

export function validateVictoriaMetricsEndpointForm(form: MetricEndpointInput): string[] {
  const missing: string[] = [];
  if (!form.name.trim()) missing.push('端点名称');
  if (!isSafeHTTPURL(form.remoteWriteURL)) missing.push('Remote Write 地址');
  if (!isSafeHTTPURL(form.queryURL)) missing.push('查询地址');
  if (!isSafeHTTPURL(form.vmuiURL)) missing.push('VMUI 地址');
  if (isSafeHTTPURL(form.remoteWriteURL) && !new URL(form.remoteWriteURL).pathname.includes('/insert/0/prometheus')) missing.push('Remote Write 租户占位路径');
  if (isSafeHTTPURL(form.queryURL) && !new URL(form.queryURL).pathname.includes('/select/0/prometheus')) missing.push('查询租户占位路径');
  if (isSafeHTTPURL(form.vmuiURL) && !new URL(form.vmuiURL).pathname.includes('/select/0/vmui')) missing.push('VMUI 租户占位路径');
  return missing;
}

export function MetricsEndpointsPage() {
  const [editor, setEditor] = useState<MetricEndpoint | null | undefined>(undefined);
  const [feedback, setFeedback] = useState<{ message: string; tone: 'success' | 'warning' } | null>(null);
  const { data: endpoints = [], error, isLoading, refetch } = useQuery({
    queryKey: ['metrics-endpoints'],
    queryFn: metricsApi.listEndpoints,
    retry: false,
  });

  return (
    <div className="space-y-3">
      <section className="console-panel overflow-hidden">
        <div className="console-panel-header">
          <div className="flex min-w-0 items-center gap-1.5"><h2 className="console-section-title">接入端点</h2><HelpTip content="维护 VictoriaMetrics Cluster 的物理连接地址。" label="接入端点说明" /></div>
          <div className="flex items-center gap-2">
            <button type="button" className="console-icon-button border-outline bg-white" aria-label="刷新指标端点" title="刷新指标端点" onClick={() => void refetch()}>
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button type="button" className="console-button console-button-primary gap-1.5" onClick={() => setEditor(null)}>
              <Plus className="h-3.5 w-3.5" />登记 VMS
            </button>
          </div>
        </div>
        {feedback ? <div className={`console-notice m-3 mb-0 ${feedback.tone === 'success' ? 'console-notice-success' : 'console-notice-warning'}`}>{feedback.message}</div> : null}
        {error ? <div className="console-notice console-notice-danger m-3 mb-0">{(error as Error).message}</div> : null}
        <div className="console-panel-body">
          <div className="overflow-auto">
            <table className="console-table w-full min-w-[1120px]">
              <thead>
                <tr>
                  <th>端点</th>
                  <th>类型</th>
                  <th>作用域</th>
                  <th>物理地址</th>
                  <th>租户策略</th>
                  <th>状态</th>
                  <th className="w-[148px]">操作</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7}><div className="console-skeleton h-10" /></td></tr>
                ) : error ? (
                  <tr><td colSpan={7}><div className="console-empty-state my-2 min-h-[220px]"><div className="text-sm font-semibold text-danger">指标端点加载失败</div><div className="text-xs text-muted">请检查权限或网络后重试。</div></div></td></tr>
                ) : endpoints.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="console-empty-state my-2 min-h-[300px]">
                        <Database className="h-5 w-5 text-muted/80" />
                        <div className="text-sm font-semibold text-on-surface">暂无 VictoriaMetrics 端点</div>
                        <div className="max-w-md text-xs leading-5 text-muted">登记 VMS Cluster 的写入、查询和 VMUI 地址后，才能创建指标采集路由并进入 Explore。</div>
                        <button type="button" className="console-button console-button-primary" onClick={() => setEditor(null)}>登记 VMS</button>
                      </div>
                    </td>
                  </tr>
                ) : endpoints.map((endpoint) => (
                  <EndpointRow key={endpoint.id} endpoint={endpoint} onEdit={() => setEditor(endpoint)} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      {editor !== undefined ? (
        <MetricsEndpointEditorDrawer
          key={editor?.id || 'new'}
          endpoint={editor}
          onClose={() => setEditor(undefined)}
          onSaved={(result) => {
            setEditor(undefined);
            setFeedback({
              tone: result.status === 'healthy' ? 'success' : 'warning',
              message: result.status === 'healthy'
                ? `VMS 已保存并通过连通性测试（${result.responseTimeMs}ms）。`
                : `VMS 已保存，但连通性测试未通过：${result.message}`,
            });
          }}
        />
      ) : null}
    </div>
  );
}

function EndpointRow({ endpoint, onEdit }: { endpoint: MetricEndpoint; onEdit: () => void }) {
  const queryClient = useQueryClient();
  const [testResult, setTestResult] = useState<EndpointTestResult | null>(null);
  const testMutation = useMutation({
    mutationFn: () => metricsApi.testEndpoint(endpoint.id),
    onSuccess: (result) => {
      setTestResult(result);
      void queryClient.invalidateQueries({ queryKey: ['metrics-endpoints'] });
    },
  });
  const healthStatus = testResult?.status || endpoint.healthStatus || 'unknown';
  const healthLatency = testResult?.responseTimeMs ?? endpoint.healthResponseTimeMs;
  const healthMessage = testResult?.message || endpoint.healthMessage;

  return (
    <tr>
      <td>
        <div className="font-semibold text-on-surface">{endpoint.name || '未命名端点'}</div>
        <div className="mt-0.5 truncate text-[11px] text-muted">{endpoint.description || '未填写说明'}</div>
      </td>
      <td>VictoriaMetrics</td>
      <td>{endpoint.scopeType === 'k8s_cluster' ? `K8s · ${endpoint.clusterId || '-'}` : '全局'}</td>
      <td className="max-w-[420px]">
        <div className="truncate font-mono text-xs text-on-surface" title={endpoint.remoteWriteURL}>{endpoint.remoteWriteURL || '-'}</div>
        <div className="mt-0.5 truncate font-mono text-[11px] text-muted" title={endpoint.queryURL}>{endpoint.queryURL || '-'}</div>
      </td>
      <td><div className="text-xs font-semibold text-on-surface">AccountID 0</div><div className="mt-0.5 text-[11px] text-muted">ProjectID 随产品注入</div></td>
      <td>
        <div className="flex flex-col items-start gap-1">
          <span className={`status-badge ${statusClass(endpoint.status)}`}><span className="status-dot" aria-hidden />{endpoint.status === 'disabled' ? '已停用' : '已启用'}</span>
          <span className={`status-badge ${statusClass(healthStatus)}`} title={healthMessage || '尚未测试'}><span className="status-dot" aria-hidden />{healthStatus === 'healthy' ? `连通${healthLatency ? ` · ${healthLatency}ms` : ''}` : healthStatus === 'failed' ? '连接失败' : '未测试'}</span>
        </div>
        {testMutation.error ? <div className="mt-1 text-[11px] text-danger">{(testMutation.error as Error).message}</div> : null}
      </td>
      <td>
        <div className="flex items-center gap-1.5">
          <button type="button" className="console-button gap-1 text-xs" disabled={testMutation.isPending} onClick={() => testMutation.mutate()} title="测试端点连通性">
            {testMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Scan className="h-3 w-3" />}测试
          </button>
          <button type="button" className="console-icon-button border-outline bg-white" onClick={onEdit} aria-label={`编辑 ${endpoint.name}`} title="编辑端点"><Pencil className="h-3.5 w-3.5" /></button>
        </div>
      </td>
    </tr>
  );
}

function MetricsEndpointEditorDrawer({ endpoint, onClose, onSaved }: { endpoint: MetricEndpoint | null; onClose: () => void; onSaved: (result: EndpointTestResult) => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<MetricEndpointInput>(() => endpoint ? {
    name: endpoint.name,
    description: endpoint.description,
    remoteWriteURL: endpoint.remoteWriteURL,
    queryURL: endpoint.queryURL,
    vmuiURL: endpoint.vmuiURL,
    scopeType: endpoint.scopeType || 'global',
    clusterId: endpoint.clusterId || '',
    status: endpoint.status || 'active',
  } : { ...emptyForm });
  const validationErrors = validateVictoriaMetricsEndpointForm(form);
  const saveMutation = useMutation({
    mutationFn: () => endpoint
      ? metricsApi.updateEndpoint(endpoint.id, form)
      : metricsApi.createEndpoint(form),
    onSuccess: async (saved) => {
      let result: EndpointTestResult;
      try {
        result = await metricsApi.testEndpoint(saved.id);
      } catch (error) {
        result = {
          status: 'failed',
          message: `探测请求失败：${(error as Error).message}`,
          responseTimeMs: 0,
          checkedAt: '',
        };
      }
      await queryClient.invalidateQueries({ queryKey: ['metrics-endpoints'] });
      onSaved(result);
    },
  });

  function setField<K extends keyof MetricEndpointInput>(key: K, value: MetricEndpointInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-slate-900/28">
      <button type="button" className="absolute inset-0 cursor-default border-0 bg-transparent" aria-label="关闭 VMS 登记遮罩" onClick={onClose} />
      <aside className="console-drawer-panel relative flex h-full w-full max-w-[620px] flex-col border-l border-outline bg-white shadow-[0_20px_60px_rgba(24,52,96,0.24)]" role="dialog" aria-modal="true" aria-labelledby="metrics-endpoint-editor-title">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-outline bg-surface-lowest px-4 py-3">
          <div className="flex min-w-0 items-center gap-1.5"><div id="metrics-endpoint-editor-title" className="truncate text-sm font-semibold text-on-surface">{endpoint ? '编辑 VMS 端点' : '登记 VMS 端点'}</div><HelpTip content="物理地址只保存租户占位路径；产品租户在采集与查询时注入。" label="VMS 端点说明" /></div>
          <button type="button" className="console-icon-button border-outline bg-white" onClick={onClose} aria-label="关闭 VMS 登记"><X className="h-4 w-4" /></button>
        </div>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => { event.preventDefault(); if (validationErrors.length === 0) saveMutation.mutate(); }}>
          <div className="min-h-0 flex-1 space-y-4 overflow-auto bg-surface px-4 py-4">
            <Field label="端点名称"><input className="console-input mt-1.5 w-full" value={form.name} maxLength={120} onChange={(event) => setField('name', event.target.value)} placeholder="例如：生产 VMS" /></Field>
            <Field label="说明"><textarea className="console-input mt-1.5 min-h-20 w-full resize-none py-2" value={form.description} maxLength={2048} onChange={(event) => setField('description', event.target.value)} placeholder="集群用途、负责人或网络范围" /></Field>
            <EndpointURLField label="Remote Write 地址" value={form.remoteWriteURL} onChange={(value) => setField('remoteWriteURL', value)} placeholder="http://vminsert:8480/insert/0/prometheus/api/v1/write" hint="vmagent 写入地址；0 是产品租户占位符。" />
            <EndpointURLField label="查询地址" value={form.queryURL} onChange={(value) => setField('queryURL', value)} placeholder="http://vmselect:8481/select/0/prometheus" hint="平台会在其后调用 /api/v1/query 做真实连通性测试。" />
            <EndpointURLField label="VMUI 地址" value={form.vmuiURL} onChange={(value) => setField('vmuiURL', value)} placeholder="http://vmselect:8481/select/0/vmui/" hint="Explore 内嵌查询入口。" />
            <Field label="状态"><select className="console-input mt-1.5 w-full" value={form.status} onChange={(event) => setField('status', event.target.value)}><option value="active">启用</option><option value="disabled">停用</option></select></Field>
            {validationErrors.length > 0 ? <div className="console-notice console-notice-warning">还需修正：{validationErrors.join('、')}</div> : null}
            {saveMutation.error ? <div className="console-notice console-notice-danger">{(saveMutation.error as Error).message}</div> : null}
          </div>
          <div className="console-action-bar shrink-0">
            <div className="ml-auto flex gap-2"><button type="button" className="console-button" onClick={onClose}>取消</button><button type="submit" className="console-button console-button-primary gap-1.5" disabled={validationErrors.length > 0 || saveMutation.isPending}>{saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}保存并测试</button></div>
          </div>
        </form>
      </aside>
    </div>
  );
}

function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return <div className="block text-xs font-semibold text-muted"><div className="flex items-center gap-1.5">{label}{help ? <HelpTip content={help} label={`${label}说明`} /> : null}</div><label className="block"><span className="sr-only">{label}</span>{children}</label></div>;
}

function EndpointURLField({ label, value, onChange, placeholder, hint }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; hint: string }) {
  return <Field label={label} help={hint}><input className="console-input mt-1.5 w-full font-mono text-xs" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></Field>;
}
