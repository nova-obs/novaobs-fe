import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { RadioTower, RefreshCw } from 'lucide-react';
import { metricsApi } from './api';

function formatLabelMatch(labelMatch: Record<string, string>) {
  const entries = Object.entries(labelMatch);
  if (!entries.length) return '-';
  return entries.map(([key, value]) => `${key}=${value}`).join(', ');
}

function statusClass(status: string) {
  if (['active', 'verified', 'healthy'].includes(status)) return 'border-emerald-600/20 bg-emerald-50 text-emerald-700';
  if (['failed', 'error', 'blocked'].includes(status)) return 'border-danger/20 bg-red-50 text-danger';
  if (['pending', 'pending_verification', 'warning'].includes(status)) return 'border-warning/25 bg-amber-50 text-warning';
  return 'border-outline bg-surface-lowest text-muted';
}

export function MetricsCollectionPage() {
  const { data: bindings = [], error, isLoading, refetch } = useQuery({
    queryKey: ['metrics-service-bindings'],
    queryFn: () => metricsApi.listServiceBindings(),
    retry: false,
  });

  return (
    <div className="space-y-3">
      <section className="console-panel overflow-hidden">
        <div className="console-panel-header">
          <div className="min-w-0">
            <h2 className="console-section-title">采集接入</h2>
            <p className="console-section-meta">service bindings</p>
          </div>
          <button type="button" className="console-icon-button border-outline bg-white" aria-label="刷新指标绑定" title="刷新指标绑定" onClick={() => void refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
        {error ? <div className="console-notice console-notice-danger m-3 mb-0">{(error as Error).message}</div> : null}
        <div className="console-panel-body">
          <div className="overflow-auto">
            <table className="console-table w-full min-w-[760px]">
              <thead>
                <tr>
                  <th>服务</th>
                  <th>指标端点</th>
                  <th>labelMatch</th>
                  <th>状态</th>
                  <th>最近探测</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5}><div className="console-skeleton h-10" /></td>
                  </tr>
                ) : bindings.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="console-empty-state my-2 min-h-[280px]">
                        <RadioTower className="h-5 w-5 text-muted/80" />
                        <div className="text-sm font-semibold text-on-surface">暂无服务指标绑定</div>
                        <div className="max-w-md text-xs leading-5 text-muted">先在接入端点确认 VictoriaMetrics 端点，再为服务建立 labelMatch 绑定。</div>
                        <div className="flex flex-wrap gap-2">
                          <Link className="console-button" to="/metrics/endpoints">查看接入端点</Link>
                          <Link className="console-button" to="/metrics/explore">返回指标查询</Link>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : bindings.map((binding) => (
                  <tr key={binding.id}>
                    <td className="font-mono text-xs">{binding.serviceId || '-'}</td>
                    <td className="font-mono text-xs">{binding.endpointId || '-'}</td>
                    <td className="max-w-[360px] truncate font-mono text-xs">{formatLabelMatch(binding.labelMatch)}</td>
                    <td>
                      <span className={`status-badge ${statusClass(binding.status)}`}>
                        <span className="status-dot" aria-hidden />
                        {binding.status || '-'}
                      </span>
                    </td>
                    <td className="font-mono text-xs">{binding.lastProbeAt || binding.updatedAt || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
