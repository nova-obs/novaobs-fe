import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, FlaskConical, Loader2, X } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import type { AlertRuleSpec, AlertRuleTestResult } from '../../services/types';
import { metricsApi, type MetricServiceBinding, type MetricsServiceSummary } from './api';

const fieldClass = 'mt-1.5 h-9 w-full rounded-md border border-outline bg-white px-3 text-sm text-on-surface outline-none focus:border-primary';

type MetricsQueryMode = 'promql' | 'metricsql';

export function MetricsAlertRulePage() {
  const navigate = useNavigate();
  const { id: ruleId = '' } = useParams();
  return <MetricsAlertRuleDrawer ruleId={ruleId} onClose={() => navigate('/metrics/alerts')} />;
}

export function MetricsAlertRuleDrawer({ ruleId = '', onClose }: { ruleId?: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const { data: workspace } = useQuery({
    queryKey: ['metrics-workspace'],
    queryFn: () => metricsApi.getWorkspace(),
  });
  const ruleQuery = useQuery({
    queryKey: ['metrics-alert-rule', ruleId],
    queryFn: () => api.getAlertRule(ruleId),
    enabled: Boolean(ruleId),
  });

  const services = workspace?.services ?? [];
  const bindings = workspace?.serviceBindings ?? [];
  const endpoints = workspace?.endpoints ?? [];
  const endpointById = useMemo(() => new Map(endpoints.map((ep) => [ep.id, ep])), [endpoints]);
  const bindingByServiceId = useMemo(() => new Map(bindings.map((b) => [b.serviceId, b])), [bindings]);

  const serviceOptions = useMemo(() => {
    return services
      .filter((s) => bindingByServiceId.has(s.id))
      .map((s) => ({ service: s, binding: bindingByServiceId.get(s.id)! }));
  }, [bindingByServiceId, services]);

  const paramServiceId = searchParams.get('service_id') ?? searchParams.get('binding_id') ?? '';
  const [serviceId, setServiceId] = useState(paramServiceId || serviceOptions[0]?.service.id || '');
  const [name, setName] = useState('');
  const [mode, setMode] = useState<MetricsQueryMode>('promql');
  const [expression, setExpression] = useState('');
  const [window, setWindow] = useState('5m');
  const [threshold, setThreshold] = useState(1);
  const [operator, setOperator] = useState<'gt' | 'gte'>('gt');
  const [policyId, setPolicyId] = useState('');
  const [severity, setSeverity] = useState<'info' | 'warning' | 'critical'>('warning');
  const [ownerTeam, setOwnerTeam] = useState('');
  const [groupFields, setGroupFields] = useState('');
  const [evaluationDelay, setEvaluationDelay] = useState('5s');
  const [testResult, setTestResult] = useState<AlertRuleTestResult | null>(null);
  const [testedInput, setTestedInput] = useState('');

  const selectedOption = serviceOptions.find((o) => o.service.id === serviceId) ?? serviceOptions[0];
  const selectedService = selectedOption?.service;
  const selectedBinding = selectedOption?.binding;
  const selectedEndpoint = selectedBinding ? endpointById.get(selectedBinding.endpointId) ?? null : null;

  const policiesQuery = useQuery({
    queryKey: ['alert-notification-policies', selectedService?.id],
    queryFn: () => api.getNotificationPolicies(selectedService?.id),
    enabled: Boolean(selectedService?.id),
  });

  useEffect(() => {
    if (paramServiceId && serviceId !== paramServiceId) setServiceId(paramServiceId);
    else if (!serviceId && serviceOptions[0]) setServiceId(serviceOptions[0].service.id);
  }, [paramServiceId, serviceId, serviceOptions]);

  useEffect(() => {
    if (policyId || !policiesQuery.data?.length) return;
    const firstEnabled = policiesQuery.data.find((p) => p.enabled);
    if (firstEnabled) setPolicyId(firstEnabled.id);
  }, [policiesQuery.data, policyId]);

  useEffect(() => {
    const rule = ruleQuery.data;
    if (!rule) return;
    setServiceId(rule.spec.scope.serviceId);
    setName(rule.spec.name);
    setMode(rule.spec.query.mode === 'metricsql' ? 'metricsql' : 'promql');
    setExpression(rule.spec.query.expression);
    setWindow(rule.spec.trigger.window);
    setThreshold(rule.spec.trigger.threshold);
    setOperator(rule.spec.trigger.operator);
    setPolicyId(rule.spec.notification.policyId);
    setSeverity(rule.spec.notification.severity);
    setOwnerTeam(rule.spec.notification.ownerTeam);
    setGroupFields(rule.spec.grouping.fields.join(', '));
    setEvaluationDelay(rule.spec.trigger.evaluationDelay);
  }, [ruleQuery.data]);

  const spec = useMemo<AlertRuleSpec>(() => ({
    signalType: 'metrics',
    name: name.trim(),
    description: '',
    scope: {
      serviceId: selectedService?.id ?? '',
      serviceName: selectedService?.name ?? '',
      logRouteId: '',
      metricsBindingId: selectedBinding?.id ?? '',
      endpointId: selectedEndpoint?.id ?? '',
      accountId: selectedEndpoint?.accountId ?? selectedBinding?.accountId ?? '',
      projectId: selectedEndpoint?.projectId ?? selectedBinding?.projectId ?? '',
      basePromQL: selectedBinding?.basePromQL ?? '',
    },
    query: { mode, expression: expression.trim() },
    trigger: {
      mode: 'window', aggregation: 'rate', operator, threshold,
      window, evaluationInterval: '30s', evaluationDelay, pendingFor: '0s', keepFiringFor: '0s',
    },
    grouping: { fields: groupFields.split(',').map((f) => f.trim()).filter(Boolean), maxInstances: 100 },
    notification: {
      policyId: policyId.trim(), severity,
      ownerTeam: ownerTeam.trim() || selectedService?.ownerTeam || '', runbookUrl: '',
    },
  }), [evaluationDelay, expression, groupFields, mode, name, operator, ownerTeam, policyId, selectedBinding, selectedEndpoint, selectedService, severity, threshold, window]);

  const inputSnapshot = JSON.stringify(spec);
  const missingFields = useMemo(() => {
    const missing: string[] = [];
    if (!spec.name) missing.push('规则名称');
    if (!spec.scope.metricsBindingId) missing.push('指标绑定');
    if (!spec.query.expression) missing.push('PromQL 表达式');
    if (!spec.notification.policyId) missing.push('通知策略');
    if (!spec.notification.ownerTeam) missing.push('责任团队');
    if (!(threshold > 0)) missing.push('阈值');
    return missing;
  }, [spec, threshold]);
  const formReady = missingFields.length === 0;
  const testCurrent = Boolean(testResult?.testToken && testedInput === inputSnapshot);

  const actionHint = missingFields.length > 0
    ? `测试前还需：${missingFields.join('、')}`
    : testCurrent
      ? '测试通过，可以启用告警。'
      : testResult
        ? '规则内容已变化，请重新测试。'
        : '启用前需要先测试当前规则。';

  const testMutation = useMutation({
    mutationFn: () => api.testMetricsAlertRule(spec),
    onSuccess: (result) => { setTestResult(result); setTestedInput(inputSnapshot); },
  });
  const createMutation = useMutation({
    mutationFn: () => api.createMetricsAlertRule(spec, testResult?.testToken ?? ''),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['metrics-alert-rules'] });
      onClose();
    },
  });

  const title = ruleId ? '编辑指标告警' : '创建指标告警';

  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-slate-900/28">
      <button type="button" className="absolute inset-0 cursor-default border-0 bg-transparent" aria-label="关闭指标告警编辑遮罩" onClick={onClose} />
      <aside className="console-drawer-panel relative flex h-full w-full max-w-[760px] flex-col border-l border-outline bg-white shadow-[0_20px_60px_rgba(24,52,96,0.24)]" role="dialog" aria-modal="true" aria-labelledby="metrics-alert-editor-title">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-outline bg-surface-lowest px-4 py-3">
          <div className="min-w-0">
            <div id="metrics-alert-editor-title" className="truncate text-sm font-semibold text-on-surface">{title}</div>
            <div className="mt-1 truncate font-mono text-[11px] text-muted">{ruleId || 'new rule'}</div>
          </div>
          <button className="console-icon-button border-outline bg-white" onClick={onClose} aria-label="关闭指标告警编辑" title="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-auto bg-surface px-4 py-4">
          <ProfileStrip
            serviceName={selectedService?.displayName || selectedService?.name || '-'}
            bindingLabel={selectedBinding?.id ?? '-'}
            thresholdLabel={`${window} 内 ${operator === 'gt' ? '>' : '>='} ${threshold}`}
            testLabel={testCurrent ? '已测试' : '待测试'}
          />

          <FormCard number="01" title="指标作用域" description="选择服务和对应的指标绑定。">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="规则名称"><input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：API 错误率告警" /></Field>
              <Field label="服务 / 绑定">
                <select className={fieldClass} value={selectedOption?.service.id ?? ''} onChange={(e) => setServiceId(e.target.value)}>
                  {serviceOptions.length === 0 ? <option value="">暂无可用绑定</option> : null}
                  {serviceOptions.map((o) => <option key={o.service.id} value={o.service.id}>{o.service.displayName || o.service.name || o.service.id}</option>)}
                </select>
                {serviceOptions.length === 0 ? <span className="mt-1 block text-[11px] text-amber-700">没有服务绑定了指标端点。请先在采集接入页创建绑定。</span> : null}
              </Field>
            </div>
            {selectedBinding ? (
              <BindingContext binding={selectedBinding} endpointName={selectedEndpoint?.name} />
            ) : null}
          </FormCard>

          <FormCard number="02" title="查询条件" description="编写 PromQL / MetricsQL 查询表达式。">
            <div className="mb-3 inline-flex rounded-md border border-outline bg-surface-low p-1">
              {([['promql', 'PromQL'], ['metricsql', 'MetricsQL']] as const).map(([value, label]) => (
                <button key={value} type="button" className={`rounded px-3 py-1.5 text-xs ${mode === value ? 'bg-white font-semibold text-primary shadow-sm' : 'font-medium text-muted'}`} onClick={() => setMode(value)}>{label}</button>
              ))}
            </div>
            <Field label={mode === 'metricsql' ? 'MetricsQL 表达式' : 'PromQL 表达式'}>
              <textarea className="mt-1.5 min-h-24 w-full rounded-md border border-outline bg-white p-3 font-mono text-sm outline-none focus:border-primary" value={expression} onChange={(e) => setExpression(e.target.value)} placeholder='rate(http_requests_total{status=~"5.."}[5m]) > 0.1' />
            </Field>
          </FormCard>

          <FormCard number="03" title="触发条件" description="设置阈值和时间窗口。">
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="时间窗口">
                <select className={fieldClass} value={window} onChange={(e) => setWindow(e.target.value)}>
                  <option value="1m">1 分钟</option>
                  <option value="5m">5 分钟</option>
                  <option value="10m">10 分钟</option>
                  <option value="15m">15 分钟</option>
                  <option value="30m">30 分钟</option>
                </select>
              </Field>
              <Field label="条件">
                <select className={fieldClass} value={operator} onChange={(e) => setOperator(e.target.value as 'gt' | 'gte')}>
                  <option value="gt">{'>'}</option>
                  <option value="gte">{'>='}</option>
                </select>
              </Field>
              <Field label="阈值"><input className={fieldClass} type="number" step="any" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} /></Field>
              <Field label="评估延迟" required={false}>
                <select className={fieldClass} value={evaluationDelay} onChange={(e) => setEvaluationDelay(e.target.value)}>
                  <option value="0s">不延迟</option>
                  <option value="5s">5 秒</option>
                  <option value="10s">10 秒</option>
                  <option value="30s">30 秒</option>
                </select>
              </Field>
            </div>
          </FormCard>

          <FormCard number="04" title="通知对象" description="选择接收策略和责任归属。">
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="通知策略">
                <select className={fieldClass} value={policyId} onChange={(e) => setPolicyId(e.target.value)}>
                  <option value="">请选择通知策略</option>
                  {(policiesQuery.data ?? []).filter((p) => p.enabled || p.id === policyId).map((p) => (
                    <option key={p.id} value={p.id} disabled={!p.enabled}>{p.name} · {p.receiver}{p.enabled ? '' : '（已停用）'}</option>
                  ))}
                </select>
                {!policiesQuery.isLoading && !policiesQuery.data?.some((p) => p.enabled) ? <span className="mt-1 block text-[11px] text-amber-700">当前服务没有可用通知策略。</span> : null}
              </Field>
              <Field label="责任团队"><input className={fieldClass} value={ownerTeam} onChange={(e) => setOwnerTeam(e.target.value)} placeholder={selectedService?.ownerTeam || '例如：SRE'} /></Field>
              <Field label="严重程度">
                <select className={fieldClass} value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)}>
                  <option value="info">提示</option>
                  <option value="warning">警告</option>
                  <option value="critical">严重</option>
                </select>
              </Field>
            </div>
          </FormCard>

          <details className="console-panel overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-on-surface">
              <span>高级设置</span>
              <ChevronDown className="h-4 w-4 text-muted" />
            </summary>
            <div className="grid gap-3 border-t border-outline p-4 md:grid-cols-2">
              <Field label="按字段拆分（逗号分隔）" required={false}><input className={fieldClass} value={groupFields} onChange={(e) => setGroupFields(e.target.value)} placeholder="instance, namespace" /></Field>
            </div>
          </details>

          <FormCard title="测试并启用" description="测试通过后才允许启用。">
            {testMutation.error ? <ErrorBox message={(testMutation.error as Error).message} /> : null}
            {testCurrent && testResult ? (
              <div className="rounded-md border border-emerald-500/25 bg-emerald-50 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><Check className="h-4 w-4" />测试通过，可以启用</div>
                <div className="mt-3 divide-y divide-emerald-200/70 text-sm">
                  <ResultRow label="匹配数据" value={`${testResult.matchedLogCount} 条`} />
                  <ResultRow label="触发分组" value={`${testResult.estimatedInstanceCount} 个`} />
                  <ResultRow label="查询耗时" value={`${testResult.queryDurationMillis} ms`} />
                </div>
              </div>
            ) : testResult ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">规则内容已变化，请重新测试。</div>
            ) : (
              <div className="rounded-md border border-outline bg-white p-3 text-xs leading-5 text-muted">填写必填项后先测试规则，测试通过后再启用。</div>
            )}
            {createMutation.error ? <ErrorBox message={(createMutation.error as Error).message} /> : null}
          </FormCard>
        </div>

        <div className="console-action-bar shrink-0">
          <div className="min-w-0 text-xs text-muted">{actionHint}</div>
          <div className="flex gap-2">
            <button className="console-button" onClick={onClose}>取消</button>
            <button type="button" className="console-button" disabled={!formReady || testMutation.isPending} onClick={() => testMutation.mutate()} title={missingFields.length > 0 ? `还需：${missingFields.join('、')}` : '测试规则'}>
              {testMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
              测试规则
            </button>
            <button type="button" className="console-button console-button-primary" disabled={!testCurrent || createMutation.isPending} onClick={() => createMutation.mutate()} title={testCurrent ? (ruleId ? '更新告警' : '启用告警') : '请先测试当前规则'}>
              {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {ruleId ? '更新告警' : '启用告警'}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function ProfileStrip({ serviceName, bindingLabel, thresholdLabel, testLabel }: { serviceName: string; bindingLabel: string; thresholdLabel: string; testLabel: string }) {
  return (
    <section className="overflow-hidden rounded-md border border-outline bg-white">
      <div className="grid divide-y divide-outline md:grid-cols-4 md:divide-x md:divide-y-0">
        <StripItem label="作用服务" value={serviceName} />
        <StripItem label="绑定" value={bindingLabel} />
        <StripItem label="触发门槛" value={thresholdLabel} />
        <StripItem label="测试状态" value={testLabel} tone={testLabel === '已测试' ? 'success' : 'warning'} />
      </div>
    </section>
  );
}

function StripItem({ label, value, tone = 'muted' }: { label: string; value: string; tone?: 'success' | 'warning' | 'muted' }) {
  const toneClass = tone === 'success' ? 'text-emerald-700' : tone === 'warning' ? 'text-warning' : 'text-muted';
  return (
    <div className="min-w-0 px-3 py-3">
      <div className={`text-[11px] font-semibold ${toneClass}`}>{label}</div>
      <div className="mt-1 truncate font-mono text-xs font-semibold text-on-surface" title={value}>{value}</div>
    </div>
  );
}

function BindingContext({ binding, endpointName }: { binding: MetricServiceBinding; endpointName?: string }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 rounded-md border border-outline bg-surface-lowest p-3 md:grid-cols-4">
      <div><div className="text-[11px] font-semibold text-muted">绑定 ID</div><div className="mt-1 truncate font-mono text-xs text-on-surface">{binding.id}</div></div>
      <div><div className="text-[11px] font-semibold text-muted">端点</div><div className="mt-1 truncate text-xs text-on-surface">{endpointName || binding.endpointId}</div></div>
      <div><div className="text-[11px] font-semibold text-muted">labelMatch</div><div className="mt-1 truncate font-mono text-xs text-on-surface">{formatLabelMatch(binding.labelMatch)}</div></div>
      <div><div className="text-[11px] font-semibold text-muted">basePromQL</div><div className="mt-1 truncate font-mono text-xs text-on-surface">{binding.basePromQL || '-'}</div></div>
    </div>
  );
}

function formatLabelMatch(labelMatch: Record<string, string>) {
  const entries = Object.entries(labelMatch);
  if (!entries.length) return '-';
  return entries.map(([key, value]) => `${key}=${value}`).join(', ');
}

function FormCard({ number, title, description, children }: { number?: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section className="console-panel overflow-hidden">
      <div className="border-b border-outline bg-surface-lowest px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {number ? <span className="font-mono text-xs font-bold text-primary">{number}</span> : null}
          <h3 className="text-base font-semibold text-on-surface">{title}</h3>
          {number ? <span className="ml-0.5 text-sm font-bold leading-none text-danger" aria-label="必填" title="必填">*</span> : null}
        </div>
        {description ? <p className="mt-1 text-xs leading-5 text-muted">{description}</p> : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Field({ label, className = '', required = true, children }: { label: string; className?: string; required?: boolean; children: ReactNode }) {
  return <label className={`block text-xs font-medium text-muted ${className}`}><span className="inline-flex items-center gap-1">{label}{required ? <span className="text-danger leading-none" aria-hidden>*</span> : null}</span>{children}</label>;
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between py-2"><span className="text-emerald-800/70">{label}</span><strong className="font-mono font-semibold text-emerald-800">{value}</strong></div>;
}

function ErrorBox({ message }: { message: string }) {
  return <div className="mt-3 rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-700">{message}</div>;
}
