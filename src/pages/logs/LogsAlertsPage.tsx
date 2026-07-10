import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Plus, RefreshCw, Search } from 'lucide-react';
import { StatusBadge } from '../../components/StatusBadge';
import type { AlertRule } from '../../services/types';
import { api } from '../../services/api';
import { LogsAlertRuleEditorDrawer } from './LogsAlertRulePage';
import { LogsEmptyState, LogsErrorLine } from './LogsPrimitives';
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
	const { productId = '', serviceId = '', id: routeRuleId = '' } = useParams();
	const base = `/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}/logs`;
  const [ruleQuery, setRuleQuery] = useState('');
  const { data: rules = [], error, refetch } = useQuery({
    queryKey: ['logs-alert-rules'],
    queryFn: api.getAlertRules,
  });
  const { data: workspace } = useQuery({
	queryKey: ['logs-onboarding-workspace', productId, serviceId],
	queryFn: () => logsApi.getWorkspace(productId, serviceId),
	enabled: Boolean(productId && serviceId),
  });
  const services = workspace?.services ?? [];
  const routes = workspace?.routes ?? [];
  const targets = workspace?.targets ?? [];
  const alertServices = useMemo(() => buildAlertServices(services, rules, routes, targets), [routes, rules, services, targets]);
  const selectedService = alertServices.find((item) => item.id === serviceId) ?? null;
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

  const editorRuleId = location.pathname.endsWith('/new') ? '' : routeRuleId;
  const editorOpen = location.pathname.endsWith('/new') || Boolean(routeRuleId);
	const createAlertTo = `${base}/alerts/new`;
	const closeEditorTo = `${base}/alerts`;
  const createDisabled = !selectedService?.canCreateAlert;

  return (
    <div className="logs-alerts-workbench console-workbench flex min-h-0 flex-col">
      <section className="console-panel flex min-h-0 flex-1 flex-col overflow-hidden">
        {error ? <LogsErrorLine message={(error as Error).message} /> : null}
        <div className="console-panel-header shrink-0">
          <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="logs-alert-service-selector w-full lg:max-w-[420px]">
			  <div className="rounded-md border border-outline bg-white px-3 py-2">
				<div className="truncate text-sm font-semibold text-on-surface">{selectedService?.name || '服务不存在'}</div>
				<div className="mt-1 truncate text-[11px] text-muted">{serviceMetaLabel(selectedService)}</div>
			  </div>
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
						<Link className="console-table-action" to={`${base}/alerts/${rule.id}`}>编辑</Link>
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
		<LogsAlertRuleEditorDrawer productId={productId} serviceId={serviceId} ruleId={editorRuleId} onClose={() => navigate(closeEditorTo)} />
      ) : null}
    </div>
  );
}
