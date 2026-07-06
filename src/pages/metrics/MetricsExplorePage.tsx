import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, Database, RefreshCw, Server } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { metricsApi, type MetricsServiceSummary } from './api';

function serviceDisplayName(service?: MetricsServiceSummary | null) {
  return service?.displayName || service?.name || service?.id || '-';
}

function formatLabelMatch(labelMatch: Record<string, string>) {
  const entries = Object.entries(labelMatch);
  if (!entries.length) return '-';
  return entries.map(([key, value]) => `${key}=${value}`).join(', ');
}

function statusTone(status: string) {
  if (['active', 'healthy', 'verified', 'ready'].includes(status)) return 'border-emerald-600/20 bg-emerald-50 text-emerald-700';
  if (['failed', 'error', 'blocked'].includes(status)) return 'border-danger/20 bg-red-50 text-danger';
  if (['pending', 'pending_verification', 'warning', 'degraded'].includes(status)) return 'border-warning/25 bg-amber-50 text-warning';
  return 'border-outline bg-surface-lowest text-muted';
}

export function MetricsExplorePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [serviceId, setServiceId] = useState(searchParams.get('service_id') ?? '');
  const { data: workspace, error, isLoading, refetch } = useQuery({
    queryKey: ['metrics-workspace', serviceId],
    queryFn: () => metricsApi.getWorkspace(serviceId || undefined),
    retry: false,
  });
  const services = workspace?.services ?? [];
  const endpoints = workspace?.endpoints ?? [];
  const bindings = workspace?.serviceBindings ?? [];
  const endpointById = useMemo(() => new Map(endpoints.map((endpoint) => [endpoint.id, endpoint])), [endpoints]);
  const bindingByServiceId = useMemo(() => new Map(bindings.map((binding) => [binding.serviceId, binding])), [bindings]);
  const activeService = services.find((service) => service.id === serviceId) ?? services.find((service) => service.id === workspace?.activeServiceId) ?? services[0] ?? null;
  const activeBinding = activeService ? bindingByServiceId.get(activeService.id) ?? null : null;
  const activeEndpoint = activeBinding ? endpointById.get(activeBinding.endpointId) ?? null : null;
  const selectedServiceId = activeService?.id ?? '';
  const activeTenant = activeBinding ? `${activeBinding.accountId || activeEndpoint?.accountId || '0'}:${activeBinding.projectId || activeEndpoint?.projectId || '0'}` : '-';

  useEffect(() => {
    const nextServiceId = workspace?.activeServiceId || activeService?.id || '';
    if (!nextServiceId || serviceId === nextServiceId) return;
    setServiceId(nextServiceId);
  }, [activeService, serviceId, workspace?.activeServiceId]);

  function selectService(nextServiceId: string) {
    setServiceId(nextServiceId);
    if (nextServiceId) {
      setSearchParams({ service_id: nextServiceId }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }

  return (
    <div className="metrics-explore-workbench grid min-h-[720px] gap-3 xl:h-full xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_320px] xl:overflow-hidden">
      <section className="console-panel flex min-h-0 flex-col overflow-hidden" aria-label="Metrics Explore 工作区">
        <div className="console-panel-header shrink-0">
          <div className="min-w-0">
            <h2 className="console-section-title">服务选择</h2>
            <p className="console-section-meta">service_id={selectedServiceId || '-'}</p>
          </div>
          <button type="button" className="console-icon-button border-outline bg-white" aria-label="刷新指标工作区" title="刷新指标工作区" onClick={() => void refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        {error ? <ErrorLine message={(error as Error).message} /> : null}

        <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)]">
          <div className="border-b border-outline/70 bg-surface-low/70 px-3 py-3">
            <div className="grid gap-3 lg:grid-cols-[minmax(260px,360px)_minmax(0,1fr)]">
              <label className="console-field">
                <span className="console-field-label">服务</span>
                <select
                  className="console-input w-full"
                  value={selectedServiceId}
                  disabled={isLoading || services.length === 0}
                  onChange={(event) => selectService(event.target.value)}
                >
                  {services.length === 0 ? <option value="">暂无服务</option> : null}
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>{serviceDisplayName(service)}</option>
                  ))}
                </select>
                <span className="console-field-help">按服务真值选择指标作用域，不在前端伪造服务。</span>
              </label>

              <div className="grid gap-2 sm:grid-cols-3">
                <MetricFact label="当前绑定" value={activeBinding?.id ?? '-'} tone={activeBinding ? 'primary' : undefined} />
                <MetricFact label="endpoint" value={activeEndpoint?.name ?? activeBinding?.endpointId ?? '-'} tone={activeEndpoint ? 'primary' : undefined} />
                <MetricFact label="labelMatch" value={activeBinding ? formatLabelMatch(activeBinding.labelMatch) : '-'} mono />
              </div>
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto p-3">
            {isLoading ? (
              <div className="grid gap-2">
                <div className="console-skeleton h-10" />
                <div className="console-skeleton h-28" />
              </div>
            ) : !activeService ? (
              <EmptyMetricsState title="暂无可选择服务" description="服务目录返回数据后，Metrics Explore 会按服务展示指标作用域。" />
            ) : !activeBinding ? (
              <EmptyMetricsState
                title="尚未绑定指标端点"
                description="下一步：进入指标采集，为当前服务绑定 VictoriaMetrics 端点并登记 labelMatch。"
                action={<Link className="console-button console-button-primary" to="/metrics/collection">进入指标采集</Link>}
              />
            ) : (
              <div className="grid gap-3">
                <section className="rounded-md border border-outline bg-surface-lowest">
                  <div className="border-b border-outline/70 px-3 py-2 text-xs font-semibold text-on-surface">当前服务指标作用域</div>
                  <div className="grid divide-y divide-outline/60 md:grid-cols-2 md:divide-x md:divide-y-0">
                    <ScopeCell label="服务" value={serviceDisplayName(activeService)} />
                    <ScopeCell label="绑定状态" value={activeBinding.status || '-'} badgeClass={statusTone(activeBinding.status)} />
                    <ScopeCell label="指标端点" value={activeEndpoint?.name || activeBinding.endpointId || '-'} />
                    <ScopeCell label="labelMatch" value={formatLabelMatch(activeBinding.labelMatch)} mono />
                    <ScopeCell label="basePromQL" value={activeBinding.basePromQL || '-'} mono />
                    <ScopeCell label="租户" value={activeTenant} mono />
                  </div>
                </section>

                <section className="overflow-hidden rounded-md border border-outline bg-surface-lowest">
                  <div className="border-b border-outline/70 px-3 py-2 text-xs font-semibold text-on-surface">端点状态</div>
                  <table className="console-table w-full min-w-[720px]">
                    <thead>
                      <tr>
                        <th>端点</th>
                        <th>类型</th>
                        <th>查询地址</th>
                        <th>租户</th>
                        <th>探测</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="font-semibold">{activeEndpoint?.name || '-'}</td>
                        <td>{activeEndpoint?.endpointType || '-'}</td>
                        <td className="max-w-[320px] truncate font-mono text-xs">{activeEndpoint?.queryURL || '-'}</td>
                        <td className="font-mono text-xs">{activeTenant}</td>
                        <td>
                          <span className={`status-badge ${statusTone(activeBinding.lastProbeStatus || activeBinding.status)}`}>
                            <span className="status-dot" aria-hidden />
                            {activeBinding.lastProbeStatus || activeBinding.status || '-'}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </section>
              </div>
            )}
          </div>
        </div>
      </section>

      <aside className="console-panel flex min-h-0 flex-col overflow-hidden" aria-label="Metrics Explore 详情">
        <div className="console-panel-header shrink-0">
          <div className="min-w-0">
            <h2 className="console-section-title">详情</h2>
            <p className="console-section-meta">service scope</p>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <DetailRow icon={Server} label="服务" value={activeService ? serviceDisplayName(activeService) : '-'} />
          <DetailRow icon={Database} label="Endpoint" value={activeEndpoint?.name || '-'} />
          <DetailRow label="Label Match" value={activeBinding ? formatLabelMatch(activeBinding.labelMatch) : '-'} mono />
          <DetailRow label="Base PromQL" value={activeBinding?.basePromQL || '-'} mono />
          <DetailRow label="租户" value={activeTenant} mono />
          <DetailRow label="最近探测" value={activeBinding?.lastProbeAt || '-'} mono />
          <div className="border-t border-outline/70 p-3">
            <button
              type="button"
              className="console-button w-full"
              disabled
              title="指标告警创建表单接入中"
            >
              <Bell className="h-3.5 w-3.5" />
              创建指标告警
            </button>
            <p className="mt-2 text-[11px] leading-5 text-muted">创建表单接入后，将从当前服务作用域带入 labelMatch 与 metrics binding。</p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function MetricFact({ label, value, mono, tone }: { label: string; value: string; mono?: boolean; tone?: 'primary' }) {
  return (
    <div className="min-w-0 rounded-md border border-outline bg-surface-lowest px-3 py-2">
      <div className="text-[11px] font-semibold text-muted">{label}</div>
      <div className={`mt-1 truncate text-sm font-semibold ${mono ? 'font-mono text-xs' : ''} ${tone === 'primary' ? 'text-primary' : 'text-on-surface'}`}>{value}</div>
    </div>
  );
}

function ScopeCell({ label, value, mono, badgeClass }: { label: string; value: string; mono?: boolean; badgeClass?: string }) {
  return (
    <div className="min-w-0 px-3 py-3">
      <div className="text-[11px] font-semibold text-muted">{label}</div>
      {badgeClass ? (
        <span className={`status-badge mt-1 ${badgeClass}`}><span className="status-dot" aria-hidden />{value}</span>
      ) : (
        <div className={`mt-1 break-words text-sm font-semibold text-on-surface ${mono ? 'font-mono text-xs' : ''}`}>{value}</div>
      )}
    </div>
  );
}

function DetailRow({ icon: Icon, label, value, mono }: { icon?: LucideIcon; label: string; value: string; mono?: boolean }) {
  return (
    <div className="border-b border-outline/70 px-3 py-3">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-muted">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        {label}
      </div>
      <div className={`mt-1 break-words text-sm font-semibold text-on-surface ${mono ? 'font-mono text-xs' : ''}`}>{value}</div>
    </div>
  );
}

function EmptyMetricsState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="console-empty-state min-h-[360px]">
      <div className="text-sm font-semibold text-on-surface">{title}</div>
      <div className="max-w-md text-xs leading-5 text-muted">{description}</div>
      {action ?? null}
    </div>
  );
}

function ErrorLine({ message }: { message: string }) {
  return <div className="console-notice console-notice-danger m-3 mb-0">{message}</div>;
}
