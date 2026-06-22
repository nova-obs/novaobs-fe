import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Copy, FileText, RefreshCw, ShieldCheck, WifiOff, XCircle } from 'lucide-react';
import { api } from '../../services/api';
import { logSinkLabel, logSourceLabel, logsApi, type LogRouteView } from './api';
import { isCollectingRoute, routeLifecycle, serviceDisplayName, statusPillClass } from './ServicePickerPanel';
import { LogsEmptyState, LogsInfoCell, LogsSection, LogsToolbarButton } from './LogsPrimitives';

export function LogsAgentsPage() {
  const [params] = useSearchParams();
  const initialRouteId = params.get('route_id') ?? '';
  const [selectedRouteId, setSelectedRouteId] = useState(initialRouteId);
  const [collectorConfigRoute, setCollectorConfigRoute] = useState<LogRouteView | null>(null);
  const [agentInstancesOpen, setAgentInstancesOpen] = useState(false);
  const { data: workspace, isLoading: workspaceLoading, error: workspaceError, refetch: refetchWorkspace } = useQuery({
    queryKey: ['logs-onboarding-workspace'],
    queryFn: logsApi.getWorkspace,
  });

  const services = workspace?.services ?? [];
  const groups = workspace?.collectorGroups ?? [];
  const runningRoutes = useMemo(() => (workspace?.routes ?? []).filter(isCollectingRoute), [workspace]);
  const activeRoute = runningRoutes.find((route) => route.route.id === selectedRouteId) ?? runningRoutes[0] ?? null;
  const activeGroupId = activeRoute?.route.agentGroupId ?? '';
  const activeGroup = groups.find((group) => group.id === activeGroupId) ?? null;
  const activeService = activeRoute ? services.find((service) => service.id === activeRoute.route.serviceId) ?? null : null;
  const activeDomainRoutes = useMemo(() => (
    activeRoute ? runningRoutes.filter((route) => sameCollectorDomain(route, activeRoute)) : []
  ), [activeRoute, runningRoutes]);

  useEffect(() => {
    if (runningRoutes.length === 0) {
      setSelectedRouteId('');
      return;
    }
    if (selectedRouteId && runningRoutes.some((route) => route.route.id === selectedRouteId)) return;
    const routeFromUrl = initialRouteId ? runningRoutes.find((route) => route.route.id === initialRouteId) : null;
    setSelectedRouteId(routeFromUrl?.route.id ?? runningRoutes[0].route.id);
  }, [initialRouteId, runningRoutes, selectedRouteId]);

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

  const activeLifecycle = activeRoute ? routeLifecycle(activeRoute) : null;
  const activeServiceName = activeService ? serviceDisplayName(activeService) : activeRoute?.route.serviceId ?? '-';
  const activeScope = routeScope(activeRoute);
  const activeAgentScope = collectorDomainScope(activeGroup, instances[0]);

  return (
    <div className="logs-routes-workbench grid min-h-[720px] gap-3 xl:h-full xl:min-h-0 xl:grid-cols-[340px_minmax(0,1fr)_320px] xl:overflow-hidden">
      <LogsSection
        title="运行中路由"
        meta={workspaceLoading ? 'loading' : `${runningRoutes.length} running routes`}
        className="min-h-0 flex flex-col"
        bodyClassName="min-h-0 flex flex-1 flex-col overflow-hidden p-0"
        action={<LogsToolbarButton onClick={() => refetchWorkspace()}><RefreshCw className="h-3.5 w-3.5" />刷新</LogsToolbarButton>}
      >
        {workspaceError ? <ErrorLine message={(workspaceError as Error).message} /> : null}
        {runningRoutes.length === 0 ? <LogsEmptyState title="暂无运行中采集路由" description="已登记但未发布的路由继续留在接入配置中处理。" /> : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {runningRoutes.map((route) => {
              const active = route.route.id === (activeRoute?.route.id ?? '');
              const lifecycle = routeLifecycle(route);
              const service = services.find((item) => item.id === route.route.serviceId) ?? null;
              return (
                <button
                  key={route.route.id}
                  className={`w-full border-b border-outline/60 px-3 py-2.5 text-left transition-colors ${
                    active ? 'bg-primary-soft/70 text-primary shadow-[inset_3px_0_0_#0d5bd7]' : 'bg-white/46 text-on-surface hover:bg-surface-low/70'
                  }`}
                  onClick={() => setSelectedRouteId(route.route.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="break-words text-sm font-semibold">{service ? serviceDisplayName(service) : route.route.serviceId}</div>
                      <div className="mt-1 break-all font-mono text-[11px] text-muted">{routeScope(route)}</div>
                    </div>
                    <span className={`inline-flex shrink-0 rounded border px-2 py-0.5 text-[11px] font-semibold ${statusPillClass(lifecycle.tone)}`}>{lifecycle.label}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5 font-mono text-[11px] text-muted">
                    <span>{logSourceLabel(route.route.sourceType)}</span>
                    <span>{shortHash(route.route.collectorConfigHash)}</span>
                    <span>{route.endpoint ? logSinkLabel(route.endpoint.sinkType) : 'endpoint -'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </LogsSection>

      <LogsSection
        title="采集域状态"
        meta={activeRoute ? `${activeDomainRoutes.length} routes · ${instances.length} instances` : 'route domain'}
        className="min-h-0 flex flex-col"
        bodyClassName="min-h-0 flex-1 overflow-y-auto p-0"
        action={<LogsToolbarButton onClick={() => refetchInstances()} disabled={!activeGroupId}><RefreshCw className="h-3.5 w-3.5" />刷新</LogsToolbarButton>}
      >
        {instancesError ? <ErrorLine message={(instancesError as Error).message} /> : null}
        {!activeRoute ? <LogsEmptyState title="未选择运行中路由" /> : !activeGroupId ? <LogsEmptyState title="路由未绑定采集域" /> : (
          <div className="space-y-3 p-3">
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              <DomainMetric label="发布状态" value={activeLifecycle?.label || '-'} tone={activeLifecycle?.tone === 'success' ? 'primary' : undefined} />
              <DomainMetric label="Agent 健康" value={`${onlineCount} / ${instances.length}`} tone={instances.length > 0 && onlineCount === instances.length ? 'primary' : undefined} />
              <DomainMetric label="采集配置 hash" value={activeRoute.route.collectorConfigHash || activeRoute.source?.collectorConfigHash || '-'} tone="primary" />
              <DomainMetric label="最近发布时间" value={activeRoute.route.lastPublishedAt || '-'} />
            </div>
            <section className="overflow-hidden rounded-lg border border-outline bg-white">
              <button type="button" className="flex w-full items-center justify-between gap-3 border-b border-outline bg-surface-lowest px-3 py-2.5 text-left" onClick={() => setAgentInstancesOpen((open) => !open)}>
                <div>
                  <div className="text-sm font-semibold text-on-surface">Agent 实例</div>
                  <div className="mt-0.5 font-mono text-[11px] text-muted">{instancesLoading ? 'loading' : `${instances.length} instances · ${onlineCount} healthy`}</div>
                </div>
                <span className="rounded border border-outline bg-white px-2 py-1 text-[11px] font-semibold text-primary">{agentInstancesOpen ? '收起' : '展开'}</span>
              </button>
              {agentInstancesOpen ? (
                instances.length === 0 ? <LogsEmptyState title="暂无 Agent 心跳数据" /> : (
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
                )
              ) : null}
            </section>
          </div>
        )}
      </LogsSection>

      <LogsSection title="路由上下文" meta={activeRoute?.route.collectorConfigHash || 'route context'} className="min-h-0 flex flex-col" bodyClassName="min-h-0 flex-1 overflow-y-auto p-0">
        <LogsInfoCell label="服务" value={activeServiceName} tone="primary" />
        <LogsInfoCell label="范围" value={activeScope} />
        <LogsInfoCell label="来源" value={activeRoute ? logSourceLabel(activeRoute.route.sourceType) : '-'} />
        <LogsInfoCell label="下游" value={activeRoute?.endpoint ? `${activeRoute.endpoint.name} · ${logSinkLabel(activeRoute.endpoint.sinkType)}` : '-'} />
        <LogsInfoCell label="采集域" value={activeGroup?.displayName || activeGroup?.name || '-'} />
        <LogsInfoCell label="采集域模式" value={activeGroup?.mode || '-'} />
        <LogsInfoCell label="采集域范围" value={activeGroup ? activeAgentScope : '-'} />
        <LogsInfoCell label="Agent Namespace" value={instances[0]?.agentNamespace || activeGroup?.namespace || '-'} />
        <LogsInfoCell label="部署清单 hash" value={activeRoute?.source?.deploymentManifestHash || '-'} />
        <LogsInfoCell label="Audit" value={activeRoute?.route.lastAuditId || '-'} />
        <LogsInfoCell label="Preview" value={activeRoute?.route.lastPreviewId || '-'} />
        <div className="border-t border-outline/70 p-3">
          <div className="grid gap-2">
            <button
              className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-outline bg-white px-3 text-xs font-semibold text-on-surface transition-all hover:border-primary/40 hover:text-primary disabled:opacity-60"
              disabled={!activeRoute}
              onClick={() => activeRoute && openCollectorConfig(activeRoute)}
            >
              <FileText className="h-3.5 w-3.5" />
              查看采集配置
            </button>
            <Link
              className={`inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-semibold transition-all ${
                activeRoute ? 'bg-primary text-white active:translate-y-px' : 'pointer-events-none bg-primary text-white opacity-60'
              }`}
              to={`/logs/onboarding?mode=update&route_id=${activeRoute?.route.id || ''}`}
            >
              更新配置
            </Link>
          </div>
        </div>
      </LogsSection>

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

function routeScope(route?: LogRouteView | null) {
  const source = route?.source;
  if (!source) return '-';
  if (source.sourceType === 'vm_file') return `${source.hostGroup || 'VM'} · ${source.pathPattern || '-'}`;
  return `${source.clusterId || '-'} / ${source.namespace || '-'} / ${source.workloadKind || '-'}/${source.workloadName || '-'}`;
}

function sameCollectorDomain(left: LogRouteView, right: LogRouteView) {
  const leftSource = left.source;
  const rightSource = right.source;
  if (!leftSource || !rightSource || leftSource.sourceType !== rightSource.sourceType) return false;
  if (leftSource.sourceType === 'vm_file') {
    return (leftSource.hostGroup || '') === (rightSource.hostGroup || '');
  }
  return leftSource.clusterId === rightSource.clusterId
    && (leftSource.agentNamespace || 'novaobs-system') === (rightSource.agentNamespace || 'novaobs-system');
}

function DomainMetric({ label, value, tone }: { label: string; value: string; tone?: 'primary' }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${
      tone === 'primary' ? 'border-primary/20 bg-primary-soft/45' : 'border-outline bg-surface-lowest'
    }`}>
      <div className="text-[11px] font-semibold text-muted">{label}</div>
      <div className={`mt-1 break-all font-mono text-xs font-semibold ${tone === 'primary' ? 'text-primary' : 'text-on-surface'}`}>{value}</div>
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
