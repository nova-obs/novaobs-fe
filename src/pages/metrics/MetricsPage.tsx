import { Activity } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';

export function MetricsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-on-surface">Metrics</h1>
        <p className="mt-1 text-sm text-muted">第一阶段保留统一资源过滤入口和 VMS 接入边界。</p>
      </div>
      <DataPanel title="资源过滤" meta="reserved">
        <div className="grid gap-3 md:grid-cols-4">
          {['service', 'environment', 'cluster', 'namespace'].map((item) => (
            <input key={item} className="console-input" placeholder={item} />
          ))}
        </div>
      </DataPanel>
      <DataPanel title="指标入口" meta="victoriametrics boundary">
        <div className="flex items-center gap-3 rounded-lg border border-outline bg-surface-lowest p-4 text-muted">
          <Activity className="h-5 w-5 text-primary" />
          <span className="text-sm">后续接入 VMS 查询、服务 SLO、指标告警和仪表盘模板。</span>
        </div>
      </DataPanel>
    </div>
  );
}
