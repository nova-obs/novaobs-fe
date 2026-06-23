import type { ServiceStatus, Severity } from '../services/types';

type StatusValue =
  | ServiceStatus
  | Severity
  | 'debug'
  | 'info'
  | 'warn'
  | 'warning'
  | 'error'
  | 'enabled'
  | 'disabled'
  | 'draft'
  | 'parsed'
  | 'raw'
  | 'failed'
  | 'matched'
  | 'unmatched';

const statusClass: Record<string, string> = {
  active: 'border-primary/25 bg-primary-soft text-primary',
  enabled: 'border-primary/25 bg-primary-soft text-primary',
  parsed: 'border-primary/25 bg-primary-soft text-primary',
  matched: 'border-primary/25 bg-primary-soft text-primary',
  info: 'border-primary/25 bg-primary-soft text-primary',
  debug: 'border-outline bg-surface-low text-muted',
  warn: 'border-amber-200 bg-amber-50 text-amber-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  error: 'border-red-200 bg-red-50 text-red-700',
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  draft: 'border-amber-200 bg-amber-50 text-amber-700',
  raw: 'border-amber-200 bg-amber-50 text-amber-700',
  degraded: 'border-red-200 bg-red-50 text-red-700',
  failed: 'border-red-200 bg-red-50 text-red-700',
  critical: 'border-red-200 bg-red-50 text-red-700',
  high: 'border-red-200 bg-red-50 text-red-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-700',
  low: 'border-outline bg-surface-low text-muted',
  paused: 'border-outline bg-surface-low text-muted',
  disabled: 'border-outline bg-surface-low text-muted',
  unmatched: 'border-red-200 bg-red-50 text-red-700',
};

const statusText: Record<string, string> = {
  active: '运行中',
  enabled: '启用',
  parsed: '已解析',
  matched: '已匹配',
  info: 'info',
  debug: 'debug',
  warn: 'warn',
  warning: '警告',
  error: 'error',
  pending: '待接入',
  draft: '草稿',
  raw: '原始',
  degraded: '降级',
  failed: '失败',
  critical: '严重',
  high: '高',
  medium: '中',
  low: '低',
  paused: '暂停',
  disabled: '停用',
  unmatched: '未匹配',
};

export function StatusBadge({ value }: { value: StatusValue }) {
  return (
    <span className={`inline-flex rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${statusClass[value] ?? statusClass.low}`}>
      {statusText[value] ?? value}
    </span>
  );
}
