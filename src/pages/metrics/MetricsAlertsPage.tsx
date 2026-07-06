import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import type { AlertRule } from '../../services/types';

export function MetricsAlertsPage() {
  const rulesQuery = useQuery({
    queryKey: ['metrics-alert-rules'],
    queryFn: () => api.getMetricsAlertRules(),
    retry: false,
  });
  const rules = useMemo(() => rulesQuery.data ?? [], [rulesQuery.data]);
  const enabledCount = rules.filter((rule) => rule.state === 'enabled').length;

  return (
    <div className="space-y-3">
      <section className="console-panel overflow-hidden">
        <div className="console-panel-header">
          <div className="min-w-0">
            <h2 className="console-section-title">指标告警</h2>
            <p className="console-section-meta">共 {rules.length} 条 · 启用 {enabledCount} 条</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="console-icon-button border-outline bg-white" aria-label="刷新指标告警" title="刷新指标告警" onClick={() => void rulesQuery.refetch()}>
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="console-panel-body">
          {rulesQuery.error ? <div className="console-notice console-notice-danger mb-3">{(rulesQuery.error as Error).message}</div> : null}
          {rulesQuery.isLoading ? (
            <div className="grid gap-2">
              <div className="console-skeleton h-10" />
              <div className="console-skeleton h-10" />
              <div className="console-skeleton h-10" />
            </div>
          ) : rules.length === 0 ? (
            <div className="console-empty-state min-h-[360px]">
              <Bell className="h-5 w-5 text-muted/80" />
              <div className="text-sm font-semibold text-on-surface">暂无指标告警规则</div>
              <div className="max-w-md text-xs leading-5 text-muted">后端指标告警闭环已接入；创建表单完成后会从服务作用域带入 metrics binding。</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="console-table w-full min-w-[920px]">
                <thead>
                  <tr>
                    <th>规则</th>
                    <th>服务</th>
                    <th>查询</th>
                    <th>阈值</th>
                    <th>状态</th>
                    <th>最近更新</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <MetricAlertRuleRow key={rule.id} rule={rule} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function MetricAlertRuleRow({ rule }: { rule: AlertRule }) {
  const serviceLabel = rule.spec.scope.serviceName || rule.spec.scope.serviceId || '-';
  const bindingLabel = rule.spec.scope.metricsBindingId || '-';
  const tenantLabel = rule.spec.scope.accountId || rule.spec.scope.projectId ? `${rule.spec.scope.accountId || '0'}:${rule.spec.scope.projectId || '0'}` : '-';
  return (
    <tr>
      <td>
        <div className="min-w-0">
          <div className="font-semibold text-on-surface">{rule.spec.name || rule.id}</div>
          <div className="mt-1 truncate text-[11px] text-muted">{rule.id}</div>
        </div>
      </td>
      <td>
        <div className="font-semibold text-on-surface">{serviceLabel}</div>
        <div className="mt-1 truncate font-mono text-[11px] text-muted">binding={bindingLabel}</div>
        <div className="mt-1 truncate font-mono text-[11px] text-muted">tenant={tenantLabel}</div>
      </td>
      <td className="max-w-[340px]">
        <div className="truncate font-mono text-xs text-on-surface">{rule.spec.query.expression || '-'}</div>
        <div className="mt-1 text-[11px] text-muted">{rule.spec.query.mode}</div>
        <div className="mt-1 truncate font-mono text-[11px] text-muted">{rule.spec.scope.basePromQL || '-'}</div>
      </td>
      <td className="font-mono text-xs">{thresholdLabel(rule)}</td>
      <td>
        <div className="flex flex-col gap-1">
          <span className={`status-badge ${stateTone(rule.state)}`}>
            <span className="status-dot" aria-hidden />
            {rule.state}
          </span>
          <span className={`status-badge ${applyTone(rule.applyStatus)}`}>
            <span className="status-dot" aria-hidden />
            {rule.applyStatus}
          </span>
        </div>
      </td>
      <td className="whitespace-nowrap text-xs text-muted">{formatDateTime(rule.updatedAt || rule.createdAt)}</td>
    </tr>
  );
}

function thresholdLabel(rule: AlertRule) {
  const operator = rule.spec.trigger.operator === 'gt' ? '>' : '>=';
  return `${operator} ${rule.spec.trigger.threshold}`;
}

function stateTone(state: AlertRule['state']) {
  if (state === 'enabled') return 'border-emerald-600/20 bg-emerald-50 text-emerald-700';
  return 'border-outline bg-surface-lowest text-muted';
}

function applyTone(status: AlertRule['applyStatus']) {
  if (status === 'applied') return 'border-emerald-600/20 bg-emerald-50 text-emerald-700';
  if (status === 'failed') return 'border-danger/20 bg-red-50 text-danger';
  if (status === 'publishing' || status === 'pending') return 'border-warning/25 bg-amber-50 text-warning';
  return 'border-outline bg-surface-lowest text-muted';
}

function formatDateTime(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}
