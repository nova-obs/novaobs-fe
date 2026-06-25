export function MonitoringPage() {
  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">监控</h1>
          <p className="page-description">指标查询与运行状态工作区。</p>
        </div>
      </div>
      <section className="console-panel min-h-[420px] p-3" aria-label="监控模块留白">
        <div className="console-empty-state h-full min-h-[390px]">
          <div className="text-sm font-semibold text-on-surface">暂无可用监控视图</div>
          <div className="text-xs text-muted">指标数据源接入后在此展示。</div>
        </div>
      </section>
    </div>
  );
}
