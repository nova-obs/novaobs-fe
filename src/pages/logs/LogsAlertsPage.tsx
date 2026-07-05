import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, ExternalLink, Plus, RefreshCw, Route, Search, Server, XCircle } from 'lucide-react';
import { StatusBadge } from '../../components/StatusBadge';
import type { AlertRule } from '../../services/types';
import { api } from '../../services/api';
import { LogsAlertRuleEditorDrawer } from './LogsAlertRulePage';
import { LogsEmptyState } from './LogsPrimitives';
import { logsApi, type LogRouteView, type LogTargetView, type LogsServiceSummary } from './api';
import { routeAccessPriority } from './ServicePickerPanel';

type AlertServiceLogKind = 'external' | 'platform' | 'none';

interface AlertServiceRow {
  id: string;
  name: string;
  environment: string;
  ownerTeam: string;
  ruleCount: number;
  enabledCount: number;
  updatedAt: string;
  logLinkKind: AlertServiceLogKind;
  logLinkLabel: string;
  logLinkStatus: string;
  endpointName: string;
  canCreateAlert: boolean;
}

interface AlertServiceLogMeta {
  logLinkKind: AlertServiceLogKind;
  logLinkLabel: string;
  logLinkStatus: string;
  endpointName: string;
  canCreateAlert: boolean;
}

const emptyLogMeta: AlertServiceLogMeta = {
  logLinkKind: 'none',
  logLinkLabel: '未登记日志链路',
  logLinkStatus: '不可创建告警',
  endpointName: '-',
  canCreateAlert: false,
};

function serviceDisplayName(service: LogsServiceSummary) {
  return service.displayName || service.name || service.id;
}

function buildAlertServices(services: LogsServiceSummary[], rules: AlertRule[], routes: LogRouteView[], targets: LogTargetView[]): AlertServiceRow[] {
  const logLinks = buildServiceLogMeta(routes, targets);
  const rows = new Map<string, AlertServiceRow>();
  for (const service of services) {
    const logMeta = logLinks.get(service.id) ?? emptyLogMeta;
    rows.set(service.id, {
      id: service.id,
      name: serviceDisplayName(service),
      environment: service.environment,
      ownerTeam: service.ownerTeam,
      ruleCount: 0,
      enabledCount: 0,
      updatedAt: '',
      ...logMeta,
    });
  }
  for (const rule of rules) {
    const serviceId = rule.spec.scope.serviceId || 'unknown-service';
    const current = rows.get(serviceId) ?? {
      id: serviceId,
      name: rule.spec.scope.serviceName || serviceId,
      environment: '',
      ownerTeam: rule.spec.notification.ownerTeam,
      ruleCount: 0,
      enabledCount: 0,
      updatedAt: '',
      ...ruleLogMeta(rule),
    };
    const fallbackLogMeta = current.logLinkKind === 'none' ? ruleLogMeta(rule) : current;
    rows.set(serviceId, {
      ...current,
      name: current.name || rule.spec.scope.serviceName || serviceId,
      ownerTeam: current.ownerTeam || rule.spec.notification.ownerTeam,
      ruleCount: current.ruleCount + 1,
      enabledCount: current.enabledCount + (rule.state === 'enabled' ? 1 : 0),
      updatedAt: !current.updatedAt || rule.updatedAt > current.updatedAt ? rule.updatedAt : current.updatedAt,
      logLinkKind: fallbackLogMeta.logLinkKind,
      logLinkLabel: fallbackLogMeta.logLinkLabel,
      logLinkStatus: fallbackLogMeta.logLinkStatus,
      endpointName: fallbackLogMeta.endpointName,
      canCreateAlert: current.canCreateAlert,
    });
  }
  return Array.from(rows.values()).sort((left, right) => {
    if (right.ruleCount !== left.ruleCount) return right.ruleCount - left.ruleCount;
    return left.name.localeCompare(right.name, 'zh-CN');
  });
}

function buildServiceLogMeta(routes: LogRouteView[], targets: LogTargetView[]) {
  const rows = new Map<string, AlertServiceLogMeta>();
  const routesByService = new Map<string, LogRouteView[]>();
  for (const route of routes) {
    const items = routesByService.get(route.route.serviceId) ?? [];
    routesByService.set(route.route.serviceId, [...items, route]);
  }
  for (const target of targets) {
    if (target.target.status === 'disabled') continue;
    rows.set(target.target.serviceId, {
      logLinkKind: 'external',
      logLinkLabel: '纳管日志链路',
      logLinkStatus: linkStatusLabel(Boolean(target.endpoint), target.target.lastProbeStatus || target.target.status || target.endpoint?.status),
      endpointName: target.endpoint?.name || '-',
      canCreateAlert: Boolean(target.endpoint),
    });
  }
  for (const [serviceId, serviceRoutes] of routesByService.entries()) {
    if (rows.has(serviceId)) continue;
    const route = [...serviceRoutes].sort((left, right) => routeAccessPriority(left) - routeAccessPriority(right))[0];
    rows.set(serviceId, {
      logLinkKind: 'platform',
      logLinkLabel: '平台采集路由',
      logLinkStatus: linkStatusLabel(Boolean(route.endpoint), route.route.lastPublishStatus || route.route.status || route.endpoint?.status),
      endpointName: route.endpoint?.name || '-',
      canCreateAlert: Boolean(route.endpoint),
    });
  }
  return rows;
}

function ruleLogMeta(rule: AlertRule): AlertServiceLogMeta {
  if (rule.spec.scope.logTargetId) {
    return {
      logLinkKind: 'external',
      logLinkLabel: '纳管日志链路',
      logLinkStatus: rule.spec.scope.endpointId ? '规则绑定端点' : '未绑定端点',
      endpointName: rule.spec.scope.endpointId || '-',
      canCreateAlert: false,
    };
  }
  if (rule.spec.scope.logRouteId) {
    return {
      logLinkKind: 'platform',
      logLinkLabel: '平台采集路由',
      logLinkStatus: rule.spec.scope.endpointId ? '规则绑定端点' : '未绑定端点',
      endpointName: rule.spec.scope.endpointId || '-',
      canCreateAlert: false,
    };
  }
  return emptyLogMeta;
}

function linkStatusLabel(hasEndpoint: boolean, status = '') {
  if (!hasEndpoint) return '未绑定端点';
  const value = status.trim();
  if (!value) return '端点可用';
  if (['active', 'applied', 'enabled', 'healthy', 'published', 'ready', 'running', 'verified'].includes(value)) return '端点可用';
  if (value === 'pending_verification' || value === 'pending') return '待验证';
  if (value === 'disabled') return '已停用';
  if (value === 'failed' || value === 'blocked') return '链路异常';
  return value;
}

function serviceMetaLabel(service: AlertServiceRow | null) {
  if (!service) return '服务 · 日志链路 · 告警规则';
  const owner = service.environment || service.ownerTeam || '-';
  return `${owner} · ${service.logLinkLabel} · ${service.enabledCount}/${service.ruleCount}`;
}

export function LogsAlertsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { id: routeRuleId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [ruleQuery, setRuleQuery] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState(searchParams.get('service_id') ?? '');
  const { data: rules = [], error, refetch } = useQuery({
    queryKey: ['logs-alert-rules'],
    queryFn: api.getAlertRules,
  });
  const { data: workspace } = useQuery({
    queryKey: ['logs-onboarding-workspace'],
    queryFn: logsApi.getWorkspace,
  });
  const services = workspace?.services ?? [];
  const routes = workspace?.routes ?? [];
  const targets = workspace?.targets ?? [];
  const alertServices = useMemo(() => buildAlertServices(services, rules, routes, targets), [routes, rules, services, targets]);
  const selectedService = alertServices.find((item) => item.id === selectedServiceId) ?? alertServices[0] ?? null;
  const selectedServiceRules = useMemo(() => {
    if (!selectedService) return [];
    return rules.filter((rule) => (rule.spec.scope.serviceId || 'unknown-service') === selectedService.id);
  }, [rules, selectedService]);
  const filteredRules = useMemo(() => {
    const query = ruleQuery.trim().toLowerCase();
    if (!query) return selectedServiceRules;
    return selectedServiceRules.filter((rule) => [
      rule.spec.name,
      rule.id,
      rule.spec.query.expression,
      rule.spec.notification.ownerTeam,
      rule.spec.notification.severity,
    ].filter(Boolean).join(' ').toLowerCase().includes(query));
  }, [ruleQuery, selectedServiceRules]);

  useEffect(() => {
    const paramServiceId = searchParams.get('service_id') ?? '';
    if (alertServices.length === 0) {
      if (selectedServiceId) setSelectedServiceId('');
      return;
    }
    const paramService = alertServices.find((service) => service.id === paramServiceId);
    if (paramService) {
      if (selectedServiceId !== paramService.id) setSelectedServiceId(paramService.id);
      return;
    }
    const fallbackServiceId = alertServices.some((service) => service.id === selectedServiceId) ? selectedServiceId : alertServices[0].id;
    if (selectedServiceId !== fallbackServiceId) setSelectedServiceId(fallbackServiceId);
    const next = new URLSearchParams(searchParams);
    next.set('service_id', fallbackServiceId);
    setSearchParams(next, { replace: true });
  }, [alertServices, searchParams, selectedServiceId, setSearchParams]);

  function selectService(serviceId: string) {
    setSelectedServiceId(serviceId);
    const next = new URLSearchParams(searchParams);
    next.set('service_id', serviceId);
    setSearchParams(next, { replace: true });
  }

  const editorRuleId = location.pathname.endsWith('/new') ? '' : routeRuleId;
  const editorOpen = location.pathname.endsWith('/new') || Boolean(routeRuleId);
  const createAlertTo = selectedServiceId ? `/logs/alerts/new?service_id=${encodeURIComponent(selectedServiceId)}` : '/logs/alerts/new';
  const closeEditorTo = selectedServiceId ? `/logs/alerts?service_id=${encodeURIComponent(selectedServiceId)}` : '/logs/alerts';
  const createDisabled = !selectedService?.canCreateAlert;

  return (
    <div className="logs-alerts-workbench console-workbench flex min-h-0 flex-col">
      <section className="console-panel flex min-h-0 flex-1 flex-col overflow-hidden">
        {error ? <ErrorLine message={(error as Error).message} /> : null}
        <div className="console-panel-header shrink-0">
          <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="logs-alert-service-selector w-full lg:max-w-[420px]">
              <AlertServiceSelector services={alertServices} activeService={selectedService} onSelect={selectService} />
            </div>
            <div className="flex w-full flex-wrap items-center justify-end gap-2 md:w-auto">
              <label className="relative w-full md:w-80">
                <span className="sr-only">搜索告警规则</span>
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                <input className="console-input h-9 w-full pl-8 text-sm" value={ruleQuery} onChange={(event) => setRuleQuery(event.target.value)} placeholder="搜索告警规则" />
              </label>
              <button className="console-button" onClick={() => refetch()}><RefreshCw className="h-3.5 w-3.5" />刷新</button>
              {createDisabled ? (
                <button className="console-button console-button-primary" disabled title={selectedService ? '当前服务没有可用于告警的日志链路' : '请先选择服务'}><Plus className="h-3.5 w-3.5" />创建告警</button>
              ) : (
                <Link className="console-button console-button-primary" to={createAlertTo}><Plus className="h-3.5 w-3.5" />创建告警</Link>
              )}
            </div>
          </div>
        </div>
        {!selectedService ? (
          <LogsEmptyState title="暂无可选服务" />
        ) : selectedServiceRules.length === 0 ? (
          <LogsEmptyState
            title="当前服务暂无日志告警"
            description={selectedService.canCreateAlert ? '可以基于当前服务日志链路创建告警规则。' : '当前服务没有可用于告警的日志链路。'}
            action={selectedService.canCreateAlert ? <Link className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-semibold text-white" to={createAlertTo}>创建告警</Link> : undefined}
          />
        ) : filteredRules.length === 0 ? (
          <LogsEmptyState title="未找到匹配的告警规则" description="请调整搜索关键字。" />
        ) : (
          <div className="console-resource-list min-w-0 flex-1">
            <table className="console-table logs-alert-rules-table min-w-[960px] w-full">
              <thead className="[&>tr>th]:text-[13px] [&>tr>th]:font-semibold">
                <tr>
                  <th>名称</th>
                  <th>级别</th>
                  <th>窗口</th>
                  <th>通知策略</th>
                  <th>状态</th>
                  <th>查询</th>
                  <th>动作</th>
                </tr>
              </thead>
              <tbody className="[&>tr>td]:text-[11px]">
                {filteredRules.map((rule) => (
                  <tr
                    key={rule.id}
                    className="bg-surface-lowest hover:bg-surface-low"
                  >
                    <td>
                      <div className="font-semibold text-on-surface">{rule.spec.name}</div>
                      <div className="font-mono text-[11px] text-muted">{rule.id}</div>
                    </td>
                    <td>{rule.spec.notification.severity}</td>
                    <td className="font-mono text-xs">{rule.spec.trigger.window || '-'}</td>
                    <td>{rule.spec.notification.policyId || '-'}</td>
                    <td>
                      <div className="flex flex-wrap gap-1.5">
                        <StatusBadge value={rule.state} />
                        <StatusBadge value={rule.applyStatus} />
                      </div>
                    </td>
                    <td className="max-w-[420px] truncate font-mono text-xs text-muted">{rule.spec.query.expression}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Link className="console-table-action" to={`/logs/alerts/${rule.id}?service_id=${encodeURIComponent(selectedService.id)}`}>编辑</Link>
                        <Link className="console-table-action" to="/alerts"><ExternalLink className="h-3.5 w-3.5" />告警中心</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editorOpen ? (
        <LogsAlertRuleEditorDrawer ruleId={editorRuleId} onClose={() => navigate(closeEditorTo)} />
      ) : null}
    </div>
  );
}

function AlertServiceSelector({ services, activeService, onSelect }: {
  services: AlertServiceRow[];
  activeService: AlertServiceRow | null;
  onSelect: (serviceId: string) => void;
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
      const estimatedHeight = Math.min(Math.max(services.length, 1) * 66 + 8, 320);
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
  }, [open, services.length]);

  return (
    <div className="rounded-md">
      <button
        ref={triggerRef}
        type="button"
        className="flex h-12 w-full items-center gap-3 rounded-md border border-outline/80 bg-white px-3 text-left shadow-[0_2px_6px_rgba(24,52,96,0.06)] transition-colors hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={services.length === 0}
        onClick={() => setOpen((value) => !value)}
      >
        {activeService?.logLinkKind === 'platform' ? <Route className="h-4 w-4 shrink-0 text-primary" /> : <Server className="h-4 w-4 shrink-0 text-primary" />}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-on-surface">{activeService?.name || '选择服务'}</div>
          <div className="mt-1 truncate font-mono text-[11px] text-muted">{serviceMetaLabel(activeService)}</div>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && typeof document !== 'undefined' ? createPortal((
        <>
          <button type="button" className="fixed inset-0 z-40 cursor-default border-0 bg-transparent" aria-label="关闭服务选择" onClick={() => setOpen(false)} />
          <div className="fixed z-50 max-h-80 overflow-y-auto rounded-md border border-outline bg-white p-1 shadow-[0_14px_36px_rgba(24,52,96,0.2)]" style={popoverStyle} role="listbox" aria-label="日志告警服务">
            {services.map((service) => {
              const selected = service.id === activeService?.id;
              return (
                <button
                  key={service.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`w-full rounded px-3 py-2.5 text-left transition-colors ${selected ? 'bg-primary-soft/70' : 'hover:bg-surface-low'}`}
                  onClick={() => {
                    onSelect(service.id);
                    setOpen(false);
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className={`truncate text-sm font-semibold ${selected ? 'text-primary' : 'text-on-surface'}`}>{service.name}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="font-mono text-[11px] text-muted">{service.enabledCount}/{service.ruleCount}</span>
                      {selected ? <Check className="h-4 w-4 text-primary" /> : null}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-[11px] font-medium text-muted">{service.environment || service.ownerTeam || '-'} · {service.logLinkLabel} · {service.logLinkStatus}</div>
                  <div className="mt-1 truncate font-mono text-[10px] text-muted/80">{service.endpointName}</div>
                </button>
              );
            })}
          </div>
        </>
      ), document.body) : null}
    </div>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <div className="m-3 flex items-center gap-2 rounded border border-red-500/30 bg-red-50 px-3 py-2 text-sm text-red-600">
      <XCircle className="h-4 w-4" />{message}
    </div>
  );
}
