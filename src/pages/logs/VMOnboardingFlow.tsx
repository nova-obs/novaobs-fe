import { useState, useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, Copy, Play, RefreshCw, Save, Search, Settings2, Server, XCircle } from 'lucide-react';
import { logSinkLabel, logsApi, type LogParseRule, type LogRouteInput, type LogRoutePreview, type LogRouteView, type LogsServiceSummary, type VMAgentEndpoint } from './api';
import { isCollectingRoute, routeLifecycle, serviceDisplayName, statusPillClass, type StatusTone } from './ServicePickerPanel';
import { LogsParseRuleDialog, type ParserMode } from './LogsParseRuleDialog';
import { LogsErrorLine, LogsTaskPageHeader } from './LogsPrimitives';

type VMStep = 1 | 2 | 3;

const defaultParseSample = '{"level":"INFO","message":"service started"}';
const defaultParserRuleName = 'default-parser';
const defaultParserPattern = '^(?P<level>[A-Z]+)\\s+(?P<message>.*)$';

export function parseVMEndpointDraft(text: string): { items: Array<{ name: string; address: string }>; error: string } {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return { items: [], error: '请至少填写一个 VM 节点地址' };
  const items: Array<{ name: string; address: string }> = [];
  for (const [index, line] of lines.entries()) {
    const parts = line.split(',').map((part) => part.trim());
    if (parts.length > 2 || parts.some((part) => !part)) {
      return { items: [], error: `第 ${index + 1} 行格式错误，请使用"名称,host:port"或仅填写 host:port` };
    }
    const address = parts.length === 2 ? parts[1] : parts[0];
    if (!/^(?:\[[^\]]+\]|[^:\s]+):\d+$/.test(address)) {
      return { items: [], error: `第 ${index + 1} 行地址格式错误，请填写 host:port` };
    }
    items.push({ name: parts.length === 2 ? parts[0] : address, address });
  }
  return { items, error: '' };
}

function vmEndpointStatus(endpoint: VMAgentEndpoint) {
  const value = (endpoint.lastProbeStatus || endpoint.status).toLowerCase();
  if (['reachable', 'healthy', 'success', 'ok'].includes(value)) return { label: '可达', className: 'text-emerald-700' };
  if (['unreachable', 'failed', 'failure', 'error'].includes(value)) return { label: '不可达', className: 'text-danger' };
  return { label: '待校验', className: 'text-muted' };
}

function formatVMTime(value: string) {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('zh-CN', { hour12: false });
}

function buildParserRules(mode: ParserMode, name: string, pattern: string): LogParseRule[] {
  if (mode === 'none') return [];
  return [{ name: name || `${mode}-parser`, ruleType: mode, pattern: mode === 'regex' ? pattern : undefined, enabled: true }];
}

export function VMOnboardingFlow() {
  const queryClient = useQueryClient();
  const { productId = '', serviceId: pathServiceId = '' } = useParams();

  const [currentStep, setCurrentStep] = useState<VMStep>(1);
  const [serviceId, setServiceId] = useState('');
  const [serviceQuery, setServiceQuery] = useState('');
  const [logPath, setLogPath] = useState('');
  const [endpointId, setEndpointId] = useState('');
  const [parserMode, setParserMode] = useState<ParserMode>('none');
  const [parserRuleName, setParserRuleName] = useState(defaultParserRuleName);
  const [parserPattern, setParserPattern] = useState(defaultParserPattern);
  const [parserDraftMode, setParserDraftMode] = useState<ParserMode>('none');
  const [parserDraftRuleName, setParserDraftRuleName] = useState(defaultParserRuleName);
  const [parserDraftPattern, setParserDraftPattern] = useState(defaultParserPattern);
  const [parseDialogOpen, setParseDialogOpen] = useState(false);
  const [parseSample, setParseSample] = useState(defaultParseSample);
  const [preview, setPreview] = useState<LogRoutePreview | null>(null);
  const [createdRoute, setCreatedRoute] = useState<LogRouteView | null>(null);
  const [vmEndpointDraft, setVMEndpointDraft] = useState('');
  const [vmEndpointDraftError, setVMEndpointDraftError] = useState('');

  const { data: workspace, isLoading, error, refetch } = useQuery({
    queryKey: ['logs-onboarding-workspace', productId, pathServiceId],
    queryFn: () => logsApi.getWorkspace(productId, pathServiceId),
    enabled: Boolean(productId && pathServiceId),
  });

  const services = workspace?.services ?? [];
  const endpoints = workspace?.endpoints ?? [];
  const routes = workspace?.routes ?? [];

  const vmServices = useMemo(() => services.filter((s) => s.identityType === 'host_process'), [services]);
  const vmEndpoints = useMemo(() => endpoints.filter((e) => e.scopeType !== 'k8s_cluster'), [endpoints]);

  const filteredServices = useMemo(() => {
    const q = serviceQuery.trim().toLowerCase();
    if (!q) return vmServices;
    return vmServices.filter((s) => `${s.name} ${s.displayName} ${s.ownerTeam}`.toLowerCase().includes(q));
  }, [vmServices, serviceQuery]);

  const serviceRoutesByService = useMemo(() => {
    const grouped = new Map<string, LogRouteView[]>();
    for (const route of routes) {
      if (route.route.sourceType !== 'vm_file') continue;
      const items = grouped.get(route.route.serviceId) ?? [];
      grouped.set(route.route.serviceId, [...items, route]);
    }
    return grouped;
  }, [routes]);

  const service = vmServices.find((s) => s.id === serviceId) ?? null;
  const vmRouteId = createdRoute?.route.id || '';
  const parseRules = useMemo(() => buildParserRules(parserMode, parserRuleName, parserPattern), [parserMode, parserRuleName, parserPattern]);
  const parseValid = parserMode !== 'regex' || parserPattern.includes('?P<');
  const canProceedStep1 = Boolean(serviceId && logPath && endpointId);
  const canPreview = canProceedStep1 && parseValid;
  const parseDraftValid = parserDraftMode !== 'regex' || parserDraftPattern.includes('?P<');
  const selectedServiceLabel = service?.displayName || service?.name || '-';

  const vmInstallationQuery = useQuery({
    queryKey: ['logs-vm-installation', vmRouteId],
    queryFn: () => logsApi.getVMInstallation(vmRouteId),
    enabled: Boolean(vmRouteId),
    retry: false,
  });

  const vmAgentEndpointsQuery = useQuery({
    queryKey: ['logs-vm-agent-endpoints', vmRouteId],
    queryFn: () => logsApi.listVMAgentEndpoints(vmRouteId),
    enabled: Boolean(vmRouteId),
    retry: false,
  });

  function buildRouteInput(): LogRouteInput {
    return {
      name: service?.displayName || service?.name,
      routeId: createdRoute?.route.id || undefined,
      serviceId,
      sourceType: 'vm_file',
      agentGroupId: '',
      endpointId,
      k8s: {},
      vm: { pathPattern: logPath, parseRules },
    };
  }

  const previewMutation = useMutation({
    mutationFn: () => logsApi.previewRoute(buildRouteInput()),
    onSuccess: (result) => {
      setPreview(result);
      createRouteMutation.mutate();
    },
  });

  const createRouteMutation = useMutation({
    mutationFn: () => {
      const input = buildRouteInput();
      if (createdRoute?.route.id) {
        return logsApi.updateRoute(createdRoute.route.id, input);
      }
      return logsApi.createRoute(input);
    },
    onSuccess: async (created) => {
      setCreatedRoute(created);
      setCurrentStep(3);
      await queryClient.invalidateQueries({ queryKey: ['logs-onboarding-workspace'] });
    },
  });

  const draftParseRules = useMemo(() => buildParserRules(parserDraftMode, parserDraftRuleName, parserDraftPattern), [parserDraftMode, parserDraftRuleName, parserDraftPattern]);

  const parsePreviewMutation = useMutation({
    mutationFn: async () => {
      if (parserDraftMode === 'regex' && !parserDraftPattern.includes('?P<')) {
        return { status: 'error' as const, fields: {} as Record<string, unknown>, warnings: [] as string[], errors: ['Regex 需要使用命名捕获组，例如 (?P<level>INFO)。'] };
      }
      return logsApi.previewParseRules(parseSample, draftParseRules);
    },
  });

  const createVMEndpointsMutation = useMutation({
    mutationFn: async (items: Array<{ name: string; address: string }>) => {
      if (!vmRouteId) throw new Error('请先保存 VM 路由');
      const settled = await Promise.allSettled(items.map((item) => logsApi.createVMAgentEndpoint(vmRouteId, item)));
      return {
        succeeded: settled.filter((r) => r.status === 'fulfilled').length,
        failed: settled.flatMap((r, i) => r.status === 'rejected' ? [{ item: items[i], reason: r.reason }] : []),
      };
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['logs-vm-agent-endpoints', vmRouteId] });
      if (result.failed.length === 0) {
        setVMEndpointDraft('');
        setVMEndpointDraftError('');
        return;
      }
      setVMEndpointDraft(result.failed.map(({ item }) => item.name === item.address ? item.address : `${item.name},${item.address}`).join('\n'));
      const msg = result.failed[0]?.reason instanceof Error ? result.failed[0].reason.message : '节点登记失败';
      setVMEndpointDraftError(`已登记 ${result.succeeded} 个节点，${result.failed.length} 个失败：${msg}`);
    },
  });

  const probeVMEndpointMutation = useMutation({
    mutationFn: (epId: string) => {
      if (!vmRouteId) throw new Error('请先保存 VM 路由');
      return logsApi.probeVMAgentEndpoint(vmRouteId, epId);
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['logs-vm-agent-endpoints', vmRouteId] }),
  });

  const deleteVMEndpointMutation = useMutation({
    mutationFn: (epId: string) => {
      if (!vmRouteId) throw new Error('请先保存 VM 路由');
      return logsApi.deleteVMAgentEndpoint(vmRouteId, epId);
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['logs-vm-agent-endpoints', vmRouteId] }),
  });

  useEffect(() => {
    if (parseDialogOpen) {
      parsePreviewMutation.reset();
    }
  }, [parseDialogOpen, parseSample, parserDraftMode, parserDraftRuleName, parserDraftPattern]);

  function openParseDialog() {
    setParserDraftMode(parserMode);
    setParserDraftRuleName(parserRuleName);
    setParserDraftPattern(parserPattern);
    setParseDialogOpen(true);
  }

  function applyParseDraft() {
    if (!parseDraftValid) return;
    setParserMode(parserDraftMode);
    setParserRuleName(parserDraftRuleName);
    setParserPattern(parserDraftPattern);
    setParseDialogOpen(false);
  }

  function submitVMEndpointDraft() {
    const parsed = parseVMEndpointDraft(vmEndpointDraft);
    if (parsed.error) {
      setVMEndpointDraftError(parsed.error);
      return;
    }
    setVMEndpointDraftError('');
    createVMEndpointsMutation.mutate(parsed.items);
  }

  function probeAll() {
    const eps = vmAgentEndpointsQuery.data ?? [];
    for (const ep of eps) {
      probeVMEndpointMutation.mutate(ep.id);
    }
  }

  if (error) {
    return (
      <div className="logs-task-page space-y-3">
        <LogsTaskPageHeader title="VM 日志接入" />
        <LogsErrorLine message={(error as Error).message} />
        <button className="console-button console-button-primary" onClick={() => refetch()}>重试</button>
      </div>
    );
  }

  const stepItems: Array<{ step: VMStep; label: string; done: boolean }> = [
    { step: 1, label: '基础信息', done: canProceedStep1 },
    { step: 2, label: '解析配置', done: Boolean(preview) },
    { step: 3, label: '安装部署', done: Boolean(vmRouteId && (vmAgentEndpointsQuery.data?.length ?? 0) > 0) },
  ];

  return (
    <div className="logs-task-page flex h-full min-h-[720px] min-w-0 flex-col overflow-hidden">
      <LogsTaskPageHeader
        title="VM 日志接入"
        description="三步完成 VM 日志采集配置"
        action={
          <Link className="console-button h-8" to={`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(pathServiceId)}/logs/agents`}>退出</Link>
        }
      />
      <div className="mt-3 grid min-h-0 min-w-0 flex-1 gap-3 overflow-hidden xl:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="min-w-0 rounded-lg border border-outline bg-surface-lowest p-3 xl:sticky xl:top-0 xl:h-fit">
          <div className="space-y-2">
            {stepItems.map((item) => {
              const active = currentStep === item.step;
              return (
                <button key={item.step} className={`w-full rounded-md border px-3 py-2.5 text-left transition-colors ${active ? 'border-primary bg-primary-soft text-on-surface shadow-[inset_3px_0_0_rgba(13,91,215,0.78)]' : item.done ? 'border-outline bg-white text-on-surface hover:border-primary/30 hover:bg-primary-soft/45' : 'border-outline bg-white text-muted hover:bg-surface-low/65'}`} onClick={() => setCurrentStep(item.step)}>
                  <div className="flex items-center gap-2.5">
                    <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${item.done ? 'border-primary bg-primary text-white' : active ? 'border-primary bg-white text-primary' : 'border-outline bg-white text-muted'}`}>
                      {item.done ? <CheckCircle className="h-3.5 w-3.5" /> : item.step}
                    </span>
                    <span className="text-sm font-semibold">{item.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-col gap-3 overflow-auto">
          {currentStep === 1 && (
            <>
              <section className="overflow-hidden rounded-lg border border-outline bg-surface-lowest">
                <div className="border-b border-outline bg-white px-3 py-3"><h3 className="text-sm font-semibold text-on-surface">选择服务</h3></div>
                <div className="logs-service-picker-panel relative flex min-h-[320px] flex-col overflow-hidden bg-surface-lowest">
                  <div className="flex border-b border-outline bg-surface-lowest px-3 py-3">
                    <div className="relative min-w-0 flex-1">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                      <input className="console-input h-9 w-full pl-8 text-sm" value={serviceQuery} onChange={(e) => setServiceQuery(e.target.value)} placeholder="搜索服务" />
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 overflow-auto">
                    {filteredServices.length === 0 ? (
                      <div className="flex items-center gap-2 py-6 px-3 text-sm text-muted"><Server className="h-4 w-4" />暂无匹配服务</div>
                    ) : (
                      <table className="console-table min-w-[680px] w-full">
                        <thead><tr><th>服务</th><th>命名空间</th><th>状态</th><th>工作负载</th><th>操作</th></tr></thead>
                        <tbody>{filteredServices.map((s) => {
                          const sRoutes = serviceRoutesByService.get(s.id) ?? [];
                          const lifecycle = sRoutes.length > 0 ? routeLifecycle(sRoutes[0]) : null;
                          const selected = s.id === serviceId;
                          return (
                            <tr key={s.id} role="button" tabIndex={0} className={`cursor-pointer ${selected ? 'console-selected-row' : ''}`} onClick={() => setServiceId(s.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setServiceId(s.id); } }}>
                              <td><div className="truncate font-semibold text-on-surface">{serviceDisplayName(s)}</div></td>
                              <td className="font-mono text-xs text-muted">{s.namespace || '-'}</td>
                              <td>{lifecycle ? <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${statusPillClass(lifecycle.tone)}`}>{lifecycle.label}</span> : <span className="text-xs text-muted">未接入</span>}</td>
                              <td className="font-mono text-xs text-muted">{s.serviceType || 'host process'}</td>
                              <td><span className={`text-xs font-semibold ${selected ? 'text-primary' : 'text-muted'}`}>{selected ? '已选择' : '选择'}</span></td>
                            </tr>
                          );
                        })}</tbody>
                      </table>
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-outline bg-surface-lowest">
                <div className="border-b border-outline bg-white px-3 py-3"><h3 className="text-sm font-semibold text-on-surface">日志路径</h3></div>
                <div className="p-3"><input className="console-input w-full font-mono" value={logPath} onChange={(e) => setLogPath(e.target.value)} placeholder="/data/logs/*.log" /></div>
              </section>

              <section className="rounded-lg border border-outline bg-surface-lowest">
                <div className="border-b border-outline bg-white px-3 py-3"><h3 className="text-sm font-semibold text-on-surface">日志下游端点</h3></div>
                <div className="grid gap-2 p-3 sm:grid-cols-2">
                  {vmEndpoints.length === 0 ? (
                    <div className="flex items-center gap-2 py-4 text-sm text-muted"><Server className="h-4 w-4" />暂无可用端点</div>
                  ) : vmEndpoints.map((ep) => (
                    <button key={ep.id} className={`w-full rounded-lg border px-3 py-3 text-left transition-all ${ep.id === endpointId ? 'border-primary bg-primary-soft text-on-surface shadow-[inset_3px_0_0_rgba(13,91,215,0.78)]' : 'border-outline bg-white text-on-surface hover:border-primary/30'}`} onClick={() => setEndpointId(ep.id)}>
                      <div className="text-sm font-semibold">{ep.name}</div>
                      <div className="mt-1 truncate font-mono text-[11px] text-muted">{logSinkLabel(ep.sinkType)} · {ep.writeURL || '-'}</div>
                    </button>
                  ))}
                </div>
              </section>

              <div className="flex justify-end py-2">
                <button className="console-button console-button-primary h-9" disabled={!canProceedStep1} onClick={() => setCurrentStep(2)}>
                  下一步：解析配置
                </button>
              </div>
            </>
          )}

          {currentStep === 2 && (
            <>
              <section className="rounded-lg border border-outline bg-surface-lowest">
                <div className="border-b border-outline bg-white px-3 py-3"><h3 className="text-sm font-semibold text-on-surface">日志解析规则</h3></div>
                <div className="p-4">
                  <dl className="grid gap-3 rounded border border-outline bg-white p-3 text-xs sm:grid-cols-2">
                    <div><dt className="font-semibold text-muted">日志路径</dt><dd className="mt-1 break-all font-mono text-on-surface">{logPath || '-'}</dd></div>
                    <div><dt className="font-semibold text-muted">解析方式</dt><dd className="mt-1 text-on-surface">{parserMode === 'none' ? '不解析' : parserMode === 'json' ? 'JSON' : 'Regex'}</dd></div>
                  </dl>
                  <button className="mt-4 inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-primary bg-white px-3 text-xs font-semibold text-primary transition-all active:translate-y-px" onClick={openParseDialog}><Settings2 className="h-3.5 w-3.5" />配置解析规则</button>
                </div>
              </section>
              {previewMutation.error ? <LogsErrorLine message={(previewMutation.error as Error).message} /> : null}
              {createRouteMutation.error ? <LogsErrorLine message={(createRouteMutation.error as Error).message} /> : null}
              <div className="flex items-center justify-between py-2">
                <button className="console-button h-9" onClick={() => setCurrentStep(1)}>上一步</button>
                <button className="console-button console-button-primary h-9" disabled={!canPreview || previewMutation.isPending || createRouteMutation.isPending} onClick={() => previewMutation.mutate()}>
                  {(previewMutation.isPending || createRouteMutation.isPending) ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  生成预览并保存
                </button>
              </div>
            </>
          )}

          {currentStep === 3 && (
            <>
              <section className="rounded-lg border border-outline bg-surface-lowest">
                <div className="border-b border-outline bg-white px-3 py-3"><h3 className="text-sm font-semibold text-on-surface">安装脚本</h3></div>
                {vmInstallationQuery.isLoading ? <div className="h-32 animate-pulse bg-surface" /> : vmInstallationQuery.error ? (
                  <LogsErrorLine message={(vmInstallationQuery.error as Error).message || '安装材料加载失败'} />
                ) : vmInstallationQuery.data ? (
                  <div className="space-y-3 p-3">
                    {[{ title: '安装脚本', content: vmInstallationQuery.data.installScript }, { title: 'Collector 配置', content: vmInstallationQuery.data.collectorYAML }].map((block) => (
                      <div key={block.title} className="overflow-hidden rounded border border-outline bg-white">
                        <div className="flex items-center justify-between gap-3 border-b border-outline bg-surface px-3 py-2">
                          <div className="text-xs font-semibold">{block.title}</div>
                          <button className="console-icon-button" onClick={() => navigator.clipboard?.writeText(block.content)} title={`复制${block.title}`}><Copy className="h-4 w-4" /></button>
                        </div>
                        <pre className="max-h-64 min-h-32 overflow-auto p-3 font-mono text-[11px] leading-5 whitespace-pre-wrap">{block.content || '暂无内容'}</pre>
                      </div>
                    ))}
                  </div>
                ) : <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted"><Server className="h-4 w-4" />请先保存路由以获取安装材料</div>}
              </section>

              <section className="rounded-lg border border-outline bg-surface-lowest">
                <div className="border-b border-outline bg-white px-3 py-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-on-surface">VM 节点</h3>
                    <button className="console-button console-button-sm" disabled={!vmRouteId || !(vmAgentEndpointsQuery.data?.length)} onClick={probeAll}>全部校验</button>
                  </div>
                </div>
                <div className="p-3 space-y-3">
                  <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                    <label className="text-xs font-semibold text-muted">批量录入<textarea className="console-input mt-1.5 min-h-20 w-full resize-y font-mono text-xs" value={vmEndpointDraft} onChange={(e) => { setVMEndpointDraft(e.target.value); setVMEndpointDraftError(''); }} placeholder={'192.168.1.10:13133\nnode-02,10.0.0.9:13133'} /></label>
                    <button className="console-button console-button-primary h-9" disabled={createVMEndpointsMutation.isPending || !vmEndpointDraft.trim() || !vmRouteId} onClick={submitVMEndpointDraft}>
                      {createVMEndpointsMutation.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}登记节点
                    </button>
                  </div>
                  {vmEndpointDraftError ? <div className="text-xs font-semibold text-danger">{vmEndpointDraftError}</div> : null}
                  {[createVMEndpointsMutation.error, probeVMEndpointMutation.error, deleteVMEndpointMutation.error].filter(Boolean).map((err, i) => <LogsErrorLine key={i} message={(err as Error).message} />)}
                  <div className="overflow-hidden rounded border border-outline bg-white">
                    {vmAgentEndpointsQuery.isLoading ? <div className="h-24 animate-pulse bg-surface" /> : vmAgentEndpointsQuery.error ? (
                      <div className="p-3"><LogsErrorLine message={(vmAgentEndpointsQuery.error as Error).message || 'VM 节点加载失败'} /></div>
                    ) : !(vmAgentEndpointsQuery.data?.length) ? (
                      <div className="flex items-center gap-2 py-6 px-3 text-sm text-muted"><Server className="h-4 w-4" />尚未登记 VM 节点</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="console-table min-w-[760px] w-full">
                          <thead><tr><th>节点</th><th>地址</th><th>连通状态</th><th>最近校验</th><th className="w-24">操作</th></tr></thead>
                          <tbody>{(vmAgentEndpointsQuery.data ?? []).map((ep) => {
                            const st = vmEndpointStatus(ep);
                            return (
                              <tr key={ep.id}>
                                <td className="font-semibold">{ep.name || '-'}</td>
                                <td className="font-mono text-xs">{ep.address}</td>
                                <td><span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${st.className}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{st.label}</span></td>
                                <td className="font-mono text-[11px] text-muted">{formatVMTime(ep.lastProbeAt)}</td>
                                <td><div className="flex items-center gap-1">
                                  <button className="console-button h-7 px-2 text-xs" disabled={probeVMEndpointMutation.isPending} onClick={() => probeVMEndpointMutation.mutate(ep.id)}>校验</button>
                                  <button className="console-button h-7 px-2 text-xs text-danger" disabled={deleteVMEndpointMutation.isPending} onClick={() => { if (window.confirm(`确认删除 VM 节点"${ep.name || ep.address}"？`)) deleteVMEndpointMutation.mutate(ep.id); }}>删除</button>
                                </div></td>
                              </tr>
                            );
                          })}</tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <div className="flex items-center justify-between py-2">
                <button className="console-button h-9" onClick={() => setCurrentStep(2)}>上一步</button>
                <Link className="console-button console-button-primary h-9" to={`/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(pathServiceId)}/logs/agents`}>
                  完成
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      <LogsParseRuleDialog
        open={parseDialogOpen}
        serviceLabel={selectedServiceLabel}
        scopeLabel={logPath || 'VM'}
        parseSample={parseSample}
        parserDraftMode={parserDraftMode}
        parserDraftRuleName={parserDraftRuleName}
        parserDraftPattern={parserDraftPattern}
        parseDraftValid={parseDraftValid}
        parsePreviewMutation={parsePreviewMutation}
        onParseSampleChange={setParseSample}
        onParserDraftModeChange={setParserDraftMode}
        onParserDraftRuleNameChange={setParserDraftRuleName}
        onParserDraftPatternChange={setParserDraftPattern}
        onClose={() => setParseDialogOpen(false)}
        onApply={applyParseDraft}
      />
    </div>
  );
}
