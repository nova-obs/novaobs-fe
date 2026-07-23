import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { api } from '../../services/api';
import type { AlertRule, Service } from '../../services/types';

export function OverviewPage() {
  const overviewQuery = useQuery({ queryKey: ['overview'], queryFn: api.getOverview });
  const servicesQuery = useQuery({ queryKey: ['overview-services'], queryFn: () => api.getServices() });
  const alertRulesQuery = useQuery({ queryKey: ['overview-alert-rules'], queryFn: () => api.getAlertRules() });
  const services = servicesQuery.data ?? [];
  const alertRules = alertRulesQuery.data ?? [];
  const overview = overviewQuery.data;
  const logThroughput = overview?.logThroughputPerMinute ?? 0;
  const healthyLogRouteCount = overview?.healthyLogRouteCount ?? 0;
  const activeAlertCount = overview?.activeAlertCount || alertRules.filter((rule) => rule.state === 'enabled').length;

  const componentStates = [
    { name: '日志下游', source: 'logs', status: logThroughput > 0 ? 'active' : 'unknown' },
    { name: 'OTel Collector', source: 'agent', status: healthyLogRouteCount > 0 ? 'active' : 'unknown' },
    { name: 'Alert Ingest', source: 'alerts', status: activeAlertCount > 0 ? 'active' : 'unknown' },
    { name: 'OpAMP', source: 'remote config', status: healthyLogRouteCount > 0 ? 'active' : 'unknown' },
  ];

  return (
    <div className="space-y-4">
      <div className="page-header"><h1 className="page-title">平台总览</h1></div>

      {(overviewQuery.error || servicesQuery.error || alertRulesQuery.error) ? (
        <DataPanel title="数据读取异常">
          <div className="grid gap-2 text-sm text-warning">
            {overviewQuery.error ? <div>概览接口：{errorMessage(overviewQuery.error)}</div> : null}
            {servicesQuery.error ? <div>服务目录：{errorMessage(servicesQuery.error)}</div> : null}
            {alertRulesQuery.error ? <div>告警规则：{errorMessage(alertRulesQuery.error)}</div> : null}
          </div>
        </DataPanel>
      ) : null}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <DataPanel title="服务目录快照" meta={servicesQuery.isLoading ? '加载中' : undefined}>
          {servicesQuery.isLoading ? (
            <div className="console-empty-state text-sm font-semibold text-muted">正在读取服务目录</div>
          ) : services.length === 0 ? (
            <div className="console-empty-state text-sm font-semibold text-muted">服务目录为空</div>
          ) : (
            <div className="overflow-auto">
              <table className="console-table min-w-[900px] w-full">
                <thead>
                  <tr>
                    <th>服务</th>
                    <th>服务 Key</th>
                    <th>产品 ID</th>
                    <th>Owner</th>
                    <th>来源</th>
                    <th>同步</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {services.slice(0, 10).map((service) => (
                    <tr key={service.id} className="bg-white/35 hover:bg-white/60">
                      <td>
                        <div className="font-semibold text-primary">{service.name}</div>
                        <div className="text-[11px] text-muted">{service.description || '-'}</div>
                      </td>
                      <td className="font-mono text-xs">{service.key || '-'}</td>
                      <td className="font-mono text-xs">{service.productId || '-'}</td>
                      <td className="text-xs text-muted">{serviceOwner(service)}</td>
                      <td className="text-xs text-muted">{sourceLabel(service.source)}</td>
                      <td><StateChip value={syncLabel(service.syncStatus)} /></td>
                      <td><StateChip value={service.status || 'unknown'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DataPanel>

        <DataPanel title="观测链路">
          <div className="space-y-2">
            {componentStates.map((item) => (
              <ComponentLine key={item.name} name={item.name} source={item.source} status={item.status} />
            ))}
          </div>
        </DataPanel>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <DataPanel title="告警规则" meta={alertRulesQuery.isLoading ? '加载中' : undefined}>
          {alertRulesQuery.isLoading ? (
            <div className="console-empty-state text-sm font-semibold text-muted">正在读取告警规则</div>
          ) : alertRules.length === 0 ? (
            <div className="console-empty-state text-sm font-semibold text-muted">告警规则为空</div>
          ) : (
            <div className="overflow-auto">
              <table className="console-table min-w-[760px] w-full">
                <thead>
                  <tr>
                    <th>规则</th>
                    <th>来源</th>
                    <th>窗口</th>
                    <th>级别</th>
                    <th>Owner</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {alertRules.slice(0, 8).map((rule) => (
                    <AlertRuleRow key={rule.id} rule={rule} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DataPanel>

      </div>
    </div>
  );
}

function ComponentLine({ name, source, status }: { name: string; source: string; status: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-outline bg-surface px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-on-surface">{name}</div>
        <div className="mt-0.5 text-[11px] text-muted">{source}</div>
      </div>
      <span className={`status-badge ${status === 'active' ? 'border-emerald-600/20 bg-emerald-50 text-emerald-700' : 'border-outline bg-white text-muted'}`}>
        <span className="status-dot" aria-hidden />
        <ShieldCheck className="h-3 w-3" />
        {status}
      </span>
    </div>
  );
}

function AlertRuleRow({ rule }: { rule: AlertRule }) {
  return (
    <tr className="bg-white/35 hover:bg-white/60">
      <td>
        <div className="font-semibold text-primary">{rule.spec.name}</div>
        <div className="max-w-[320px] truncate font-mono text-[11px] text-muted">{rule.spec.query.expression || '-'}</div>
      </td>
      <td className="font-mono text-xs">logs</td>
      <td className="font-mono text-xs">{rule.spec.trigger.window || '-'}</td>
      <td><StateChip value={rule.spec.notification.severity} /></td>
      <td className="text-xs text-muted">{rule.spec.notification.ownerTeam || '-'}</td>
      <td><StateChip value={rule.state} /></td>
    </tr>
  );
}

function StateChip({ value }: { value: string }) {
  const warning = ['degraded', 'warning', 'failed', 'critical', 'high'].includes(value);
  const active = ['active', 'synced', 'enabled', 'low', 'medium'].includes(value);
  return (
    <span className={`status-badge ${warning ? 'border-warning/20 bg-amber-50 text-warning' : active ? 'border-emerald-600/20 bg-emerald-50 text-emerald-700' : 'border-outline bg-surface text-muted'}`}>
      <span className="status-dot" aria-hidden />
      {value || 'unknown'}
    </span>
  );
}

function serviceOwner(service: Service) {
  return [service.ownerTeam, service.owner].filter(Boolean).join(' · ') || '-';
}

function sourceLabel(source: string) {
  if (source === 'k8s') return 'K8s';
  if (source === 'cmdb') return 'CMDB';
  return 'manual';
}

function syncLabel(status: string) {
  return status === 'synced' ? 'synced' : status || 'local';
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : 'request failed';
}
