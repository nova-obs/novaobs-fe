import { Link } from 'react-router-dom';
import { GitBranch, Search } from 'lucide-react';

export function TracesPage() {
  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Trace</h1>
          <p className="page-description">链路查询、Span 详情与日志反跳工作区。</p>
        </div>
      </div>

      <section className="console-panel min-h-[420px] p-3" aria-label="Trace 模块状态">
        <div className="console-empty-state h-full min-h-[390px]">
          <GitBranch className="h-5 w-5 text-muted/80" />
          <div className="text-sm font-semibold text-on-surface">Trace 查询尚未接入数据源</div>
          <div className="max-w-md text-xs leading-5 text-muted">后端 Traces API 尚未提供；接入后这里承载 Trace 查询、Span 详情和日志反跳。</div>
          <Link className="console-button mt-1" to="/logs/explore">
            <Search className="h-3.5 w-3.5" />
            查看日志分析
          </Link>
        </div>
      </section>
    </div>
  );
}
