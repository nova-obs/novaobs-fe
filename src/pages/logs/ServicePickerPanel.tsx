import type { ReactNode } from 'react';
import { PencilLine, Search, Server } from 'lucide-react';
import type { LogRouteView, LogsServiceSummary } from './api';

export type StatusTone = 'success' | 'warning' | 'danger' | 'muted' | 'primary';

export function serviceDisplayName(service: LogsServiceSummary) {
  return service.displayName || service.name;
}

export function routeLifecycle(route: LogRouteView): { label: string; tone: StatusTone; detail: string } {
  const status = route.route.lastPublishStatus || route.route.status;
  if (route.route.sourceType === 'vm_file') {
    if (status === 'failed' || status === 'error') {
      return { label: '配置失败', tone: 'danger', detail: route.route.lastPublishMessage || '采集配置生成失败' };
    }
    return { label: '手工接入', tone: 'muted', detail: '通过安装材料和节点回填完成接入' };
  }
  if (status === 'applied' || status === 'ready_for_agent_sync') {
    return { label: '已发布', tone: 'success', detail: route.route.lastPublishMessage || '采集配置已下发' };
  }
  if (status === 'previewed') {
    return { label: '待确认', tone: 'primary', detail: '发布预览已生成' };
  }
  if (status === 'pending_publish') {
    return { label: '待发布', tone: 'warning', detail: route.route.lastPublishMessage || '配置已变更' };
  }
  if (status === 'failed' || status === 'error') {
    return { label: '失败', tone: 'danger', detail: route.route.lastPublishMessage || '发布或探测异常' };
  }
  if (route.route.collectorConfigHash) {
    return { label: '未发布', tone: 'muted', detail: '路由已保存，等待发布' };
  }
  return { label: '未配置', tone: 'muted', detail: '等待保存路由' };
}

export function routeAccessPriority(route: LogRouteView) {
  const status = route.route.lastPublishStatus || route.route.status;
  if (status === 'applied' || status === 'ready_for_agent_sync') return 0;
  if (status === 'previewed' || status === 'pending_publish') return 1;
  if (status === 'failed' || status === 'error') return 2;
  if (route.route.collectorConfigHash) return 3;
  return 4;
}

export function isCollectingRoute(route: LogRouteView | null | undefined) {
  if (!route) return false;
  const status = route.route.lastPublishStatus || route.route.status;
  return route.route.sourceType !== 'vm_file' && (status === 'applied' || status === 'ready_for_agent_sync');
}

export function statusPillClass(tone: StatusTone) {
  switch (tone) {
    case 'success':
      return 'border-primary/20 bg-primary-soft text-primary';
    case 'warning':
      return 'border-warning/30 bg-amber-50 text-warning';
    case 'danger':
      return 'border-danger/30 bg-red-50 text-danger';
    case 'primary':
      return 'border-primary/25 bg-white text-primary';
    default:
      return 'border-outline bg-white text-muted';
  }
}

function statusDotClass(tone: StatusTone) {
  if (tone === 'success') return 'bg-primary';
  if (tone === 'warning') return 'bg-warning';
  if (tone === 'danger') return 'bg-danger';
  if (tone === 'primary') return 'bg-primary';
  return 'bg-muted';
}

function serviceAccessState(serviceRoutes: LogRouteView[]) {
  if (serviceRoutes.length === 0) {
    return { label: '未接入', tone: 'muted' as StatusTone, detail: '可接入' };
  }
  const lifecycle = routeLifecycle(serviceRoutes[0]);
  return {
    label: lifecycle.label === '已发布' ? '采集中' : lifecycle.label,
    tone: lifecycle.tone,
    detail: lifecycle.label === '已发布' ? '生产采集已启用' : lifecycle.detail,
  };
}

function serviceWorkloadLabel(service: LogsServiceSummary) {
  if (service.identityType === 'host_process') return service.serviceType || 'host process';
  return service.serviceType || service.identityType || 'workload';
}

function serviceLogPath(service: LogsServiceSummary) {
  if (service.identityType === 'host_process') return '/data/logs/*.log';
  if (!service.namespace && !service.name) return '-';
  return `/var/log/pods/${service.namespace || '*'}_${service.name || '*'}*/*/*.log`;
}

function serviceFreshnessLabel(service: LogsServiceSummary) {
  return service.syncStatus || service.source || '-';
}

function PickerEmpty({ label, action }: { label: string; action?: ReactNode }) {
  return (
    <div className="console-empty-state min-h-[320px] rounded-none border-0 border-t border-outline bg-surface-lowest">
      <div>
        <Server className="mx-auto h-5 w-5 text-muted" />
        <div className="mt-3 text-sm font-semibold text-on-surface">{label}</div>
        <div className="mt-1 text-xs text-muted">当前范围没有可选服务，先同步 K8s 服务或调整搜索条件。</div>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}

export function ServicePickerPanel({
  services,
  selectedServiceId,
  serviceQuery,
  routeEditMode,
  locked = false,
  serviceRoutesByService,
  toolbarAction,
  emptyAction,
  syncMessage,
  onServiceQueryChange,
  onSelectService,
  onEditRoute,
}: {
  services: LogsServiceSummary[];
  selectedServiceId: string;
  serviceQuery: string;
  routeEditMode: boolean;
  locked?: boolean;
  serviceRoutesByService: Map<string, LogRouteView[]>;
  toolbarAction?: ReactNode;
  emptyAction?: ReactNode;
  syncMessage?: ReactNode;
  onServiceQueryChange: (query: string) => void;
  onSelectService: (service: LogsServiceSummary) => void;
  onEditRoute: (route: LogRouteView) => void;
}) {
  return (
    <section className="logs-service-picker-panel relative flex min-h-[520px] flex-col overflow-hidden bg-surface-lowest xl:h-full xl:min-h-0">
      <div className="logs-service-picker-toolbar flex flex-col gap-2 border-b border-outline bg-surface-lowest px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            className="console-input h-9 w-full pl-8 text-sm disabled:cursor-not-allowed disabled:opacity-70"
            value={serviceQuery}
            onChange={(event) => onServiceQueryChange(event.target.value)}
            placeholder={locked ? '当前路由服务' : '搜索服务、命名空间或标签'}
            disabled={locked}
          />
        </div>
        {toolbarAction ? <div className="flex shrink-0 items-center gap-2">{toolbarAction}</div> : null}
      </div>
      {syncMessage ? (
        <div className="border-b border-outline bg-primary-soft/35 px-3 py-2 text-[11px] font-semibold text-primary">
          {syncMessage}
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto">
        {services.length === 0 ? <PickerEmpty label="暂无匹配服务" action={emptyAction} /> : (
          <table className="console-table logs-service-picker-table min-w-[960px] w-full">
            <thead>
              <tr>
                <th>服务</th>
                <th>命名空间</th>
                <th className="w-24">状态</th>
                <th>工作负载</th>
                <th>日志路径</th>
                <th>最近发现</th>
                <th className="w-24">操作</th>
              </tr>
            </thead>
            <tbody>
              {services.map((service) => {
                const serviceRoutes = serviceRoutesByService.get(service.id) ?? [];
                const serviceRoute = serviceRoutes.find(isCollectingRoute) ?? null;
                const accessState = serviceAccessState(serviceRoutes);
                const selected = service.id === selectedServiceId;
                const selectable = !locked;
                return (
                  <tr
                    key={service.id}
                    role={selectable ? 'button' : undefined}
                    tabIndex={selectable ? 0 : undefined}
                    aria-pressed={selected || undefined}
                    className={`${selectable ? 'cursor-pointer' : ''} ${selected ? 'console-selected-row' : ''}`}
                    onClick={() => {
                      if (selectable) onSelectService(service);
                    }}
                    onKeyDown={(event) => {
                      if (!selectable) return;
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelectService(service);
                      }
                    }}
                  >
                    <td>
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-on-surface">{serviceDisplayName(service)}</div>
                      </div>
                    </td>
                    <td className="font-mono text-xs text-muted">
                      <div className="truncate">{service.namespace || '-'}</div>
                      <div className="mt-0.5 truncate text-[11px]">{service.cluster || service.environmentId || '-'}</div>
                    </td>
                    <td>
                      <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-semibold ${statusPillClass(accessState.tone)}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${statusDotClass(accessState.tone)}`} />
                        {accessState.label}
                      </span>
                    </td>
                    <td className="font-mono text-xs text-muted">{serviceWorkloadLabel(service)}</td>
                    <td className="max-w-[300px] truncate font-mono text-xs text-muted">{serviceLogPath(service)}</td>
                    <td className="font-mono text-xs text-muted">{serviceFreshnessLabel(service)}</td>
                    <td>
                      {serviceRoute ? (
                        <button
                          type="button"
                          className="console-table-action"
                          onClick={(event) => {
                            event.stopPropagation();
                            onEditRoute(serviceRoute);
                          }}
                        >
                          <PencilLine className="h-3.5 w-3.5" />
                          {selected && routeEditMode ? '编辑中' : '更新配置'}
                        </button>
                      ) : <span className="font-mono text-xs text-muted">-</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
