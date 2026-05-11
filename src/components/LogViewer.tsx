import { StatusBadge } from './StatusBadge';
import type { LogEntry } from '../services/types';

export function LogViewer({ logs }: { logs: LogEntry[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-outline bg-surface-lowest">
      <div className="grid grid-cols-[170px_80px_160px_minmax(280px,1fr)_170px] border-b border-outline bg-surface-low px-3 py-2 text-xs font-semibold text-muted">
        <span>时间</span>
        <span>级别</span>
        <span>服务</span>
        <span>消息</span>
        <span>request_id</span>
      </div>
      <div className="max-h-[520px] overflow-auto">
        {logs.map((item) => (
          <details key={`${item.timestamp}-${item.requestId}`} className="group border-b border-outline last:border-b-0">
            <summary className="grid h-10 cursor-pointer grid-cols-[170px_80px_160px_minmax(280px,1fr)_170px] items-center px-3 text-xs hover:bg-surface-low">
              <span className="text-muted">{item.timestamp.replace('T', ' ').replace('Z', '')}</span>
              <StatusBadge value={item.level} />
              <span className="font-semibold">{item.service}</span>
              <span className="truncate">{item.message}</span>
              <span className="font-mono text-primary">{item.requestId}</span>
            </summary>
            <div className="grid gap-2 bg-surface-low px-4 py-3 font-mono text-xs md:grid-cols-2">
              <div>trace_id: <span className="text-primary">{item.traceId}</span></div>
              <div>span_id: <span className="text-primary">{item.spanId}</span></div>
              <div>pod: <span className="text-muted">{item.pod}</span></div>
              <div>pipeline: <span className="text-muted">{item.pipelineId} v{item.pipelineVersion}</span></div>
              <div>parse_status: <StatusBadge value={item.parseStatus} /></div>
              <div>cmdb_match: <StatusBadge value={item.cmdbMatchStatus} /></div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
