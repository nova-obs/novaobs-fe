import { Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

export function MetricsMonitoringPage() {
  return (
    <div className="space-y-3">
      <div className="page-header"><h1 className="page-title">指标监控</h1></div>
      <section className="console-panel min-h-[420px] p-3" aria-label="指标监控">
        <div className="console-empty-state h-full min-h-[390px]">
          <Activity className="h-5 w-5 text-muted/80" />
          <div className="text-sm font-semibold text-on-surface">暂无可用指标监控视图</div>
          <Link className="console-button" to="/metrics/environments">接入指标环境</Link>
        </div>
      </section>
    </div>
  );
}
