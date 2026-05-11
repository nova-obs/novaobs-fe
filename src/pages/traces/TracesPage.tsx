import { Network } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';

export function TracesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-on-surface">Traces</h1>
        <p className="mt-1 text-sm text-muted">第一阶段强调 trace_id、span_id 注入日志和跨模块跳转。</p>
      </div>
      <DataPanel title="关联字段要求" meta="log trace correlation">
        <div className="grid gap-2 md:grid-cols-4">
          {['trace_id', 'span_id', 'request_id', 'service.name'].map((item) => (
            <div key={item} className="rounded border border-outline bg-surface-low px-3 py-2 font-mono text-xs text-primary">{item}</div>
          ))}
        </div>
      </DataPanel>
      <DataPanel title="链路入口" meta="reserved">
        <div className="flex items-center gap-3 rounded-lg border border-outline bg-surface-lowest p-4 text-muted">
          <Network className="h-5 w-5 text-primary" />
          <span className="text-sm">后续补齐 Trace 查询、Span 详情、服务拓扑和日志反跳。</span>
        </div>
      </DataPanel>
    </div>
  );
}
