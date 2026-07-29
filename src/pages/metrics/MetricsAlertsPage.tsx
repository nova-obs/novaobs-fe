import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Pencil, Plus, RefreshCw, Search, X } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { DataPanel } from '../../components/DataPanel';
import { EmptyState } from '../../components/EmptyState';
import { StatusBadge } from '../../components/StatusBadge';
import { accessAllows, usePlatformAccess } from '../../layouts/access';
import { api, ApiRequestError } from '../../services/api';
import type { AlertRule, AlertRuleSpec, AlertRuleTestResult, AlertSeverity, Product } from '../../services/types';
import { metricsApi, type MetricsIntegrationView } from './api';

type MetricsQueryMode = 'promql' | 'metricsql';

const alertTestReceiptTTLMillis = 10 * 60 * 1000;

interface MetricAlertContext {
  product: Product;
  integration: MetricsIntegrationView['integration'];
}

export function MetricsAlertsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: ruleId = '' } = useParams();
  const { data: accessContext } = usePlatformAccess();
  const [query, setQuery] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const creating = location.pathname.endsWith('/alerts/new');
  const editorOpen = creating || Boolean(ruleId);

  const rulesQuery = useQuery({
    queryKey: ['alerts', 'rules', 'metrics'],
    queryFn: () => api.getAlertRules({ signalType: 'metrics' }),
    retry: false,
  });
  const productsQuery = useQuery({ queryKey: ['products'], queryFn: api.getProducts, retry: false });
  const integrationsQuery = useQuery({ queryKey: ['metrics-integrations'], queryFn: metricsApi.listIntegrations, retry: false });
  const contexts = useMemo(
    () => buildMetricAlertContexts(productsQuery.data ?? [], integrationsQuery.data ?? []),
    [productsQuery.data, integrationsQuery.data],
  );
  const canMaintainProduct = (productId: string) => Boolean(accessContext && accessAllows(accessContext, {
    kind: 'product',
    productId,
    minimum: 'product-maintainer',
  }));
  const maintainableContexts = contexts.filter((context) => canMaintainProduct(context.product.id));
  const productNames = useMemo(() => new Map((productsQuery.data ?? []).map((item) => [item.id, item.name])), [productsQuery.data]);
  const rules = rulesQuery.data ?? [];
  const editorRule = rules.find((rule) => rule.id === ruleId);
  const editorAllowed = creating
    ? maintainableContexts.length > 0
    : Boolean(editorRule && canMaintainProduct(editorRule.spec.scope.productId ?? ''));
  const visibleRules = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return rules.filter((rule) => {
      const productId = rule.spec.scope.productId ?? '';
      if (productFilter && productId !== productFilter) return false;
      if (!keyword) return true;
      return `${rule.spec.name} ${rule.spec.query.expression} ${productId} ${productNames.get(productId) ?? ''}`.toLowerCase().includes(keyword);
    });
  }, [productFilter, productNames, query, rules]);
  const loading = rulesQuery.isLoading;
  const error = rulesQuery.error;
  const contextError = productsQuery.error || integrationsQuery.error;
  const refresh = () => void Promise.all([rulesQuery.refetch(), productsQuery.refetch(), integrationsQuery.refetch()]);
  const closeEditor = () => navigate('/metrics/alerts');

  return (
    <div className="console-workbench min-h-0 overflow-auto">
      <DataPanel
        title="指标告警"
        help="规则按产品隔离，查询目标由产品当前连接的 VictoriaMetrics 写入目标决定。"
        action={(
          <div className="flex w-full flex-wrap items-center justify-end gap-2 lg:w-auto">
            <select className="console-input h-9 w-full min-w-40 lg:w-auto" value={productFilter} onChange={(event) => setProductFilter(event.target.value)} aria-label="筛选指标告警产品">
              <option value="">全部产品</option>
              {(productsQuery.data ?? []).map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
            <div className="relative w-full lg:w-72">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <input className="console-input h-9 w-full pl-8 text-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索规则、产品或查询表达式" />
            </div>
            <button type="button" className="console-icon-button" aria-label="刷新指标告警" title="刷新指标告警" onClick={refresh}>
              <RefreshCw className={`h-3.5 w-3.5 ${rulesQuery.isFetching ? 'animate-spin' : ''}`} />
            </button>
            {maintainableContexts.length ? (
              <Link className="console-button console-button-primary" to="/metrics/alerts/new"><Plus className="h-3.5 w-3.5" />创建告警</Link>
            ) : (
              <button type="button" className="console-button console-button-primary" disabled title="请先接入并连接一个有效产品"><Plus className="h-3.5 w-3.5" />创建告警</button>
            )}
          </div>
        )}
      >
        {contextError ? <div className="console-notice console-notice-warning mb-3">产品上下文加载失败，现有规则仍可查看，创建和编辑暂不可用：{errorMessage(contextError)}</div> : null}
        {loading ? <AlertTableSkeleton /> : error ? (
          <div className="console-notice console-notice-danger flex items-center justify-between gap-3">
            <span>{errorMessage(error)}</span><button type="button" className="console-button" onClick={refresh}>重试</button>
          </div>
        ) : visibleRules.length === 0 ? (
          <EmptyState
            title={rules.length ? '未找到匹配的指标告警规则' : '暂无指标告警规则'}
            action={!rules.length && maintainableContexts.length ? <Link className="console-button console-button-primary" to="/metrics/alerts/new">创建指标告警</Link> : undefined}
          />
        ) : (
          <div className="overflow-x-auto rounded-md border border-outline bg-white">
            <table className="console-table w-full min-w-[1120px] table-fixed">
              <colgroup><col className="w-[16%]" /><col className="w-[13%]" /><col className="w-[24%]" /><col className="w-[12%]" /><col className="w-[12%]" /><col className="w-[13%]" /><col className="w-[7%]" /></colgroup>
              <thead><tr><th>规则</th><th>产品</th><th>查询</th><th>触发条件</th><th>通知</th><th>状态</th><th className="text-right">操作</th></tr></thead>
              <tbody>{visibleRules.map((rule) => (
                <tr key={rule.id}>
                  <td><div className="truncate font-semibold text-on-surface" title={rule.spec.name}>{rule.spec.name || rule.id}</div><div className="mt-1 font-mono text-[11px] text-muted">{formatDateTime(rule.updatedAt)}</div></td>
                  <td><div className="truncate font-medium">{productNames.get(rule.spec.scope.productId ?? '') || '-'}</div><div className="mt-1 truncate font-mono text-[11px] text-muted">{rule.spec.scope.productId || '-'}</div></td>
                  <td><div className="truncate font-mono text-xs" title={rule.spec.query.expression}>{rule.spec.query.expression || '-'}</div><div className="mt-1 text-[11px] text-muted">{rule.spec.query.mode === 'metricsql' ? 'MetricsQL' : 'PromQL'}</div></td>
                  <td className="font-mono text-xs">{triggerLabel(rule)}</td>
                  <td><StatusBadge value={rule.spec.notification.severity} /><div className="mt-1 truncate text-[11px] text-muted" title={rule.spec.notification.ownerTeam}>{rule.spec.notification.ownerTeam || rule.spec.notification.policyId || '-'}</div></td>
                  <td><div className="flex flex-wrap gap-1"><StatusBadge value={rule.state} /><StatusBadge value={rule.applyStatus} /></div></td>
                  <td className="text-right">{canMaintainProduct(rule.spec.scope.productId ?? '') ? <Link className="console-icon-button inline-flex" to={`/metrics/alerts/${encodeURIComponent(rule.id)}`} aria-label={`编辑指标告警 ${rule.spec.name}`} title="编辑"><Pencil className="h-3.5 w-3.5" /></Link> : <span className="text-xs text-muted">只读</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </DataPanel>
      {editorOpen && editorAllowed ? <MetricsAlertEditor mode={creating ? 'create' : 'edit'} ruleId={ruleId} contexts={maintainableContexts} onClose={closeEditor} /> : null}
    </div>
  );
}

function buildMetricAlertContexts(products: Product[], integrations: MetricsIntegrationView[]): MetricAlertContext[] {
  return products
    .filter((product) => product.status === 'active')
    .flatMap((product) => {
      const view = integrations.find(({ integration }) => integration.productId === product.id && integration.desiredState === 'connected');
      return view ? [{ product, integration: view.integration }] : [];
    });
}

function MetricsAlertEditor({ mode, ruleId, contexts, onClose }: { mode: 'create' | 'edit'; ruleId: string; contexts: MetricAlertContext[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [productId, setProductId] = useState('');
  const [name, setName] = useState('');
  const [queryMode, setQueryMode] = useState<MetricsQueryMode>('promql');
  const [expression, setExpression] = useState('');
  const [operator, setOperator] = useState<'gt' | 'gte'>('gte');
  const [threshold, setThreshold] = useState(1);
  const [triggerWindow, setTriggerWindow] = useState('5m');
  const [evaluationInterval, setEvaluationInterval] = useState('30s');
  const [policyId, setPolicyId] = useState('');
  const [severity, setSeverity] = useState<AlertSeverity>('warning');
  const [ownerTeam, setOwnerTeam] = useState('');
  const [groupFields, setGroupFields] = useState('');
  const [testResult, setTestResult] = useState<AlertRuleTestResult | null>(null);
  const [testedInput, setTestedInput] = useState('');
  const [testExpiresAt, setTestExpiresAt] = useState(0);

  const ruleQuery = useQuery({ queryKey: ['alerts', 'rule', 'metrics', ruleId], queryFn: () => api.getAlertRule(ruleId), enabled: mode === 'edit' && Boolean(ruleId), retry: false });
  const policiesQuery = useQuery({ queryKey: ['alerts', 'notification-policies', 'platform'], queryFn: () => api.getNotificationPolicies(), retry: false });
  const policies = (policiesQuery.data ?? []).filter((policy) => policy.enabled && !policy.serviceId);
  const selectedContext = contexts.find((context) => context.product.id === productId) ?? null;
  const rule = ruleQuery.data;
  const invalidRule = Boolean(rule && rule.spec.signalType !== 'metrics');
  const loadedMetricRule = mode === 'create' || Boolean(rule && rule.spec.signalType === 'metrics');

  useEffect(() => {
    if (mode !== 'create' || productId || !contexts[0]) return;
    setProductId(contexts[0].product.id);
  }, [contexts, mode, productId]);

  useEffect(() => {
    if (policyId || !policies[0]) return;
    setPolicyId(policies[0].id);
  }, [policies, policyId]);

  useEffect(() => {
    const rule = ruleQuery.data;
    if (!rule || rule.spec.signalType !== 'metrics') return;
    setProductId(rule.spec.scope.productId ?? '');
    setName(rule.spec.name);
    setQueryMode(rule.spec.query.mode === 'metricsql' ? 'metricsql' : 'promql');
    setExpression(rule.spec.query.expression);
    setOperator(rule.spec.trigger.operator);
    setThreshold(rule.spec.trigger.threshold);
    setTriggerWindow(rule.spec.trigger.window);
    setEvaluationInterval(rule.spec.trigger.evaluationInterval);
    setPolicyId(rule.spec.notification.policyId);
    setSeverity(rule.spec.notification.severity);
    setOwnerTeam(rule.spec.notification.ownerTeam);
    setGroupFields(rule.spec.grouping.fields.join(', '));
  }, [ruleQuery.data]);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!testExpiresAt) return;
    const remaining = testExpiresAt - Date.now();
    if (remaining <= 0) {
      setTestedInput('');
      return;
    }
    const timer = window.setTimeout(() => setTestedInput(''), remaining);
    return () => window.clearTimeout(timer);
  }, [testExpiresAt]);

  const spec = useMemo<AlertRuleSpec>(() => ({
    signalType: 'metrics',
    name: name.trim(),
    description: '',
    scope: {
      serviceId: '', serviceName: '', logRouteId: '', accountId: '', projectId: '',
      productId: selectedContext?.product.id ?? productId,
      endpointId: selectedContext?.integration.destinationRef ?? '',
      scopeLabels: ruleQuery.data?.spec.scope.scopeLabels ?? {},
    },
    query: { mode: queryMode, expression: expression.trim() },
    trigger: { mode: 'window', aggregation: 'count', operator, threshold, window: triggerWindow, evaluationInterval, evaluationDelay: '0s', pendingFor: '0s', keepFiringFor: '0s' },
    grouping: { fields: groupFields.split(',').map((field) => field.trim()).filter(Boolean), maxInstances: 100 },
    notification: { policyId, severity, ownerTeam: ownerTeam.trim(), runbookUrl: '' },
  }), [evaluationInterval, expression, groupFields, name, operator, ownerTeam, policyId, productId, queryMode, ruleQuery.data?.spec.scope.scopeLabels, selectedContext, severity, threshold, triggerWindow]);
  const inputSnapshot = JSON.stringify(spec);
  const missing = [
    !selectedContext && '已连接指标产品', !spec.name && '规则名称', !spec.query.expression && '查询表达式', !(threshold > 0) && '阈值', !policyId && '平台级通知策略', !ownerTeam.trim() && '责任团队',
  ].filter(Boolean) as string[];
  const testCurrent = Boolean(testResult?.testToken && testedInput === inputSnapshot && testExpiresAt > Date.now());
  const canTest = missing.length === 0 && !invalidRule && loadedMetricRule && !ruleQuery.error;
  const canSave = canTest && testCurrent && !ruleQuery.isLoading;

  const testMutation = useMutation({
    mutationFn: ({ testedSpec }: { testedSpec: AlertRuleSpec; snapshot: string }) => {
      if (mode === 'edit' && (!rule || rule.spec.signalType !== 'metrics')) throw new Error('指标告警规则详情尚未成功加载');
      return api.testAlertRule(testedSpec);
    },
    onSuccess: (result, variables) => {
      const testedAt = Date.parse(result.testedAt);
      setTestResult(result);
      setTestedInput(variables.snapshot);
      setTestExpiresAt((Number.isNaN(testedAt) ? Date.now() : testedAt) + alertTestReceiptTTLMillis);
    },
  });
  const saveMutation = useMutation({
    mutationFn: ({ savedSpec, snapshot, testToken }: { savedSpec: AlertRuleSpec; snapshot: string; testToken: string }) => {
      if (mode === 'edit' && (!rule || rule.spec.signalType !== 'metrics')) throw new Error('指标告警规则详情尚未成功加载');
      if (!testToken || testedInput !== snapshot || testExpiresAt <= Date.now()) throw new Error('规则变化或测试凭据已过期，请重新测试');
      return mode === 'edit' ? api.updateAlertRule(ruleId, savedSpec, testToken) : api.createAlertRule(savedSpec, testToken);
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['alerts', 'rules', 'metrics'] }); onClose(); },
    onError: (error) => {
      if (error instanceof ApiRequestError && error.code === 'alert_test_required') {
        setTestedInput('');
        setTestExpiresAt(0);
      }
    },
  });
  const disableMutation = useMutation({
    mutationFn: () => {
      if (!rule || rule.spec.signalType !== 'metrics') throw new Error('只能停用指标告警规则');
      return api.disableAlertRule(ruleId, 'metrics');
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['alerts', 'rules', 'metrics'] }); onClose(); },
  });
  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-slate-900/28" onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}>
      <button type="button" className="absolute inset-0 cursor-default border-0 bg-transparent" aria-label="关闭指标告警编辑遮罩" onClick={onClose} />
      <aside className="console-drawer-panel relative flex h-full w-full max-w-[760px] flex-col border-l border-outline bg-white shadow-[0_20px_60px_rgba(24,52,96,0.24)]" role="dialog" aria-modal="true" aria-labelledby="metrics-alert-editor-title">
        <div className="flex shrink-0 items-center justify-between border-b border-outline px-4 py-3">
          <h2 id="metrics-alert-editor-title" className="text-base font-semibold">{mode === 'edit' ? '编辑指标告警' : '创建指标告警'}</h2>
          <button ref={closeButtonRef} type="button" className="console-icon-button" onClick={onClose} aria-label="关闭指标告警编辑"><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-auto bg-surface p-4">
          {ruleQuery.isLoading ? <AlertTableSkeleton /> : ruleQuery.error ? <div className="console-notice console-notice-danger">{errorMessage(ruleQuery.error)}</div> : invalidRule ? <div className="console-notice console-notice-danger">该规则不是指标告警，不能在此页面编辑。</div> : null}
          <EditorSection title="规则与产品">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="规则名称"><input className="console-input mt-1 w-full" value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：节点 CPU 持续高负载" /></Field>
              <Field label="产品"><select className="console-input mt-1 w-full" value={productId} disabled={mode === 'edit'} title={mode === 'edit' ? '指标告警创建后不能变更产品' : undefined} onChange={(event) => setProductId(event.target.value)}><option value="">请选择已连接产品</option>{contexts.map((context) => <option key={context.product.id} value={context.product.id}>{context.product.name}</option>)}</select></Field>
            </div>
            {selectedContext ? <div className="mt-3 rounded border border-outline bg-surface-low px-3 py-2 text-xs text-muted">写入目标由产品指标接入关系确定：<span className="font-mono text-on-surface">{selectedContext.integration.destinationRef}</span></div> : <div className="mt-3 text-xs font-semibold text-warning">当前产品未处于 active 且指标接入 connected 状态。</div>}
          </EditorSection>
          <EditorSection title="查询与触发">
            <div className="mb-3 flex gap-1">{(['promql', 'metricsql'] as const).map((value) => <button key={value} type="button" className={`console-button ${queryMode === value ? 'border-primary text-primary' : ''}`} onClick={() => setQueryMode(value)}>{value === 'promql' ? 'PromQL' : 'MetricsQL'}</button>)}</div>
            <Field label="查询表达式"><textarea className="console-input mt-1 min-h-28 w-full py-2 font-mono" value={expression} onChange={(event) => setExpression(event.target.value)} placeholder='sum(rate(http_requests_total{status=~"5.."}[5m]))' /></Field>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="条件"><select className="console-input mt-1 w-full" value={operator} onChange={(event) => setOperator(event.target.value as 'gt' | 'gte')}><option value="gt">大于</option><option value="gte">大于等于</option></select></Field>
              <Field label="阈值"><input className="console-input mt-1 w-full" type="number" step="any" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} /></Field>
              <Field label="窗口"><select className="console-input mt-1 w-full" value={triggerWindow} onChange={(event) => setTriggerWindow(event.target.value)}><option value="1m">1 分钟</option><option value="5m">5 分钟</option><option value="10m">10 分钟</option><option value="15m">15 分钟</option></select></Field>
              <Field label="评估间隔"><select className="console-input mt-1 w-full" value={evaluationInterval} onChange={(event) => setEvaluationInterval(event.target.value)}><option value="15s">15 秒</option><option value="30s">30 秒</option><option value="1m">1 分钟</option></select></Field>
            </div>
            <Field label="实例分组标签（可选）"><input className="console-input mt-1 w-full" value={groupFields} onChange={(event) => setGroupFields(event.target.value)} placeholder="cluster, namespace" /></Field>
          </EditorSection>
          <EditorSection title="通知">
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="平台级通知策略"><select className="console-input mt-1 w-full" value={policyId} onChange={(event) => setPolicyId(event.target.value)}><option value="">请选择通知策略</option>{policies.map((policy) => <option key={policy.id} value={policy.id}>{policy.name}</option>)}</select></Field>
              <Field label="责任团队"><input className="console-input mt-1 w-full" value={ownerTeam} onChange={(event) => setOwnerTeam(event.target.value)} placeholder="例如：SRE" /></Field>
              <Field label="严重程度"><select className="console-input mt-1 w-full" value={severity} onChange={(event) => setSeverity(event.target.value as AlertSeverity)}><option value="info">提示</option><option value="warning">警告</option><option value="critical">严重</option></select></Field>
            </div>
            {!policiesQuery.isLoading && policies.length === 0 ? <div className="mt-3 text-xs font-semibold text-warning">暂无启用的平台级通知策略，当前不能启用指标告警。</div> : null}
          </EditorSection>
          {testResult ? <EditorSection title="规则测试"><div className="text-xs text-muted">测试仅编译规则，不查询 VictoriaMetrics 实时数据。</div><pre className="mt-2 overflow-auto rounded border border-outline bg-slate-950 p-3 text-[11px] leading-5 text-slate-100">{testResult.compiledQuery || '未返回编译结果'}</pre>{testResult.warnings.length ? <ul className="mt-2 space-y-1 text-xs text-warning">{testResult.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}{!testCurrent ? <div className="mt-2 text-xs font-semibold text-warning">规则内容已变化，请重新测试。</div> : null}</EditorSection> : null}
          {testMutation.error || saveMutation.error || disableMutation.error ? <div className="console-notice console-notice-danger">{errorMessage(testMutation.error || saveMutation.error || disableMutation.error)}</div> : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-outline bg-white px-4 py-3">
          <div className="text-xs text-muted">{missing.length ? `还需：${missing.join('、')}` : testCurrent ? '规则已测试，可以保存。' : '保存前需要测试当前规则。'}</div>
          <div className="flex items-center gap-2">
            {mode === 'edit' && !invalidRule && rule?.state === 'enabled' ? <button type="button" className="console-button text-danger" disabled={disableMutation.isPending} onClick={() => { if (window.confirm(`确认停用指标告警“${rule.spec.name}”？`)) disableMutation.mutate(); }}>停用</button> : null}
            <button type="button" className="console-button" onClick={onClose}>取消</button>
            <button type="button" className="console-button" disabled={!canTest || testMutation.isPending} onClick={() => testMutation.mutate({ testedSpec: spec, snapshot: inputSnapshot })}>{testMutation.isPending ? '测试中' : '测试规则'}</button>
            <button type="button" className="console-button console-button-primary" disabled={!canSave || saveMutation.isPending} onClick={() => saveMutation.mutate({ savedSpec: spec, snapshot: inputSnapshot, testToken: testResult?.testToken ?? '' })}>{saveMutation.isPending ? '保存中' : mode === 'edit' ? '保存并启用' : '创建并启用'}</button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function EditorSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-md border border-outline bg-white p-4"><h3 className="text-sm font-semibold text-on-surface">{title}</h3><div className="mt-3">{children}</div></section>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-xs font-semibold text-on-surface">{label}{children}</label>;
}

function AlertTableSkeleton() {
  return <div className="space-y-2"><div className="console-skeleton h-10" /><div className="console-skeleton h-10" /><div className="console-skeleton h-10" /></div>;
}

function triggerLabel(rule: AlertRule) {
  return `${rule.spec.trigger.window} ${rule.spec.trigger.operator === 'gt' ? '>' : '>='} ${rule.spec.trigger.threshold}`;
}

function formatDateTime(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失败';
}
