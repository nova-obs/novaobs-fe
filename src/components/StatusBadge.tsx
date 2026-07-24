const statusClass: Record<string, string> = {
  active: 'border-emerald-600/20 bg-emerald-50 text-emerald-700',
  healthy: 'border-emerald-600/20 bg-emerald-50 text-emerald-700',
  success: 'border-emerald-600/20 bg-emerald-50 text-emerald-700',
  ready: 'border-emerald-600/20 bg-emerald-50 text-emerald-700',
  deployed: 'border-emerald-600/20 bg-emerald-50 text-emerald-700',
  online: 'border-emerald-600/20 bg-emerald-50 text-emerald-700',
  enabled: 'border-emerald-600/20 bg-emerald-50 text-emerald-700',
  parsed: 'border-emerald-600/20 bg-emerald-50 text-emerald-700',
  matched: 'border-emerald-600/20 bg-emerald-50 text-emerald-700',
  info: 'border-primary/25 bg-primary-soft text-primary',
  debug: 'border-outline bg-surface-low text-muted',
  warn: 'border-amber-200 bg-amber-50 text-amber-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  error: 'border-red-200 bg-red-50 text-red-700',
  pending: 'border-primary/25 bg-primary-soft text-primary',
  pending_publish: 'border-primary/25 bg-primary-soft text-primary',
  pending_verification: 'border-primary/25 bg-primary-soft text-primary',
  checking: 'border-primary/25 bg-primary-soft text-primary',
  previewed: 'border-primary/25 bg-primary-soft text-primary',
  processing: 'border-primary/25 bg-primary-soft text-primary',
  syncing: 'border-primary/25 bg-primary-soft text-primary',
  draft: 'border-outline bg-surface-low text-muted',
  raw: 'border-outline bg-surface-low text-muted',
  degraded: 'border-amber-200 bg-amber-50 text-amber-700',
  missing_resources: 'border-amber-200 bg-amber-50 text-amber-700',
  blocked: 'border-red-200 bg-red-50 text-red-700',
  failed: 'border-red-200 bg-red-50 text-red-700',
  unavailable: 'border-red-200 bg-red-50 text-red-700',
  critical: 'border-red-200 bg-red-50 text-red-700',
  high: 'border-red-200 bg-red-50 text-red-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-700',
  low: 'border-outline bg-surface-low text-muted',
  paused: 'border-outline bg-surface-low text-muted',
  disabled: 'border-outline bg-surface-low text-muted',
  stopped: 'border-outline bg-surface-low text-muted',
  offline: 'border-outline bg-surface-low text-muted',
  unknown: 'border-outline bg-surface-low text-muted',
  unmatched: 'border-red-200 bg-red-50 text-red-700',
};

const statusText: Record<string, string> = {
  active: '运行中',
  healthy: '健康',
  success: '成功',
  ready: '就绪',
  deployed: '已部署',
  online: '在线',
  enabled: '启用',
  parsed: '已解析',
  matched: '已匹配',
  info: 'info',
  debug: 'debug',
  warn: 'warn',
  warning: '警告',
  error: 'error',
  pending: '待接入',
  pending_publish: '待发布',
  pending_verification: '待验证',
  checking: '检查中',
  previewed: '待确认',
  processing: '处理中',
  syncing: '同步中',
  draft: '草稿',
  raw: '原始',
  degraded: '降级',
  missing_resources: '资源缺失',
  blocked: '已阻断',
  failed: '失败',
  unavailable: '不可用',
  critical: '严重',
  high: '高',
  medium: '中',
  low: '低',
  paused: '暂停',
  disabled: '停用',
  stopped: '已停止',
  offline: '离线',
  unknown: '未知',
  unmatched: '未匹配',
};

function textTone(status: string) {
  return (statusClass[status] ?? statusClass.low)
    .split(' ')
    .filter((className) => className.startsWith('text-'))
    .join(' ');
}

export function StatusBadge({ value, appearance = 'badge' }: { value: string; appearance?: 'badge' | 'inline' }) {
  return (
    <span className={appearance === 'inline' ? `status-inline ${textTone(value)}` : `status-badge ${statusClass[value] ?? statusClass.low}`}>
      <span className="status-dot" aria-hidden />
      {statusText[value] ?? value}
    </span>
  );
}
