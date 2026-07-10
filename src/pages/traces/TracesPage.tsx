import { Link } from 'react-router-dom';
import { GitBranch, Search } from 'lucide-react';

export function TracesPage() {
  return (
    <div className="space-y-4">
      <div className="page-header"><h1 className="page-title">Trace</h1></div>

      <section className="console-panel min-h-[420px] p-3" aria-label="Trace 模块状态">
        <div className="console-empty-state h-full min-h-[390px]">
          <GitBranch className="h-5 w-5 text-muted/80" />
          <div className="text-sm font-semibold text-on-surface">Trace 查询尚未接入数据源</div>
          <div className="max-w-md text-xs leading-5 text-muted">接入 Trace 数据源后可查询链路并查看 Span 详情。</div>
          <Link className="console-button mt-1" to="/logs/explore">
            <Search className="h-3.5 w-3.5" />
            查看日志分析
          </Link>
        </div>
      </section>
    </div>
  );
}
