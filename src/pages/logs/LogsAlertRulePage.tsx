import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, FlaskConical, LoaderCircle, X } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import type { AlertRuleSpec, AlertRuleTestResult } from '../../services/types';
import { logsApi, type LogEndpoint, type LogRouteView, type LogTargetView, type LogsServiceSummary } from './api';
import { routeAccessPriority } from './ServicePickerPanel';

const fieldClass = 'mt-1.5 h-9 w-full rounded-md border border-outline bg-white px-3 text-sm text-on-surface outline-none focus:border-primary';

type ServiceLogMode = 'external' | 'platform';
type LogAlertQueryMode = 'contains' | 'exact' | 'logsql';

function asLogAlertQueryMode(mode: AlertRuleSpec['query']['mode']): LogAlertQueryMode {
  if (mode === 'exact' || mode === 'logsql') return mode;
  return 'contains';
}

interface ServiceLogLink {
  id: string;
  mode: ServiceLogMode;
  serviceId: string;
  serviceName: string;
  service: LogsServiceSummary;
  sourceLabel: string;
  endpoint: LogEndpoint | null;
  baseFilter: string;
  route?: LogRouteView;
  target?: LogTargetView;
}

function serviceLabel(service?: LogsServiceSummary | null, fallback = '') {
  return service?.name || fallback || '-';
}

function buildServiceLogLinks(services: LogsServiceSummary[], routes: LogRouteView[], targets: LogTargetView[]): ServiceLogLink[] {
  const routesByService = new Map<string, LogRouteView[]>();
  for (const route of routes) {
    const items = routesByService.get(route.route.serviceId) ?? [];
    routesByService.set(route.route.serviceId, [...items, route]);
  }
  const targetsByService = new Map<string, LogTargetView[]>();
  for (const target of targets) {
    if (target.target.status === 'disabled') continue;
    const items = targetsByService.get(target.target.serviceId) ?? [];
    targetsByService.set(target.target.serviceId, [...items, target]);
  }
  const links: ServiceLogLink[] = [];
  for (const service of services) {
    const target = (targetsByService.get(service.id) ?? [])[0];
    if (target?.endpoint) {
      links.push({
        id: service.id,
        mode: 'external',
        serviceId: service.id,
        serviceName: serviceLabel(service, service.id),
        service,
        sourceLabel: '纳管日志链路',
        endpoint: target.endpoint,
        baseFilter: target.target.baseFilter,
        target,
      });
      continue;
    }
    const route = [...(routesByService.get(service.id) ?? [])].sort((left, right) => routeAccessPriority(left) - routeAccessPriority(right))[0];
    if (!route?.endpoint) continue;
    links.push({
      id: service.id,
      mode: 'platform',
      serviceId: service.id,
      serviceName: serviceLabel(service, service.id),
      service,
      sourceLabel: '平台采集路由',
      endpoint: route.endpoint,
      baseFilter: '',
      route,
    });
  }
  return links;
}

function serviceIdFromParams(searchParams: URLSearchParams, routes: LogRouteView[], targets: LogTargetView[]) {
  const direct = searchParams.get('service_id');
  if (direct) return direct;
  const targetId = searchParams.get('target_id');
  if (targetId) return targets.find((item) => item.target.id === targetId)?.target.serviceId ?? '';
  const routeId = searchParams.get('route_id');
  if (routeId) return routes.find((item) => item.route.id === routeId)?.route.serviceId ?? '';
  return '';
}

export function LogsAlertRulePage() {
  const navigate = useNavigate();
	const { productId = '', serviceId = '', id: ruleId = '' } = useParams();
	return <LogsAlertRuleEditorDrawer productId={productId} serviceId={serviceId} ruleId={ruleId} onClose={() => navigate(`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}/logs/alerts`)} />;
}

export function LogsAlertRuleEditorDrawer({ productId, serviceId: routeServiceId, ruleId = '', onClose }: { productId: string; serviceId: string; ruleId?: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
	const { data: workspace } = useQuery({ queryKey: ['logs-onboarding-workspace', productId, routeServiceId], queryFn: () => logsApi.getWorkspace(productId, routeServiceId), enabled: Boolean(productId && routeServiceId) });
  const ruleQuery = useQuery({ queryKey: ['logs-alert-rule', ruleId], queryFn: () => api.getAlertRule(ruleId), enabled: Boolean(ruleId) });
  const updatesQuery = useQuery({ queryKey: ['logs-alert-rule-updates', ruleId], queryFn: () => api.getAlertRuleUpdates(ruleId), enabled: Boolean(ruleId) });
  const routes = workspace?.routes ?? [];
  const targets = workspace?.targets ?? [];
  const services = workspace?.services ?? [];
  const serviceLinks = useMemo(() => buildServiceLogLinks(services, routes, targets), [routes, services, targets]);
	const paramServiceId = serviceIdFromParams(searchParams, routes, targets);
	const initialServiceId = routeServiceId || paramServiceId;
  const [serviceId, setServiceId] = useState(initialServiceId);
  const selectedLink = serviceLinks.find((item) => item.serviceId === serviceId) ?? serviceLinks[0];
  const selectedService = selectedLink?.service;
  const policiesQuery = useQuery({
    queryKey: ['alert-notification-policies', selectedService?.id],
    queryFn: () => api.getNotificationPolicies(selectedService?.id),
    enabled: Boolean(selectedService?.id),
  });
  const [name, setName] = useState('');
  const [mode, setMode] = useState<LogAlertQueryMode>('contains');
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
    setServiceId(rule.spec.scope.serviceId);
    setName(rule.spec.name);
    setMode(asLogAlertQueryMode(rule.spec.query.mode));
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
    if (paramServiceId && serviceId !== paramServiceId) {
      setServiceId(paramServiceId);
      return;
    }
    if (!serviceId && serviceLinks[0]) {
      setServiceId(serviceLinks[0].serviceId);
    }
  }, [paramServiceId, serviceId, serviceLinks]);

  useEffect(() => {
    if (policyId || !policiesQuery.data?.length) return;
    const firstEnabled = policiesQuery.data.find((item) => item.enabled);
    if (firstEnabled) setPolicyId(firstEnabled.id);
  }, [policiesQuery.data, policyId]);

  const spec = useMemo<AlertRuleSpec>(() => ({
    signalType: 'logs',
    name: name.trim(),
    description: '',
    scope: {
      serviceId: selectedService?.id ?? '',
      serviceName: selectedService?.name ?? '',
      logRouteId: selectedLink?.mode === 'platform' ? selectedLink.route?.route.id ?? '' : '',
      logTargetId: selectedLink?.mode === 'external' ? selectedLink.target?.target.id ?? '' : '',
      endpointId: selectedLink?.endpoint?.id ?? '',
      accountId: selectedLink?.endpoint?.accountId ?? '',
      projectId: selectedLink?.endpoint?.projectId ?? '',
      baseFilter: selectedLink?.mode === 'external' ? selectedLink.baseFilter : '',
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
  }), [derivedMetric, evaluationDelay, expression, groupFields, mode, name, ownerTeam, policyId, selectedLink, selectedService, severity, threshold, window]);
  const inputSnapshot = JSON.stringify(spec);
  const missingFields = useMemo(() => {
    const missing: string[] = [];
    if (!spec.name) missing.push('规则名称');
    if (!spec.scope.logRouteId && !spec.scope.logTargetId) missing.push('服务日志链路');
    if (!spec.query.expression) missing.push(mode === 'logsql' ? 'LogsQL 表达式' : '匹配内容');
    if (!spec.notification.policyId) missing.push('通知策略');
    if (!spec.notification.ownerTeam) missing.push('责任团队');
    if (!(threshold > 0)) missing.push('次数');
    return missing;
  }, [mode, spec, threshold]);
  const formReady = missingFields.length === 0;
  const testCurrent = Boolean(testResult?.testToken && testedInput === inputSnapshot);
  const compiledPreview = testCurrent ? testResult?.compiledQuery : previewLogsQL(spec);
  const actionHint = missingFields.length > 0
    ? `测试前还需：${formatMissing(missingFields)}`
    : testCurrent
      ? '测试通过，可以启用告警。'
      : testResult
        ? '规则内容已变化，请重新测试。'
        : '启用前需要先测试当前规则。';

  const testMutation = useMutation({
    mutationFn: () => api.testAlertRule(spec),
    onSuccess: (result) => { setTestResult(result); setTestedInput(inputSnapshot); },
  });
  const createMutation = useMutation({
    mutationFn: () => ruleId ? api.updateAlertRule(ruleId, spec, testResult?.testToken ?? '') : api.createAlertRule(spec, testResult?.testToken ?? ''),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['logs-alert-rules'] });
      onClose();
    },
  });
  const disableMutation = useMutation({
    mutationFn: () => api.disableAlertRule(ruleId),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['logs-alert-rules'] }); onClose(); },
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

  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-slate-900/28">
      <button type="button" className="absolute inset-0 cursor-default border-0 bg-transparent" aria-label="关闭日志告警编辑遮罩" onClick={onClose} />
      <aside className="console-drawer-panel relative flex h-full w-full max-w-[760px] flex-col border-l border-outline bg-white shadow-[0_20px_60px_rgba(24,52,96,0.24)]" role="dialog" aria-modal="true" aria-labelledby="alert-rule-editor-title">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-outline bg-surface-lowest px-4 py-3">
          <div id="alert-rule-editor-title" className="truncate text-sm font-semibold text-on-surface">{ruleId ? '编辑日志告警' : '创建日志告警'}</div>
          <div className="flex shrink-0 items-center gap-2">
            {ruleId && ruleQuery.data?.state === 'enabled' ? <button className="console-button console-button-danger" disabled={disableMutation.isPending} onClick={() => disableMutation.mutate()}>停用</button> : null}
            <button className="console-icon-button border-outline bg-white" onClick={onClose} aria-label="关闭日志告警编辑" title="关闭">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-auto bg-surface px-4 py-4">
          <AlertRuleProfileStrip
            serviceName={selectedLink?.serviceName || '-'}
            thresholdLabel={`${window} 内匹配 ≥ ${threshold} 次`}
            policyLabel={policyId || '未选择通知策略'}
            testLabel={testCurrent ? '已测试' : '待测试'}
          />

          <FormCard number="01" title="匹配日志" description="选择作用服务，并定义要匹配的日志内容。">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="规则名称"><input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：支付失败日志" /></Field>
              <Field label="服务">
                <select className={fieldClass} value={selectedLink?.serviceId ?? ''} onChange={(event) => setServiceId(event.target.value)}>
                  {serviceLinks.map((item) => <option key={item.id} value={item.serviceId}>{item.serviceName} · {item.sourceLabel}</option>)}
                </select>
                {!serviceLinks.length ? <span className="mt-1 block text-[11px] font-normal text-amber-700">当前没有可用于告警的服务日志链路，请先完成平台采集路由或在日志分析中登记外部日志链路。</span> : null}
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
              <pre className="max-h-44 overflow-auto whitespace-pre-wrap p-3 font-mono text-xs leading-5 text-white">{compiledPreview || '填写匹配内容后生成'}</pre>
            </div>
          </FormCard>

          <FormCard number="02" title="触发条件" description="设置窗口内的匹配次数门槛。">
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="时间窗口"><select className={fieldClass} value={window} onChange={(event) => setWindow(event.target.value)}><option value="30s">最近 30 秒</option><option value="1m">最近 1 分钟</option><option value="5m">最近 5 分钟</option><option value="10m">最近 10 分钟</option></select></Field>
              <Field label="条件"><select className={fieldClass} value="gte" disabled><option value="gte">匹配次数 ≥</option></select></Field>
              <Field label="次数"><input className={fieldClass} type="number" min={1} value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} /></Field>
            </div>
          </FormCard>

          <FormCard number="03" title="通知对象" description="选择接收策略和责任归属。">
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="通知策略"><select className={fieldClass} value={policyId} onChange={(event) => setPolicyId(event.target.value)}><option value="">请选择通知策略</option>{(policiesQuery.data ?? []).filter((item) => item.enabled || item.id === policyId).map((item) => <option key={item.id} value={item.id} disabled={!item.enabled}>{item.name} · {item.receiver}{item.enabled ? '' : '（已停用）'}</option>)}</select>{!policiesQuery.isLoading && !policiesQuery.data?.some((item) => item.enabled) ? <span className="mt-1 block text-[11px] font-normal text-amber-700">当前服务没有可用通知策略，请联系管理员配置。</span> : null}</Field>
              <Field label="责任团队"><input className={fieldClass} value={ownerTeam} onChange={(event) => setOwnerTeam(event.target.value)} placeholder={selectedService?.ownerTeam || '例如：支付团队'} /></Field>
              <Field label="严重程度"><select className={fieldClass} value={severity} onChange={(event) => setSeverity(event.target.value as typeof severity)}><option value="info">提示</option><option value="warning">警告</option><option value="critical">严重</option></select></Field>
            </div>
          </FormCard>

          <details className="console-panel overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-on-surface">
              <span>高级设置</span>
              <ChevronDown className="h-4 w-4 text-muted" />
            </summary>
            <div className="grid gap-3 border-t border-outline p-4 md:grid-cols-3">
              <Field label="按字段拆分（逗号分隔）" required={false}><input className={fieldClass} value={groupFields} onChange={(event) => setGroupFields(event.target.value)} placeholder="k8s.namespace.name" /></Field>
              <Field label="评估延迟" required={false}><select className={fieldClass} value={evaluationDelay} onChange={(event) => setEvaluationDelay(event.target.value)}><option value="0s">不延迟</option><option value="5s">5 秒</option><option value="10s">10 秒</option></select></Field>
              <Field label="趋势指标" required={false}><select className={fieldClass} value={derivedMetric ? 'yes' : 'no'} onChange={(event) => { const enabled = event.target.value === 'yes'; setDerivedMetric(enabled); if (enabled) setGroupFields(''); }}><option value="no">不生成</option><option value="yes">生成规则级匹配计数</option></select></Field>
            </div>
          </details>

          <FormCard title="测试并启用" description="当前表单通过测试后才允许启用。">
            {testMutation.error ? <ErrorBox message={(testMutation.error as Error).message} /> : null}
            {testCurrent && testResult ? (
              <div className="rounded-md border border-emerald-500/25 bg-emerald-50 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><Check className="h-4 w-4" />测试通过，可以启用</div>
                <div className="mt-3 divide-y divide-emerald-200/70 text-sm">
                  <Result label="匹配日志" value={`${testResult.matchedLogCount} 条`} />
                  <Result label="触发分组" value={`${testResult.estimatedInstanceCount} 个`} />
                  <Result label="查询耗时" value={`${testResult.queryDurationMillis} ms`} />
                </div>
              </div>
            ) : testResult ? <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">规则内容已变化，请重新测试。</div> : <div className="rounded-md border border-outline bg-white p-3 text-xs leading-5 text-muted">填写必填项后先测试规则，测试通过后再启用。</div>}
            {createMutation.error ? <ErrorBox message={(createMutation.error as Error).message} /> : null}
          </FormCard>

          {ruleId ? (
            <FormCard title="更新记录" description="查看最近变更，必要时回退到历史记录。">
              <div className="grid gap-2">
                {(updatesQuery.data ?? []).map((update, index) => (
                  <div key={update.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-outline bg-white px-3 py-2">
                    <div><div className="text-sm font-medium text-on-surface">{update.changeSummary || update.action}</div><div className="mt-0.5 font-mono text-[11px] text-muted">{new Date(update.createdAt).toLocaleString('zh-CN', { hour12: false })} · {update.actor.name || update.actor.id}</div></div>
                    <button className="text-xs font-semibold text-primary disabled:opacity-40" disabled={index === 0 || rollbackMutation.isPending} onClick={() => rollbackMutation.mutate(update.id)}>回退到此记录</button>
                  </div>
                ))}
              </div>
            </FormCard>
          ) : null}
        </div>
        <div className="console-action-bar shrink-0">
          <div className="min-w-0 text-xs text-muted">{actionHint}</div>
          <div className="flex gap-2">
            <button className="console-button" onClick={onClose}>取消</button>
            <button type="button" className="console-button" disabled={!formReady || testMutation.isPending} onClick={() => testMutation.mutate()} title={missingFields.length > 0 ? `还需：${formatMissing(missingFields)}` : '测试规则'}>
              {testMutation.isPending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
              测试规则
            </button>
            <button type="button" className="console-button console-button-primary" disabled={!testCurrent || createMutation.isPending} onClick={() => createMutation.mutate()} title={testCurrent ? (ruleId ? '更新告警' : '启用告警') : '请先测试当前规则'}>
              {createMutation.isPending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {ruleId ? '更新告警' : '启用告警'}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function previewLogsQL(spec: AlertRuleSpec) {
  if (!spec.query.expression) return '';
  const scopeFilter = spec.scope.baseFilter ? `(${spec.scope.baseFilter})` : `"service.name":=${JSON.stringify(spec.scope.serviceName)}`;
  const expression = spec.query.mode === 'contains'
    ? JSON.stringify(spec.query.expression)
    : spec.query.mode === 'exact' ? `_msg:=${JSON.stringify(spec.query.expression)}` : spec.query.expression;
  return `_time:${spec.trigger.window} AND ${scopeFilter} AND (${expression})\n| stats count() AS matches\n| filter matches >= ${spec.trigger.threshold}`;
}

function AlertRuleProfileStrip({ serviceName, thresholdLabel, policyLabel, testLabel }: { serviceName: string; thresholdLabel: string; policyLabel: string; testLabel: string }) {
  return (
    <section className="overflow-hidden rounded-md border border-outline bg-white">
      <div className="grid divide-y divide-outline md:grid-cols-4 md:divide-x md:divide-y-0">
        <SummaryItem label="作用服务" value={serviceName} />
        <SummaryItem label="触发门槛" value={thresholdLabel} />
        <SummaryItem label="通知策略" value={policyLabel} />
        <SummaryItem label="测试状态" value={testLabel} tone={testLabel === '已测试' ? 'success' : 'warning'} />
      </div>
    </section>
  );
}

function SummaryItem({ label, value, tone = 'muted' }: { label: string; value: string; tone?: 'success' | 'warning' | 'muted' }) {
  const toneClass = tone === 'success' ? 'text-emerald-700' : tone === 'warning' ? 'text-warning' : 'text-muted';
  return (
    <div className="min-w-0 px-3 py-3">
      <div className={`text-[11px] font-semibold ${toneClass}`}>{label}</div>
      <div className="mt-1 truncate font-mono text-xs font-semibold text-on-surface" title={value}>{value}</div>
    </div>
  );
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

function Result({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between py-2"><span className="text-emerald-800/70">{label}</span><strong className="font-mono font-semibold text-emerald-800">{value}</strong></div>;
}

function ErrorBox({ message }: { message: string }) {
  return <div className="mt-3 rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-700">{message}</div>;
}

function formatMissing(items: string[]) {
  return items.join('、');
}
