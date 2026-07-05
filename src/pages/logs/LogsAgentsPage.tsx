import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, Copy, FileText, PanelRightOpen, Plus, RefreshCw, Server, ShieldCheck, WifiOff, XCircle } from 'lucide-react';
import { api } from '../../services/api';
import { logSinkLabel, logSourceLabel, logsApi, type LogRouteView, type LogsServiceSummary } from './api';
import { routeLifecycle, serviceDisplayName, statusPillClass } from './ServicePickerPanel';
import { LogsEmptyState, LogsInfoCell, LogsToolbarButton } from './LogsPrimitives';

export function LogsAgentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedRouteId, setSelectedRouteId] = useState(searchParams.get('route_id') ?? '');
  const [collectorConfigRoute, setCollectorConfigRoute] = useState<LogRouteView | null>(null);
  const [contextRoute, setContextRoute] = useState<LogRouteView | null>(null);
  const [routeView, setRouteView] = useState<'overview' | 'instances'>('overview');
  const { data: workspace, error: workspaceError, refetch: refetchWorkspace } = useQuery({
    queryKey: ['logs-onboarding-workspace'],
    queryFn: logsApi.getWorkspace,
  });

  const services = workspace?.services ?? [];
  const groups = workspace?.collectorGroups ?? [];
  const routes = workspace?.routes ?? [];
  const filteredRoutes = routes;
  const activeRoute = filteredRoutes.find((route) => route.route.id === selectedRouteId) ?? filteredRoutes[0] ?? null;
  const activeGroupId = activeRoute?.route.agentGroupId ?? '';
  const activeGroup = groups.find((group) => group.id === activeGroupId) ?? null;
  const activeService = activeRoute ? services.find((service) => service.id === activeRoute.route.serviceId) ?? null : null;

  useEffect(() => {
    const paramRouteId = searchParams.get('route_id') ?? '';
    if (filteredRoutes.length === 0) {
      if (selectedRouteId) setSelectedRouteId('');
      return;
    }
    const paramRoute = filteredRoutes.find((route) => route.route.id === paramRouteId);
    if (paramRoute) {
      if (selectedRouteId !== paramRoute.route.id) setSelectedRouteId(paramRoute.route.id);
      return;
    }
    const fallbackRouteId = filteredRoutes.some((route) => route.route.id === selectedRouteId) ? selectedRouteId : filteredRoutes[0].route.id;
    if (selectedRouteId !== fallbackRouteId) setSelectedRouteId(fallbackRouteId);
    const next = new URLSearchParams(searchParams);
    next.set('route_id', fallbackRouteId);
    setSearchParams(next, { replace: true });
  }, [filteredRoutes, searchParams, selectedRouteId, setSearchParams]);

  const { data: instances = [], isLoading: instancesLoading, error: instancesError, refetch: refetchInstances } = useQuery({
    queryKey: ['logs-agent-instances', activeGroupId],
    queryFn: () => api.getCollectorInstances(activeGroupId),
    enabled: Boolean(activeGroupId),
    refetchInterval: 10000,
  });
  const onlineCount = instances.filter((item) => item.healthy).length;

  const collectorConfigMutation = useMutation({
    mutationFn: (routeId: string) => logsApi.getRouteCollectorConfig(routeId),
  });

  function openCollectorConfig(route: LogRouteView) {
    setCollectorConfigRoute(route);
    collectorConfigMutation.mutate(route.route.id);
  }

  function closeCollectorConfig() {
    setCollectorConfigRoute(null);
    collectorConfigMutation.reset();
  }

  function selectRoute(routeId: string) {
    setSelectedRouteId(routeId);
    setRouteView('overview');
    const next = new URLSearchParams(searchParams);
    next.set('route_id', routeId);
    setSearchParams(next, { replace: true });
  }

  const activeLifecycle = activeRoute ? routeLifecycle(activeRoute) : null;
  const activeServiceName = activeService ? serviceDisplayName(activeService) : activeRoute?.route.serviceId ?? '-';
  const contextService = contextRoute ? services.find((service) => service.id === contextRoute.route.serviceId) ?? null : null;
  const contextGroup = contextRoute ? groups.find((group) => group.id === contextRoute.route.agentGroupId) ?? null : null;
  const contextServiceName = contextService ? serviceDisplayName(contextService) : contextRoute?.route.serviceId ?? '-';
  const contextAgentScope = collectorDomainScope(contextGroup, instances[0]);

  return (
    <div className="console-workbench logs-routes-workbench flex min-h-[720px] flex-col xl:h-full xl:min-h-0 xl:overflow-hidden">
      <section className="console-panel flex min-h-0 flex-1 flex-col overflow-hidden" aria-label="采集路由工作区">
        {workspaceError ? <ErrorLine message={(workspaceError as Error).message} /> : null}
        <div className="console-panel-header shrink-0">
          <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="logs-route-selector w-full lg:max-w-[420px]">
              <RouteSelector routes={filteredRoutes} services={services} activeRoute={activeRoute} onSelect={selectRoute} />
            </div>
            <div className="flex w-full flex-wrap items-center justify-end gap-2 md:w-auto">
              <LogsToolbarButton onClick={() => {
                void refetchWorkspace();
                if (activeGroupId) void refetchInstances();
              }}><RefreshCw className="h-3.5 w-3.5" />刷新</LogsToolbarButton>
              <Link className="console-button console-button-primary" to="/logs/agents/new"><Plus className="h-3.5 w-3.5" />创建采集路由</Link>
            </div>
          </div>
        </div>

        <div className="logs-routes-content flex min-h-0 flex-1 flex-col">
          <main className="flex min-h-0 min-w-0 flex-col">
            {routes.length === 0 ? (
              <LogsEmptyState
                title="暂无采集路由"
                description="创建路由后可在此查看发布状态、Agent 心跳和完整采集配置。"
                action={<Link className="console-button console-button-primary" to="/logs/agents/new">创建采集路由</Link>}
              />
            ) : !activeRoute ? (
              <LogsEmptyState title="未选择采集路由" />
            ) : (
              <>
                <div className="grid gap-3 border-b border-outline px-4 py-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-base font-semibold text-on-surface">{activeRoute.route.name || activeServiceName}</h2>
                      <span className={`inline-flex w-fit shrink-0 rounded border px-2 py-0.5 text-[11px] font-semibold ${statusPillClass(activeLifecycle?.tone || 'muted')}`}>{activeLifecycle?.label || '-'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-5">
                    <button type="button" className={`h-8 border-b-2 text-xs font-semibold ${routeView === 'overview' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-on-surface'}`} onClick={() => setRouteView('overview')}>运行概览</button>
                    <button type="button" className={`h-8 border-b-2 text-xs font-semibold ${routeView === 'instances' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-on-surface'}`} onClick={() => setRouteView('instances')}>Agent 实例</button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="console-icon-button"
                      aria-label="查看路由详情"
                      title="查看路由详情"
                      onClick={() => setContextRoute(activeRoute)}
                    >
                      <PanelRightOpen className="h-4 w-4" />
                    </button>
                    <button type="button" className="console-button" onClick={() => openCollectorConfig(activeRoute)}><FileText className="h-3.5 w-3.5" />查看配置</button>
                    <Link className="console-button console-button-primary" to={`/logs/agents/${activeRoute.route.id}/edit`}>更新路由</Link>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto">
                  {routeView === 'overview' ? (
                    <div className="p-4">
                      <dl className="grid border-y border-outline md:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-outline">
                        <RuntimeFact label="发布状态" value={activeLifecycle?.label || '-'} tone={activeLifecycle?.tone === 'success' ? 'primary' : undefined} />
                        <RuntimeFact label="Agent 健康" value={`${onlineCount} / ${instances.length}`} tone={instances.length > 0 && onlineCount === instances.length ? 'primary' : undefined} />
                        <RuntimeFact label="采集配置 hash" value={activeRoute.route.collectorConfigHash || activeRoute.source?.collectorConfigHash || '-'} tone="primary" />
                        <RuntimeFact label="最近发布时间" value={activeRoute.route.lastPublishedAt || '-'} />
                      </dl>
                      <button type="button" className="mt-4 text-xs font-semibold text-primary hover:underline" onClick={() => setRouteView('instances')}>查看 Agent 实例 →</button>
                    </div>
                  ) : !activeGroupId ? (
                    <LogsEmptyState title="路由尚未绑定采集域" description="完成预览并发布后，这里将展示 Agent 实例和运行状态。" />
                  ) : (
                    <div className="min-h-0">
                      {instancesError ? <ErrorLine message={(instancesError as Error).message} /> : null}
                      {instancesLoading ? <LogsEmptyState title="正在加载 Agent 实例" /> : instances.length === 0 ? <LogsEmptyState title="暂无 Agent 心跳数据" /> : (
                        <div className="overflow-auto">
                          <table className="console-table min-w-[960px] w-full">
                            <thead>
                              <tr>
                                <th>运行身份</th>
                                <th>运行态</th>
                                <th>K8s 范围</th>
                                <th>Pod / Node</th>
                                <th>Remote Config</th>
                                <th>Hash</th>
                                <th>最后心跳</th>
                              </tr>
                            </thead>
                            <tbody>
                              {instances.map((item) => (
                                <tr key={item.runtimeIdentity || item.instanceUid}>
                                  <td>
                                    <Link className="font-mono text-xs font-semibold text-primary hover:underline" to={`/agents/${item.instanceUid}`}>{item.runtimeIdentity || item.podName || item.hostname || item.instanceUid}</Link>
                                    <div className="mt-1 break-all font-mono text-[11px] text-muted">opamp_instance_uid {item.opampInstanceUid || item.instanceUid || '-'}</div>
                                  </td>
                                  <td>
                                    <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-semibold ${item.healthy ? 'border-primary/20 bg-primary-soft text-primary' : 'border-amber-500/30 bg-amber-50 text-amber-700'}`}>
                                      {item.healthy ? <ShieldCheck className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                                      {item.runtimeStatus || '-'}
                                    </span>
                                  </td>
                                  <td className="font-mono text-xs">
                                    <div>{item.clusterId || activeGroup?.cluster || '-'}</div>
                                    <div className="mt-1 text-[11px] text-muted">{item.namespace || activeGroup?.namespace || '-'}</div>
                                    <div className="mt-1 text-[11px] text-muted">agent ns {item.agentNamespace || activeGroup?.namespace || '-'}</div>
                                  </td>
                                  <td className="font-mono text-xs">
                                    <div>{item.podName || '-'}</div>
                                    <div className="mt-1 text-[11px] text-muted">pod_uid {shortIdentity(item.podUid)}</div>
                                    <div className="mt-1 text-[11px] text-muted">{item.nodeName || item.hostname || '-'} · {item.podIp || item.ip || '-'}</div>
                                  </td>
                                  <td>{item.remoteConfigStatus}</td>
                                  <td className="font-mono text-xs">{item.effectiveConfigHash || item.lastConfigHash || '-'}</td>
                                  <td className="font-mono text-xs">{item.lastSeenAt || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </main>
        </div>
      </section>

      {contextRoute && typeof document !== 'undefined' ? createPortal((
        <div className="console-drawer-backdrop fixed inset-0 z-[90]" role="presentation">
          <button type="button" className="absolute inset-0 cursor-default border-0 bg-transparent" aria-label="关闭路由详情" onClick={() => setContextRoute(null)} />
          <aside className="console-drawer-panel route-context-drawer absolute inset-y-0 right-0 flex w-full max-w-[420px] flex-col border-l border-outline bg-white shadow-[0_20px_60px_rgba(24,52,96,0.24)]" role="dialog" aria-modal="true" aria-labelledby="route-context-title">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-outline bg-surface-lowest px-4 py-3">
              <div className="min-w-0">
                <div id="route-context-title" className="text-base font-semibold text-on-surface">路由详情</div>
                <div className="mt-1 truncate font-mono text-[11px] text-muted">{shortHash(contextRoute.route.collectorConfigHash)} · {logSourceLabel(contextRoute.route.sourceType)}</div>
              </div>
              <button type="button" className="console-icon-button border-outline bg-white" aria-label="关闭路由详情" title="关闭" onClick={() => setContextRoute(null)}>
                <XCircle className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <LogsInfoCell label="服务" value={contextServiceName} tone="primary" />
              <LogsInfoCell label="范围" value={routeScope(contextRoute)} />
              <LogsInfoCell label="来源" value={logSourceLabel(contextRoute.route.sourceType)} />
              <LogsInfoCell label="下游" value={contextRoute.endpoint ? `${contextRoute.endpoint.name} · ${logSinkLabel(contextRoute.endpoint.sinkType)}` : '-'} />
              <LogsInfoCell label="采集域" value={contextGroup?.displayName || contextGroup?.name || '-'} />
              <LogsInfoCell label="采集域模式" value={contextGroup?.mode || '-'} />
              <LogsInfoCell label="采集域范围" value={contextGroup ? contextAgentScope : '-'} />
              <LogsInfoCell label="Agent Namespace" value={instances[0]?.agentNamespace || contextGroup?.namespace || '-'} />
              <LogsInfoCell label="部署清单 hash" value={contextRoute.source?.deploymentManifestHash || '-'} />
              <LogsInfoCell label="Audit" value={contextRoute.route.lastAuditId || '-'} />
              <LogsInfoCell label="Preview" value={contextRoute.route.lastPreviewId || '-'} />
            </div>
            <div className="shrink-0 border-t border-outline bg-surface-lowest p-3">
              <div className="grid gap-2">
                <button
                  type="button"
                  className="console-button bg-white"
                  onClick={() => {
                    openCollectorConfig(contextRoute);
                    setContextRoute(null);
                  }}
                >
                  <FileText className="h-3.5 w-3.5" />
                  查看采集配置
                </button>
                <Link className="console-button console-button-primary" to={`/logs/agents/${contextRoute.route.id}/edit`}>
                  更新采集路由
                </Link>
              </div>
            </div>
          </aside>
        </div>),
        document.body,
      ) : null}

      {collectorConfigRoute && typeof document !== 'undefined' ? createPortal((
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-slate-900/28 px-4 py-6 backdrop-blur-sm">
          <div className="route-collector-config-viewer grid h-[86vh] max-h-[86vh] w-full max-w-[1120px] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-outline bg-white shadow-[0_24px_80px_rgba(24,52,96,0.28)]">
            <div className="relative z-10 flex shrink-0 items-center justify-between gap-3 border-b border-outline bg-surface-lowest px-4 py-3">
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <div className="text-base font-semibold text-on-surface">完整 collector.yaml</div>
                  <span className="rounded border border-outline bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-muted">非 K8s 部署清单</span>
                  <span className="rounded border border-primary/20 bg-primary-soft px-2 py-0.5 font-mono text-[11px] font-semibold text-primary">{shortHash(collectorConfigMutation.data?.collectorConfigHash || collectorConfigRoute.route.collectorConfigHash)}</span>
                </div>
                <div className="mt-1 break-all font-mono text-[11px] text-muted">
                  {routeScope(collectorConfigRoute)} · {logSourceLabel(collectorConfigRoute.route.sourceType)}
                </div>
                {collectorConfigMutation.data?.deploymentManifestHash ? (
                  <div className="mt-1 break-all font-mono text-[11px] text-muted">
                    部署清单 hash {shortHash(collectorConfigMutation.data.deploymentManifestHash)}
                  </div>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  className="rounded border border-outline bg-white p-1.5 text-muted hover:bg-surface-low hover:text-primary disabled:opacity-50"
                  disabled={!collectorConfigMutation.data?.collectorYAML}
                  onClick={() => navigator.clipboard?.writeText(collectorConfigMutation.data?.collectorYAML ?? '')}
                  title="复制 YAML"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button className="inline-flex h-8 items-center gap-1.5 rounded border border-outline bg-white px-2.5 text-xs font-semibold text-muted hover:bg-surface-low hover:text-on-surface" onClick={closeCollectorConfig} title="关闭" aria-label="关闭采集配置">
                  <XCircle className="h-4 w-4" />
                  关闭
                </button>
              </div>
            </div>
            <div className="grid min-h-0 overflow-hidden bg-surface-lowest p-4">
              {collectorConfigMutation.isPending ? (
                <div className="min-h-0 overflow-auto rounded border border-outline bg-white">
                  <LogsEmptyState title="正在加载 collector.yaml" />
                </div>
              ) : collectorConfigMutation.error ? (
                <div className="min-h-0 overflow-auto rounded border border-outline bg-white">
                  <ErrorLine message={(collectorConfigMutation.error as Error).message} />
                </div>
              ) : (
                <pre className="min-h-0 overflow-auto rounded border border-outline bg-white p-4 font-mono text-[11px] leading-5 text-on-surface whitespace-pre-wrap">
                  {collectorConfigMutation.data?.collectorYAML || 'collector.yaml 为空'}
                </pre>
              )}
            </div>
          </div>
        </div>),
        document.body,
      ) : null}
    </div>
  );
}

function RouteSelector({ routes, services, activeRoute, onSelect }: {
  routes: LogRouteView[];
  services: LogsServiceSummary[];
  activeRoute: LogRouteView | null;
  onSelect: (routeId: string) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (!open) return undefined;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const viewportPadding = 12;
      const width = Math.min(Math.max(rect.width, 360), window.innerWidth - viewportPadding * 2);
      const left = Math.min(Math.max(viewportPadding, rect.left), window.innerWidth - width - viewportPadding);
      const estimatedHeight = Math.min(Math.max(routes.length, 1) * 66 + 8, 320);
      const below = rect.bottom + 6;
      const top = below + estimatedHeight <= window.innerHeight - viewportPadding
        ? below
        : Math.max(viewportPadding, rect.top - estimatedHeight - 6);
      setPopoverStyle({ top, left, width });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, routes.length]);

  const activeService = activeRoute ? services.find((service) => service.id === activeRoute.route.serviceId) ?? null : null;
  const activeName = activeService ? serviceDisplayName(activeService) : activeRoute?.route.serviceId ?? '选择采集路由';
  const activeLifecycle = activeRoute ? routeLifecycle(activeRoute) : null;
  const activeMeta = activeRoute
    ? `${logSourceLabel(activeRoute.route.sourceType)} · ${activeRoute.endpoint ? logSinkLabel(activeRoute.endpoint.sinkType) : 'endpoint -'} · ${activeLifecycle?.label ?? '-'}`
    : '服务 · 采集来源 · 下游端点';

  return (
    <div className="rounded-md">
      <button
        ref={triggerRef}
        type="button"
        className="flex h-12 w-full items-center gap-3 rounded-md border border-outline/80 bg-white px-3 text-left shadow-[0_2px_6px_rgba(24,52,96,0.06)] transition-colors hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={routes.length === 0}
        onClick={() => setOpen((value) => !value)}
      >
        <Server className="h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-on-surface">{activeName}</div>
          <div className="mt-1 truncate font-mono text-[11px] text-muted">{activeMeta}</div>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && typeof document !== 'undefined' ? createPortal((
        <>
          <button type="button" className="fixed inset-0 z-40 cursor-default border-0 bg-transparent" aria-label="关闭采集路由选择" onClick={() => setOpen(false)} />
          <div className="fixed z-50 max-h-80 overflow-y-auto rounded-md border border-outline bg-white p-1 shadow-[0_14px_36px_rgba(24,52,96,0.2)]" style={popoverStyle} role="listbox" aria-label="采集路由">
            {routes.map((route) => {
              const selected = route.route.id === (activeRoute?.route.id ?? '');
              const service = services.find((item) => item.id === route.route.serviceId) ?? null;
              const name = service ? serviceDisplayName(service) : route.route.serviceId;
              const lifecycle = routeLifecycle(route);
              const endpoint = route.endpoint ? logSinkLabel(route.endpoint.sinkType) : 'endpoint -';
              return (
                <button
                  key={route.route.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`w-full rounded px-3 py-2.5 text-left transition-colors ${selected ? 'bg-primary-soft/70' : 'hover:bg-surface-low'}`}
                  onClick={() => {
                    onSelect(route.route.id);
                    setOpen(false);
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className={`truncate text-sm font-semibold ${selected ? 'text-primary' : 'text-on-surface'}`}>{name}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold ${statusPillClass(lifecycle.tone)}`}>{lifecycle.label}</span>
                      {selected ? <Check className="h-4 w-4 text-primary" /> : null}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-[11px] font-medium text-muted">{route.route.name || route.route.id} · {logSourceLabel(route.route.sourceType)} · {endpoint}</div>
                  <div className="mt-1 truncate font-mono text-[10px] text-muted/80">{shortHash(route.route.collectorConfigHash)}</div>
                </button>
              );
            })}
          </div>
        </>
      ), document.body) : null}
    </div>
  );
}

function routeScope(route?: LogRouteView | null) {
  const source = route?.source;
  if (!source) return '-';
  if (source.sourceType === 'vm_file') return `${source.hostGroup || 'VM'} · ${source.pathPattern || '-'}`;
  return `${source.clusterId || '-'} / ${source.namespace || '-'} / ${source.workloadKind || '-'}/${source.workloadName || '-'}`;
}

function RuntimeFact({ label, value, tone }: { label: string; value: string; tone?: 'primary' }) {
  return (
    <div className="min-w-0 px-3 py-3">
      <dt className="text-[11px] font-semibold text-muted">{label}</dt>
      <dd className={`mt-1 break-all font-mono text-xs font-semibold ${tone === 'primary' ? 'text-primary' : 'text-on-surface'}`}>{value}</dd>
    </div>
  );
}

function collectorDomainScope(group?: { mode?: string; cluster?: string; namespace?: string; environment?: string } | null, instance?: { clusterId?: string; agentNamespace?: string } | null) {
  if (!group) return '-';
  if (group.mode === 'dedicated_collector' || group.mode === 'daemonset' || group.cluster) {
    return `${instance?.clusterId || group.cluster || '-'} / ${instance?.agentNamespace || group.namespace || '-'}`;
  }
  return group.environment || '-';
}

function shortHash(value?: string) {
  if (!value) return '-';
  return value.length > 12 ? value.slice(0, 12) : value;
}

function shortIdentity(value?: string) {
  if (!value) return '-';
  return value.length > 16 ? value.slice(0, 16) : value;
}

function ErrorLine({ message }: { message: string }) {
  return (
    <div className="m-3 flex items-center gap-2 rounded border border-red-500/30 bg-red-50 px-3 py-2 text-sm text-red-600">
      <XCircle className="h-4 w-4" />{message}
    </div>
  );
}
