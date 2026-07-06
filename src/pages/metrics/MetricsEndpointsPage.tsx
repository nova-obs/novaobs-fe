import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Database, RefreshCw } from 'lucide-react';
import { metricsApi } from './api';

function endpointURL(endpoint: { queryURL: string; remoteWriteURL: string; vmuiURL: string }) {
  return endpoint.queryURL || endpoint.remoteWriteURL || endpoint.vmuiURL || '-';
}

function statusClass(status: string) {
  if (['active', 'healthy', 'verified'].includes(status)) return 'border-emerald-600/20 bg-emerald-50 text-emerald-700';
  if (['failed', 'error', 'disabled'].includes(status)) return 'border-danger/20 bg-red-50 text-danger';
  if (['pending', 'pending_verification'].includes(status)) return 'border-warning/25 bg-amber-50 text-warning';
  return 'border-outline bg-surface-lowest text-muted';
}

export function MetricsEndpointsPage() {
  const { data: endpoints = [], error, isLoading, refetch } = useQuery({
    queryKey: ['metrics-endpoints'],
    queryFn: metricsApi.listEndpoints,
    retry: false,
  });

  return (
    <div className="space-y-3">
      <section className="console-panel overflow-hidden">
        <div className="console-panel-header">
          <div className="min-w-0">
            <h2 className="console-section-title">接入端点</h2>
            <p className="console-section-meta">victoriametrics endpoints</p>
          </div>
          <button type="button" className="console-icon-button border-outline bg-white" aria-label="刷新指标端点" title="刷新指标端点" onClick={() => void refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
        {error ? <div className="console-notice console-notice-danger m-3 mb-0">{(error as Error).message}</div> : null}
        <div className="console-panel-body">
          <div className="overflow-auto">
            <table className="console-table w-full min-w-[860px]">
              <thead>
                <tr>
                  <th>端点</th>
                  <th>类型</th>
                  <th>作用域</th>
                  <th>地址</th>
                  <th>租户</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6}><div className="console-skeleton h-10" /></td>
                  </tr>
                ) : endpoints.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="console-empty-state my-2 min-h-[300px]">
                        <Database className="h-5 w-5 text-muted/80" />
                        <div className="text-sm font-semibold text-on-surface">暂无指标接入端点</div>
                        <div className="max-w-md text-xs leading-5 text-muted">当前目录只展示支持 metrics 的统一观测端点；端点维护仍由后端统一接入配置收口。</div>
                        <Link className="console-button" to="/metrics/collection">查看采集接入</Link>
                      </div>
                    </td>
                  </tr>
                ) : endpoints.map((endpoint) => (
                  <tr key={endpoint.id}>
                    <td>
                      <div className="font-semibold text-on-surface">{endpoint.name || endpoint.id}</div>
                      <div className="font-mono text-[11px] text-muted">{endpoint.id}</div>
                    </td>
                    <td>{endpoint.endpointType || '-'}</td>
                    <td>{endpoint.scopeType || 'global'}</td>
                    <td className="max-w-[360px] truncate font-mono text-xs">{endpointURL(endpoint)}</td>
                    <td className="font-mono text-xs">{endpoint.accountId || '0'}:{endpoint.projectId || '0'}</td>
                    <td>
                      <span className={`status-badge ${statusClass(endpoint.status)}`}>
                        <span className="status-dot" aria-hidden />
                        {endpoint.status || 'unknown'}
                      </span>
                    </td>
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
