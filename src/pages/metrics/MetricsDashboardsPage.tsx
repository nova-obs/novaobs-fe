import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, ExternalLink, RefreshCw } from 'lucide-react';
import { metricsApi } from './api';
import { StatusBadge } from '../../components/StatusBadge';
import { ServiceContextSelector } from '../../components/navigation/ServiceContextSelector';

export function MetricsDashboardsPage() {
	const { productId = '', serviceId = '' } = useParams();
	const endpointsPath = `/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}/metrics/endpoints`;
  const workspaceQuery = useQuery({
	queryKey: ['metrics-workspace', productId, serviceId],
	queryFn: () => metricsApi.getWorkspace(productId, serviceId),
	enabled: Boolean(productId && serviceId),
    retry: false,
  });

  const endpoints = workspaceQuery.data?.endpoints ?? [];
  const grafanaEndpoint = endpoints.find((ep) => ep.endpointType === 'grafana');
  const grafanaBaseURL = grafanaEndpoint?.queryURL || grafanaEndpoint?.vmuiURL || grafanaEndpoint?.remoteWriteURL || '';

  const error = workspaceQuery.error;

  return (
    <div className="space-y-3">
      <section className="console-panel overflow-hidden">
        <div className="console-panel-header">
          <ServiceContextSelector className="w-full max-w-[420px]" />
          <div className="flex items-center gap-2">
            {grafanaBaseURL ? (
              <a className="console-button gap-1.5 text-xs" href={grafanaBaseURL} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3" />
                Grafana
              </a>
            ) : null}
            <button type="button" className="console-icon-button border-outline bg-white" aria-label="刷新 Dashboard" title="刷新 Dashboard" onClick={() => void workspaceQuery.refetch()}>
              <RefreshCw className={`h-3.5 w-3.5 ${workspaceQuery.isFetching ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        <div className="console-panel-body">
          {error ? <div className="console-notice console-notice-danger mb-3">{(error as Error).message}</div> : null}

          {!grafanaEndpoint ? (
            <div className="console-empty-state min-h-[360px]">
              <BarChart3 className="h-5 w-5 text-muted/80" />
              <div className="text-sm font-semibold text-on-surface">未配置 Grafana 端点</div>
              <div className="max-w-md text-xs leading-5 text-muted">需要先在接入端点中配置 Grafana 类型的端点，并确保反向代理已就绪。</div>
			  <Link className="console-button" to={endpointsPath}>查看接入端点</Link>
            </div>
          ) : (
            <div className="overflow-auto rounded-md border border-outline bg-surface-lowest">
              <table className="console-table w-full min-w-[720px]">
                <thead>
                  <tr>
                    <th>端点</th>
                    <th>状态</th>
                    <th>查询地址</th>
                    <th className="w-32">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <div className="font-semibold text-on-surface">{grafanaEndpoint.name || grafanaEndpoint.id}</div>
                    </td>
                    <td><StatusBadge value={grafanaEndpoint.status || 'unknown'} /></td>
                    <td className="max-w-[360px] truncate font-mono text-xs" title={grafanaBaseURL}>{grafanaBaseURL || '-'}</td>
                    <td>
                      {grafanaBaseURL ? (
                        <a className="console-button gap-1.5 text-xs" href={grafanaBaseURL} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3" />
                          打开
                        </a>
                      ) : (
						<Link className="console-button text-xs" to={endpointsPath}>编辑端点</Link>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
