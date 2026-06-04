import { PencilLine, Search, Server } from 'lucide-react';
import type { LogRouteView, LogsServiceSummary } from './api';

export type StatusTone = 'success' | 'warning' | 'danger' | 'muted' | 'primary';

export function serviceDisplayName(service: LogsServiceSummary) {
  return service.displayName || service.name;
}

export function routeLifecycle(route: LogRouteView): { label: string; tone: StatusTone; detail: string } {
  const status = route.route.lastPublishStatus || route.route.status;
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
  return status === 'applied' || status === 'ready_for_agent_sync';
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

function serviceAccessCardClass(tone: StatusTone, selected: boolean) {
  const base = 'logs-service-access-card relative grid w-full gap-1 overflow-hidden rounded-lg border px-3 py-2.5 text-left transition-all before:absolute before:inset-y-2 before:left-0 before:w-1 active:translate-y-px';
  if (selected) {
    return `${base} ${selectedServiceAccessCardClass()}`;
  }
  if (tone === 'success') {
    return `${base} ${runningServiceAccessCardClass()}`;
  }
  if (tone === 'warning') {
    return `${base} border-warning/28 bg-amber-50/78 text-on-surface before:bg-warning hover:border-warning/45 hover:bg-amber-50`;
  }
  if (tone === 'danger') {
    return `${base} border-danger/28 bg-red-50/72 text-on-surface before:bg-danger hover:border-danger/45 hover:bg-red-50`;
  }
  if (tone === 'primary') {
    return `${base} border-primary/28 bg-white text-on-surface before:bg-primary hover:bg-surface-low/80`;
  }
  return `${base} border-outline bg-white/62 text-on-surface before:bg-outline hover:bg-surface-low/80`;
}

function selectedServiceAccessCardClass() {
  return 'border-primary bg-primary-soft text-on-surface before:bg-primary shadow-[inset_3px_0_0_rgba(13,91,215,0.82),0_0_0_1px_rgba(13,91,215,0.18)]';
}

function runningServiceAccessCardClass() {
  return 'border-outline bg-white/82 text-on-surface before:bg-primary hover:border-primary/35 hover:bg-primary-soft/45';
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

function serviceMetaItems(service: LogsServiceSummary) {
  return [
    service.environment || 'env -',
    service.ownerTeam || 'owner -',
    service.serviceType || 'service',
    service.source || 'local',
  ];
}

function ServiceAccessCard({
  service,
  selected,
  routeEditMode,
  locked,
  serviceRoutes,
  onSelect,
  onEditRoute,
}: {
  service: LogsServiceSummary;
  selected: boolean;
  routeEditMode: boolean;
  locked: boolean;
  serviceRoutes: LogRouteView[];
  onSelect: () => void;
  onEditRoute: (route: LogRouteView) => void;
}) {
  const serviceRoute = serviceRoutes.find(isCollectingRoute) ?? null;
  const accessState = serviceAccessState(serviceRoutes);
  const displayName = serviceDisplayName(service);
  return (
    <div
      role={locked ? undefined : 'button'}
      tabIndex={locked ? undefined : 0}
      className={`mb-1.5 ${serviceAccessCardClass(accessState.tone, selected)}`}
      onClick={() => {
        if (!locked) onSelect();
      }}
      onKeyDown={(event) => {
        if (locked) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0">
          <div className="service-card-primary whitespace-normal break-words text-sm font-semibold leading-5">{displayName}</div>
          <div className="service-card-meta-grid mt-1 flex flex-wrap gap-1.5 font-mono text-[11px] font-semibold text-muted">
            {serviceMetaItems(service).map((item) => (
              <span key={item} className="max-w-full rounded border border-outline bg-white/78 px-1.5 py-0.5 leading-4 break-all">{item}</span>
            ))}
          </div>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${statusPillClass(accessState.tone)}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${statusDotClass(accessState.tone)}`} />
          {accessState.label}
        </span>
      </div>
      <div className="whitespace-normal break-words text-[11px] font-semibold leading-4 text-muted">{accessState.detail}</div>
      {service.identityType === 'k8s_workload' ? (
        <div className="service-card-runtime-grid grid grid-cols-[52px_minmax(0,1fr)] gap-x-2 gap-y-0.5 font-mono text-[11px] leading-4 text-muted">
          <span className="font-semibold text-muted/85">集群</span>
          <span className="break-all text-on-surface/75">{service.cluster || '-'}</span>
          <span className="font-semibold text-muted/85">空间</span>
          <span className="break-all text-on-surface/75">{service.namespace || '-'}</span>
        </div>
      ) : null}
      {serviceRoute ? (
        <div className="mt-2 flex justify-end gap-1.5">
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-primary bg-white px-2.5 text-[11px] font-semibold text-primary transition-all hover:bg-primary-soft active:translate-y-px"
            onClick={(event) => {
              event.stopPropagation();
              onEditRoute(serviceRoute);
            }}
          >
            <PencilLine className="h-3.5 w-3.5" />
            {selected && routeEditMode ? '编辑中' : '更新配置'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function PickerEmpty({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-sm text-muted">
      <Server className="h-4 w-4" />{label}
    </div>
  );
}

export function ServicePickerPanel({
  services,
  sourceServiceCount,
  totalServiceCount,
  selectedServiceId,
  serviceQuery,
  routeEditMode,
  locked = false,
  serviceRoutesByService,
  onServiceQueryChange,
  onSelectService,
  onEditRoute,
}: {
  services: LogsServiceSummary[];
  sourceServiceCount: number;
  totalServiceCount: number;
  selectedServiceId: string;
  serviceQuery: string;
  routeEditMode: boolean;
  locked?: boolean;
  serviceRoutesByService: Map<string, LogRouteView[]>;
  onServiceQueryChange: (query: string) => void;
  onSelectService: (service: LogsServiceSummary) => void;
  onEditRoute: (route: LogRouteView) => void;
}) {
  return (
    <section className="logs-service-picker-panel relative flex min-h-[560px] flex-col overflow-hidden rounded-lg border border-outline bg-surface-lowest xl:min-h-[640px]">
      <div className="flex items-center justify-between gap-2 border-b border-outline bg-white/72 px-3 py-2.5">
        <div className="flex items-center gap-2 text-sm font-semibold text-on-surface">
          <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_0_4px_rgba(13,91,215,0.12)]" />
          服务
        </div>
        <span className="rounded-lg bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-muted shadow-[inset_0_0_0_1px_rgba(216,226,239,0.8)]">{sourceServiceCount}/{totalServiceCount} services</span>
      </div>
      <div className="border-b border-outline px-3 py-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input className="console-input h-9 w-full pl-8 text-sm disabled:cursor-not-allowed disabled:opacity-70" value={serviceQuery} onChange={(event) => onServiceQueryChange(event.target.value)} placeholder={locked ? '当前路由服务' : '搜索服务'} disabled={locked} />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {services.length === 0 ? <PickerEmpty label="暂无匹配服务" /> : services.map((service) => (
          <ServiceAccessCard
            key={service.id}
            service={service}
            selected={service.id === selectedServiceId}
            routeEditMode={routeEditMode}
            locked={locked}
            serviceRoutes={serviceRoutesByService.get(service.id) ?? []}
            onSelect={() => onSelectService(service)}
            onEditRoute={onEditRoute}
          />
        ))}
      </div>
    </section>
  );
}
