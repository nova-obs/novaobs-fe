import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, Check, ChevronDown, Database, ExternalLink, ListFilter, RefreshCw, Route } from 'lucide-react';
import { buildVictoriaLogsVMUIURL, logSinkLabel, logsApi, logSourceLabel, type LogRouteView } from './api';
import { LogsEmptyState, LogsInfoCell, LogsSection } from './LogsPrimitives';

function serviceName(route: LogRouteView, services: Array<{ id: string; name: string; displayName: string }>) {
  const service = services.find((item) => item.id === route.route.serviceId);
  return service?.displayName || service?.name || route.route.serviceId;
}

function routeScope(route?: LogRouteView | null) {
  const source = route?.source;
  if (!source) return '-';
  if (source.sourceType === 'vm_file') return `${source.hostGroup || 'VM'} · ${source.pathPattern || '-'}`;
  return `${source.clusterId}/${source.namespace}/${source.workloadKind || 'Workload'}/${source.workloadName || '-'}`;
}

export function LogsExplorePage() {
  const { data: workspace, error, refetch } = useQuery({
    queryKey: ['logs-onboarding-workspace'],
    queryFn: logsApi.getWorkspace,
  });
  const routes = workspace?.routes ?? [];
  const services = workspace?.services ?? [];
  const [routeId, setRouteId] = useState('');
  const activeRoute = useMemo(() => routes.find((item) => item.route.id === routeId) ?? routes[0] ?? null, [routeId, routes]);
  const vmuiURL = buildVictoriaLogsVMUIURL(activeRoute?.endpoint);
  const activeSinkLabel = logSinkLabel(activeRoute?.endpoint?.sinkType);
  const selectedServiceName = activeRoute ? serviceName(activeRoute, services) : '-';

  return (
    <div className="logs-explore-workbench grid min-h-[760px] gap-3 xl:h-full xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_300px] xl:overflow-hidden">
      <section className="console-panel min-h-0 flex flex-col overflow-hidden">
        {error ? <ErrorLine message={(error as Error).message} /> : null}
        <div className="shrink-0 border-b border-outline bg-surface-low/70 p-3 shadow-[0_10px_24px_rgba(24,52,96,0.10)]">
          <div className="grid items-start gap-2 lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)]">
            <div className="logs-explore-context-panel min-w-0 overflow-hidden rounded-md border border-primary/25 bg-white shadow-[0_8px_18px_rgba(24,52,96,0.12)]">
              <div className="logs-explore-context-header flex h-7 items-center justify-between gap-2 border-b border-primary/15 bg-primary-soft/75 px-3 text-[11px] font-semibold text-primary">
                <span>日志路由</span>
                <span className="font-mono font-medium">{routes.length} routes</span>
              </div>
              <div className="p-2">
                <RouteSelector routes={routes} services={services} activeRoute={activeRoute} onSelect={setRouteId} />
              </div>
            </div>
            <div className="logs-explore-context-panel min-w-0 overflow-hidden rounded-md border border-primary/25 bg-white shadow-[0_8px_18px_rgba(24,52,96,0.12)]">
              <div className="logs-explore-context-header flex h-7 items-center justify-between gap-2 border-b border-primary/15 bg-primary-soft/75 px-2 pl-3 text-[11px] font-semibold text-primary">
                <span>查询上下文</span>
                <div className="logs-explore-query-actions flex items-center gap-1">
                  {vmuiURL ? (
                    <a
                      className="inline-flex h-6 w-6 items-center justify-center rounded border border-primary/15 bg-white/75 text-primary transition-colors hover:border-primary/35 hover:bg-white"
                      href={vmuiURL}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="在新窗口打开查询"
                      title="新窗口"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="inline-flex h-6 w-6 items-center justify-center rounded border border-primary/15 bg-white/75 text-primary transition-colors hover:border-primary/35 hover:bg-white"
                    onClick={() => refetch()}
                    aria-label="刷新日志上下文"
                    title="刷新"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="p-2">
                <div className="query-context-summary flex h-14 min-w-0 items-center gap-3 rounded-md border border-primary/15 bg-primary-soft/35 px-3 shadow-[inset_3px_0_0_#0d5bd7]">
                  <Database className="h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <div className="truncate font-mono text-xs font-semibold text-on-surface">{activeRoute ? routeScope(activeRoute) : '未选择日志路由'}</div>
                    <div className="mt-1 truncate text-[11px] text-muted">{activeRoute ? `${activeSinkLabel} · ${activeRoute.endpoint?.name || '-'} · tenant ${activeRoute.endpoint?.accountId || '0'}:${activeRoute.endpoint?.projectId || '0'}` : '选择路由后确定查询作用域'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {vmuiURL ? (
          <iframe className="min-h-[420px] w-full flex-1 border-0 bg-white xl:min-h-0" src={vmuiURL} title="Logs query console" />
        ) : (
          <LogsEmptyState
            title={routes.length === 0 ? '日志路由为空' : '当前下游未提供内嵌查询入口'}
            action={routes.length === 0 ? <Link className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-semibold text-white" to="/logs/onboarding">接入配置</Link> : undefined}
          />
        )}
      </section>

      <LogsSection title="详情" meta={activeRoute?.route.collectorConfigHash || 'route context'} className="min-h-0 flex flex-col" bodyClassName="min-h-0 flex-1 overflow-y-auto p-0">
        <LogsInfoCell label="服务" value={selectedServiceName} tone="primary" />
        <LogsInfoCell label="来源" value={activeRoute ? logSourceLabel(activeRoute.route.sourceType) : '-'} />
        <LogsInfoCell label="范围" value={routeScope(activeRoute)} />
        <LogsInfoCell label="端点" value={activeRoute?.endpoint?.name || '-'} />
        <LogsInfoCell label="租户" value={activeRoute?.endpoint?.accountId && activeRoute?.endpoint?.projectId ? `${activeRoute.endpoint.accountId}:${activeRoute.endpoint.projectId}` : '0:0（默认）'} />
        <LogsInfoCell label="采集配置 hash" value={activeRoute?.route.collectorConfigHash || '-'} />
        <LogsInfoCell label="发布状态" value={activeRoute?.route.lastPublishStatus || activeRoute?.route.status || '-'} />
        <div className="border-t border-outline/70 p-3">
          <div className="mb-2 text-xs font-semibold text-on-surface">动作</div>
          <div className="grid gap-2">
            <Link className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-outline bg-white text-xs font-semibold text-muted hover:border-primary/40 hover:text-on-surface" to="/logs/alerts">
              <Bell className="h-3.5 w-3.5" />创建告警
            </Link>
            <Link className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-outline bg-white text-xs font-semibold text-muted hover:border-primary/40 hover:text-on-surface" to={`/logs/agents?agent_group_id=${activeRoute?.route.agentGroupId || ''}&route_id=${activeRoute?.route.id || ''}`}>
              <ListFilter className="h-3.5 w-3.5" />查看采集路由
            </Link>
          </div>
        </div>
      </LogsSection>
    </div>
  );
}

function ErrorLine({ message }: { message: string }) {
  return <div className="m-3 rounded border border-red-500/30 bg-red-50 px-3 py-2 text-sm text-red-600">{message}</div>;
}

function RouteSelector({ routes, services, activeRoute, onSelect }: {
  routes: LogRouteView[];
  services: Array<{ id: string; name: string; displayName: string }>;
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
      const width = Math.min(Math.max(rect.width, 420), window.innerWidth - viewportPadding * 2);
      const left = Math.min(Math.max(viewportPadding, rect.left), window.innerWidth - width - viewportPadding);
      const estimatedHeight = Math.min(Math.max(routes.length, 1) * 68 + 8, 288);
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

  return (
    <div className="route-selector rounded-md">
      <button
        ref={triggerRef}
        type="button"
        className="route-selector-trigger flex h-14 w-full items-center gap-3 rounded-md border border-outline/80 bg-white px-3 text-left shadow-[0_2px_6px_rgba(24,52,96,0.06)] transition-colors hover:border-primary/40"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((value) => !value)}
      >
        <Route className="h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-on-surface">{activeRoute ? serviceName(activeRoute, services) : '选择日志路由'}</div>
          <div className="mt-1 truncate font-mono text-[11px] text-muted">{activeRoute ? `${activeRoute.endpoint?.name || 'endpoint -'} · ${logSourceLabel(activeRoute.route.sourceType)}` : '服务 · 端点 · 来源'}</div>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && typeof document !== 'undefined' ? createPortal((
        <>
          <button type="button" className="fixed inset-0 z-40 cursor-default border-0 bg-transparent" aria-label="关闭日志路由选择" onClick={() => setOpen(false)} />
          <div className="route-selector-popover fixed z-50 max-h-72 overflow-y-auto rounded-md border border-outline bg-white p-1 shadow-[0_14px_36px_rgba(24,52,96,0.2)]" style={popoverStyle} role="listbox" aria-label="日志路由">
        {routes.length === 0 ? <div className="px-3 py-5 text-center text-xs text-muted">暂无日志路由</div> : routes.map((route) => {
          const selected = route.route.id === activeRoute?.route.id;
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
                <span className={`truncate text-sm font-semibold ${selected ? 'text-primary' : 'text-on-surface'}`}>{serviceName(route, services)}</span>
                {selected ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
              </div>
              <div className="route-option-context mt-1 truncate text-[11px] font-medium text-muted">{route.endpoint?.name || 'endpoint -'} · {logSourceLabel(route.route.sourceType)}</div>
              <div className="mt-1 truncate font-mono text-[10px] text-muted/80">{routeScope(route)}</div>
            </button>
          );
        })}
          </div>
        </>
      ), document.body) : null}
    </div>
  );
}
