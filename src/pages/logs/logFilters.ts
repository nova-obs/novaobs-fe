import type { LogEntry, LogLevel } from '../../services/types';

export interface LogFilters {
  service?: string;
  environment?: string;
  level?: LogLevel | 'all';
  traceId?: string;
  requestId?: string;
  keyword?: string;
}

export function filterLogs(logs: LogEntry[], filters: LogFilters) {
  const keyword = filters.keyword?.trim().toLowerCase();
  return logs.filter((item) => {
    if (filters.service && item.service !== filters.service) return false;
    if (filters.environment && item.environment !== filters.environment) return false;
    if (filters.level && filters.level !== 'all' && item.level !== filters.level) return false;
    if (filters.traceId && !item.traceId.includes(filters.traceId)) return false;
    if (filters.requestId && !item.requestId.includes(filters.requestId)) return false;
    if (keyword && !`${item.message} ${item.service} ${item.errorCode ?? ''}`.toLowerCase().includes(keyword)) return false;
    return true;
  });
}

export function summarizeLogLevels(logs: LogEntry[]) {
  return logs.reduce<Record<LogLevel, number>>(
    (summary, item) => ({ ...summary, [item.level]: summary[item.level] + 1 }),
    { info: 0, warn: 0, error: 0, debug: 0 },
  );
}
