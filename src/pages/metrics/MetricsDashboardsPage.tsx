import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, ExternalLink, LayoutGrid, RefreshCw } from 'lucide-react';
import { metricsApi, type GrafanaDashboardHit } from './api';

export function MetricsDashboardsPage() {
  const workspaceQuery = useQuery({
    queryKey: ['metrics-workspace'],
    queryFn: () => metricsApi.getWorkspace(),
    retry: false,
  });

  const endpoints = workspaceQuery.data?.endpoints ?? [];
  const grafanaEndpoint = endpoints.find((ep) => ep.endpointType === 'grafana');
  const grafanaBaseURL = grafanaEndpoint?.queryURL || grafanaEndpoint?.vmuiURL || grafanaEndpoint?.remoteWriteURL || '';

  const dashboardsQuery = useQuery({
    queryKey: ['grafana-dashboards', grafanaBaseURL],
    queryFn: () => metricsApi.searchGrafanaDashboards(grafanaBaseURL),
    enabled: Boolean(grafanaBaseURL),
    retry: false,
  });

  const dashboards = dashboardsQuery.data ?? [];
  const folders = useMemo(() => {
    const map = new Map<string, GrafanaDashboardHit[]>();
    for (const d of dashboards) {
      const folder = d.folderTitle || 'General';
      map.set(folder, [...(map.get(folder) ?? []), d]);
    }
    return map;
  }, [dashboards]);

  const error = workspaceQuery.error || dashboardsQuery.error;

  return (
    <div className="space-y-3">
      <section className="console-panel overflow-hidden">
        <div className="console-panel-header">
          <div className="min-w-0">
            <h2 className="console-section-title">Dashboard</h2>
            <p className="console-section-meta">dashboards · 共 {dashboards.length} 个</p>
          </div>
          <div className="flex items-center gap-2">
            {grafanaBaseURL ? (
              <a className="console-button gap-1.5 text-xs" href={grafanaBaseURL} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3" />
                Grafana
              </a>
            ) : null}
            <button type="button" className="console-icon-button border-outline bg-white" aria-label="刷新 Dashboard" title="刷新 Dashboard" onClick={() => void dashboardsQuery.refetch()}>
              <RefreshCw className="h-3.5 w-3.5" />
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
              <Link className="console-button" to="/metrics/endpoints">查看接入端点</Link>
            </div>
          ) : dashboardsQuery.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => <div key={i} className="console-skeleton h-28 rounded-md" />)}
            </div>
          ) : dashboards.length === 0 ? (
            <div className="console-empty-state min-h-[280px]">
              <LayoutGrid className="h-5 w-5 text-muted/80" />
              <div className="text-sm font-semibold text-on-surface">Grafana 中暂无 Dashboard</div>
              <div className="max-w-md text-xs leading-5 text-muted">在 Grafana 中创建或导入 Dashboard 后，此处将自动展示目录。</div>
              {grafanaBaseURL ? (
                <a className="console-button console-button-primary" href={grafanaBaseURL} target="_blank" rel="noopener noreferrer">打开 Grafana</a>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              {[...folders.entries()].map(([folder, items]) => (
                <div key={folder}>
                  <div className="mb-2 text-xs font-semibold text-muted">{folder}</div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((d) => (
                      <DashboardCard key={d.uid} dashboard={d} grafanaBaseURL={grafanaBaseURL} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function DashboardCard({ dashboard, grafanaBaseURL }: { dashboard: GrafanaDashboardHit; grafanaBaseURL: string }) {
  return (
    <Link
      to={`/metrics/dashboards/${encodeURIComponent(dashboard.uid)}?grafana=${encodeURIComponent(grafanaBaseURL)}`}
      className="group block rounded-md border border-outline bg-white transition-shadow hover:shadow-md"
    >
      <div className="p-3">
        <div className="flex items-start gap-2">
          <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-muted group-hover:text-primary" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-on-surface group-hover:text-primary">{dashboard.title}</div>
            <div className="mt-1 truncate font-mono text-[11px] text-muted">{dashboard.uid}</div>
          </div>
        </div>
        {dashboard.tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {dashboard.tags.map((tag) => (
              <span key={tag} className="rounded bg-surface-low px-1.5 py-0.5 text-[11px] font-medium text-muted">{tag}</span>
            ))}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
