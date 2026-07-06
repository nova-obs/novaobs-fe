import { BarChart3 } from 'lucide-react';

export function MetricsDashboardsPage() {
  return (
    <div className="space-y-3">
      <section className="console-panel overflow-hidden">
        <div className="console-panel-header">
          <div className="min-w-0">
            <h2 className="console-section-title">Dashboard</h2>
            <p className="console-section-meta">dashboards</p>
          </div>
        </div>
        <div className="console-panel-body">
          <div className="console-empty-state min-h-[360px]">
            <BarChart3 className="h-5 w-5 text-muted/80" />
            <div className="text-sm font-semibold text-on-surface">Dashboard 目录代理接入中</div>
            <div className="max-w-md text-xs leading-5 text-muted">NovaObs 只维护目录和受认证代理入口，Grafana 保持 dashboard 生产真值。</div>
          </div>
        </div>
      </section>
    </div>
  );
}
