import { Link } from 'react-router-dom';
import { Activity } from 'lucide-react';

export function MetricsOverviewPage() {
  return (
    <div className="space-y-3">
      <section className="console-panel overflow-hidden">
        <div className="console-panel-header">
          <div className="min-w-0">
            <h2 className="console-section-title">监控总览</h2>
            <p className="console-section-meta">service metrics overview</p>
          </div>
        </div>
        <div className="console-panel-body">
          <div className="console-empty-state min-h-[360px]">
            <Activity className="h-5 w-5 text-muted/80" />
            <div className="text-sm font-semibold text-on-surface">监控总览等待后端聚合数据</div>
            <div className="max-w-md text-xs leading-5 text-muted">服务作用域和指标绑定已接入；聚合健康、时序摘要和异常信号由后续聚合接口填充。</div>
            <Link className="console-button" to="/metrics/explore">查看指标查询</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
