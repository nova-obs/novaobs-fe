import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, FlaskConical, LoaderCircle } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import type { AlertRuleSpec, AlertRuleTestResult } from '../../services/types';
import { logsApi } from './api';

const fieldClass = 'mt-1.5 h-9 w-full rounded-md border border-outline bg-white px-3 text-sm text-on-surface outline-none focus:border-primary';

export function LogsAlertRulePage() {
  const navigate = useNavigate();
  const { id: ruleId = '' } = useParams();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { data: workspace } = useQuery({ queryKey: ['logs-onboarding-workspace'], queryFn: logsApi.getWorkspace });
  const ruleQuery = useQuery({ queryKey: ['logs-alert-rule', ruleId], queryFn: () => api.getAlertRule(ruleId), enabled: Boolean(ruleId) });
  const updatesQuery = useQuery({ queryKey: ['logs-alert-rule-updates', ruleId], queryFn: () => api.getAlertRuleUpdates(ruleId), enabled: Boolean(ruleId) });
  const routes = workspace?.routes ?? [];
  const initialRouteId = searchParams.get('route_id') || routes[0]?.route.id || '';
  const [routeId, setRouteId] = useState(initialRouteId);
  const selectedRoute = routes.find((item) => item.route.id === routeId) ?? routes[0];
  const selectedService = workspace?.services.find((item) => item.id === selectedRoute?.route.serviceId);
  const policiesQuery = useQuery({
    queryKey: ['alert-notification-policies', selectedService?.id],
    queryFn: () => api.getNotificationPolicies(selectedService?.id),
    enabled: Boolean(selectedService?.id),
  });
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'contains' | 'exact' | 'logsql'>('contains');
  const [expression, setExpression] = useState('');
  const [window, setWindow] = useState('1m');
  const [threshold, setThreshold] = useState(3);
  const [policyId, setPolicyId] = useState('');
  const [severity, setSeverity] = useState<'info' | 'warning' | 'critical'>('warning');
  const [ownerTeam, setOwnerTeam] = useState('');
  const [groupFields, setGroupFields] = useState('');
  const [evaluationDelay, setEvaluationDelay] = useState('5s');
  const [derivedMetric, setDerivedMetric] = useState(false);
  const [testResult, setTestResult] = useState<AlertRuleTestResult | null>(null);
  const [testedInput, setTestedInput] = useState('');
  const initializedRuleID = useRef('');

  useEffect(() => {
    const rule = ruleQuery.data;
    if (!rule || initializedRuleID.current === rule.id) return;
    initializedRuleID.current = rule.id;
    setRouteId(rule.spec.scope.logRouteId);
    setName(rule.spec.name);
    setMode(rule.spec.query.mode);
    setExpression(rule.spec.query.expression);
    setWindow(rule.spec.trigger.window);
    setThreshold(rule.spec.trigger.threshold);
    setPolicyId(rule.spec.notification.policyId);
    setSeverity(rule.spec.notification.severity);
    setOwnerTeam(rule.spec.notification.ownerTeam);
    setGroupFields(rule.spec.grouping.fields.join(', '));
    setEvaluationDelay(rule.spec.trigger.evaluationDelay);
    setDerivedMetric(Boolean(rule.spec.derivedMetric?.enabled));
  }, [ruleQuery.data]);

  useEffect(() => {
    if (policyId || !policiesQuery.data?.length) return;
    const firstEnabled = policiesQuery.data.find((item) => item.enabled);
    if (firstEnabled) setPolicyId(firstEnabled.id);
  }, [policiesQuery.data, policyId]);

  const spec = useMemo<AlertRuleSpec>(() => ({
    name: name.trim(),
    description: '',
    scope: {
      serviceId: selectedService?.id ?? '',
      serviceName: selectedService?.name ?? '',
      logRouteId: selectedRoute?.route.id ?? '',
      endpointId: selectedRoute?.endpoint?.id ?? '',
      accountId: selectedRoute?.endpoint?.accountId ?? '',
      projectId: selectedRoute?.endpoint?.projectId ?? '',
    },
    query: { mode, expression: expression.trim() },
    trigger: {
      mode: 'window', aggregation: 'count', operator: 'gte', threshold,
      window, evaluationInterval: '30s', evaluationDelay, pendingFor: '0s', keepFiringFor: '0s',
    },
    grouping: { fields: groupFields.split(',').map((item) => item.trim()).filter(Boolean), maxInstances: 100 },
    notification: {
      policyId: policyId.trim(), severity,
      ownerTeam: ownerTeam.trim() || selectedService?.ownerTeam || '', runbookUrl: '',
    },
    derivedMetric: derivedMetric ? { enabled: true, signal: 'match_count', labels: {} } : undefined,
  }), [derivedMetric, evaluationDelay, expression, groupFields, mode, name, ownerTeam, policyId, selectedRoute, selectedService, severity, threshold, window]);
  const inputSnapshot = JSON.stringify(spec);
  const formReady = Boolean(spec.name && spec.scope.logRouteId && spec.query.expression && spec.notification.policyId && spec.notification.ownerTeam && threshold > 0);
  const testCurrent = Boolean(testResult?.testToken && testedInput === inputSnapshot);

  const testMutation = useMutation({
    mutationFn: () => api.testAlertRule(spec),
    onSuccess: (result) => { setTestResult(result); setTestedInput(inputSnapshot); },
  });
  const createMutation = useMutation({
    mutationFn: () => ruleId ? api.updateAlertRule(ruleId, spec, testResult?.testToken ?? '') : api.createAlertRule(spec, testResult?.testToken ?? ''),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['logs-alert-rules'] });
      navigate('/logs/alerts');
    },
  });
  const disableMutation = useMutation({
    mutationFn: () => api.disableAlertRule(ruleId),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['logs-alert-rules'] }); navigate('/logs/alerts'); },
  });
  const rollbackMutation = useMutation({
    mutationFn: (updateId: string) => api.rollbackAlertRule(ruleId, updateId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['logs-alert-rule', ruleId] }),
        queryClient.invalidateQueries({ queryKey: ['logs-alert-rule-updates', ruleId] }),
      ]);
      setTestResult(null);
    },
  });
  const compiledPreview = testCurrent ? testResult?.compiledQuery : previewLogsQL(spec);

  return (
    <div className="min-h-[760px] rounded-lg border border-outline bg-surface-lowest shadow-[0_12px_30px_rgba(24,52,96,0.1)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-on-surface">{ruleId ? '更新日志告警' : '创建日志告警'}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <ScopeChip label="服务" value={selectedService?.displayName || selectedService?.name || '-'} />
            <ScopeChip label="路由" value={selectedRoute?.route.name || selectedRoute?.route.id || '-'} />
            <ScopeChip label="数据源" value={selectedRoute?.endpoint ? `VictoriaLogs · ${selectedRoute.endpoint.name}` : '-'} />
          </div>
        </div>
        <div className="flex items-center gap-2">{ruleId && ruleQuery.data?.state === 'enabled' ? <button className="inline-flex h-8 items-center rounded-md border border-red-200 bg-white px-3 text-xs font-semibold text-red-600 disabled:opacity-50" disabled={disableMutation.isPending} onClick={() => disableMutation.mutate()}>停用</button> : null}<Link className="inline-flex h-8 items-center rounded-md border border-outline bg-white px-3 text-xs font-semibold text-muted" to="/logs/alerts">取消</Link></div>
      </div>


      <div className="grid xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4 p-5">
          <Section number="01" title="匹配日志">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="规则名称"><input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：支付失败日志" /></Field>
              <Field label="日志路由">
                <select className={fieldClass} value={selectedRoute?.route.id ?? ''} onChange={(event) => setRouteId(event.target.value)}>
                  {routes.map((item) => <option key={item.route.id} value={item.route.id}>{item.route.name || item.route.id}</option>)}
                </select>
              </Field>
            </div>
            <div className="mt-3 inline-flex rounded-md border border-outline bg-surface-low p-1">
              {([['contains', '包含字符串'], ['exact', '精确匹配'], ['logsql', '完整 LogsQL']] as const).map(([value, label]) => (
                <button key={value} type="button" className={`rounded px-3 py-1.5 text-xs ${mode === value ? 'bg-white font-semibold text-primary shadow-sm' : 'font-medium text-muted'}`} onClick={() => setMode(value)}>{label}</button>
              ))}
            </div>
            <Field label={mode === 'logsql' ? 'LogsQL 表达式' : '匹配内容'} className="mt-3">
              <textarea className="mt-1.5 min-h-24 w-full rounded-md border border-outline bg-white p-3 font-mono text-sm outline-none focus:border-primary" value={expression} onChange={(event) => setExpression(event.target.value)} placeholder={mode === 'logsql' ? 'level:="error" AND "payment failed"' : 'payment failed'} />
            </Field>
            <div className="mt-3 overflow-hidden rounded-md border border-slate-700 bg-black">
              <div className="border-b border-white/15 px-3 py-2 text-[11px] font-semibold text-white/65">实际执行的 LogsQL</div>
              <pre className="overflow-auto whitespace-pre-wrap p-3 font-mono text-xs leading-5 text-white">{compiledPreview || '填写匹配内容后生成'}</pre>
            </div>
          </Section>

          <Section number="02" title="触发条件">
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="时间窗口"><select className={fieldClass} value={window} onChange={(event) => setWindow(event.target.value)}><option value="30s">最近 30 秒</option><option value="1m">最近 1 分钟</option><option value="5m">最近 5 分钟</option><option value="10m">最近 10 分钟</option></select></Field>
              <Field label="条件"><select className={fieldClass} value="gte" disabled><option value="gte">匹配次数 ≥</option></select></Field>
              <Field label="次数"><input className={fieldClass} type="number" min={1} value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} /></Field>
            </div>
          </Section>

          <Section number="03" title="通知对象">
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="通知策略"><select className={fieldClass} value={policyId} onChange={(event) => setPolicyId(event.target.value)}><option value="">请选择通知策略</option>{(policiesQuery.data ?? []).filter((item) => item.enabled || item.id === policyId).map((item) => <option key={item.id} value={item.id} disabled={!item.enabled}>{item.name} · {item.alertmanagerReceiver}{item.enabled ? '' : '（已停用）'}</option>)}</select>{!policiesQuery.isLoading && !policiesQuery.data?.some((item) => item.enabled) ? <span className="mt-1 block text-[11px] font-normal text-amber-700">当前服务没有可用通知策略，请先到告警中心创建或联系管理员。</span> : null}</Field>
              <Field label="责任团队"><input className={fieldClass} value={ownerTeam} onChange={(event) => setOwnerTeam(event.target.value)} placeholder={selectedService?.ownerTeam || '例如：支付团队'} /></Field>
              <Field label="严重程度"><select className={fieldClass} value={severity} onChange={(event) => setSeverity(event.target.value as typeof severity)}><option value="info">提示</option><option value="warning">警告</option><option value="critical">严重</option></select></Field>
            </div>
          </Section>

          <details className="rounded-md border border-outline bg-surface-low/45">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-muted"><span>高级设置</span><ChevronDown className="h-4 w-4" /></summary>
            <div className="grid gap-3 border-t border-outline p-4 md:grid-cols-3">
              <Field label="按字段拆分（逗号分隔）"><input className={fieldClass} value={groupFields} onChange={(event) => setGroupFields(event.target.value)} placeholder="deployment.environment" /></Field>
              <Field label="评估延迟"><select className={fieldClass} value={evaluationDelay} onChange={(event) => setEvaluationDelay(event.target.value)}><option value="0s">不延迟</option><option value="5s">5 秒</option><option value="10s">10 秒</option></select></Field>
              <Field label="趋势指标"><select className={fieldClass} value={derivedMetric ? 'yes' : 'no'} onChange={(event) => { const enabled = event.target.value === 'yes'; setDerivedMetric(enabled); if (enabled) setGroupFields(''); }}><option value="no">不生成</option><option value="yes">生成规则级匹配计数</option></select></Field>
            </div>
          </details>
        </div>

        <aside className="flex flex-col border-t border-outline bg-surface-low/55 p-5 xl:border-l xl:border-t-0">
          <h3 className="text-base font-semibold text-on-surface">测试并启用</h3>
          <button type="button" className="mt-4 inline-flex h-9 items-center justify-center gap-2 rounded-md border border-primary bg-primary-soft text-sm font-semibold text-primary disabled:opacity-50" disabled={!formReady || testMutation.isPending} onClick={() => testMutation.mutate()}>
            {testMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}测试规则
          </button>
          {testMutation.error ? <ErrorBox message={(testMutation.error as Error).message} /> : null}
          {testCurrent && testResult ? (
            <div className="mt-4 rounded-md border border-emerald-500/25 bg-emerald-50 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><Check className="h-4 w-4" />测试通过，可以启用</div>
              <div className="mt-3 divide-y divide-emerald-200/70 text-sm">
                <Result label="匹配日志" value={`${testResult.matchedLogCount} 条`} />
                <Result label="触发分组" value={`${testResult.estimatedInstanceCount} 个`} />
                <Result label="查询耗时" value={`${testResult.queryDurationMillis} ms`} />
              </div>
            </div>
          ) : testResult ? <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">规则内容已变化，请重新测试。</div> : null}
          {createMutation.error ? <ErrorBox message={(createMutation.error as Error).message} /> : null}
          <div className="mt-auto pt-6">
            <button type="button" className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45" disabled={!testCurrent || createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? '正在提交…' : ruleId ? '更新告警' : '启用告警'}
            </button>
          </div>
        </aside>
      </div>
      {ruleId ? (
        <section className="border-t border-outline p-5">
          <div className="mb-3"><h3 className="text-base font-semibold text-on-surface">更新记录</h3></div>
          <div className="grid gap-2">
            {(updatesQuery.data ?? []).map((update, index) => (
              <div key={update.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-outline bg-white px-3 py-2">
                <div><div className="text-sm font-medium text-on-surface">{update.changeSummary || update.action}</div><div className="mt-0.5 font-mono text-[11px] text-muted">{new Date(update.createdAt).toLocaleString('zh-CN', { hour12: false })} · {update.actor.name || update.actor.id}</div></div>
                <button className="text-xs font-semibold text-primary disabled:opacity-40" disabled={index === 0 || rollbackMutation.isPending} onClick={() => rollbackMutation.mutate(update.id)}>回退到此记录</button>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function previewLogsQL(spec: AlertRuleSpec) {
  if (!spec.query.expression) return '';
  const service = JSON.stringify(spec.scope.serviceName);
  const expression = spec.query.mode === 'contains'
    ? JSON.stringify(spec.query.expression)
    : spec.query.mode === 'exact' ? `_msg:=${JSON.stringify(spec.query.expression)}` : spec.query.expression;
  return `_time:${spec.trigger.window} AND "service.name":=${service} AND (${expression})\n| stats count() AS matches\n| filter matches >= ${spec.trigger.threshold}`;
}

function ScopeChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-outline bg-surface-low/70 px-2 py-1 text-xs">
      <span className="font-medium text-muted">{label}</span>
      <span className="max-w-[220px] truncate font-medium text-on-surface">{value}</span>
    </span>
  );
}
function Section({ number, title, children }: { number: string; title: string; children: ReactNode }) { return <section className="rounded-md border border-outline bg-white p-4"><div className="mb-3 flex items-center gap-2"><span className="font-mono text-xs font-bold text-primary">{number}</span><h3 className="text-base font-semibold text-on-surface">{title}</h3><span className="ml-0.5 text-sm font-bold leading-none text-danger" aria-label="必填" title="必填">*</span></div>{children}</section>; }
function Field({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) { return <label className={`block text-xs font-medium text-muted ${className}`}><span className="inline-flex items-center gap-1">{label}<span className="text-danger leading-none" aria-hidden>*</span></span>{children}</label>; }
function Result({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between py-2"><span className="text-emerald-800/70">{label}</span><strong className="font-mono font-semibold text-emerald-800">{value}</strong></div>; }
function ErrorBox({ message }: { message: string }) { return <div className="mt-3 rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-700">{message}</div>; }
