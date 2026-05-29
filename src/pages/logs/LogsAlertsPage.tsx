import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { api } from '../../services/api';

export function LogsAlertsPage() {
  const { data: rules = [], isLoading, error } = useQuery({
    queryKey: ['logs-alert-rules'],
    queryFn: api.getAlertRules,
  });
  const logRules = rules.filter((rule) => rule.source === 'logs');

  return (
    <DataPanel title="日志告警" meta={isLoading ? '加载中...' : `${logRules.length} rules`}>
      {error ? <p className="text-sm text-red-500">{(error as Error).message}</p> : null}
      {logRules.length === 0 ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted">
          <Bell className="h-4 w-4" />暂无日志告警规则。
        </div>
      ) : (
        <div className="overflow-auto">
          <table className="console-table min-w-[860px] w-full">
            <thead>
              <tr>
                <th>名称</th>
                <th>级别</th>
                <th>窗口</th>
                <th>路由</th>
                <th>状态</th>
                <th>查询</th>
              </tr>
            </thead>
            <tbody>
              {logRules.map((rule) => (
                <tr key={rule.id}>
                  <td className="font-semibold text-on-surface">{rule.name}</td>
                  <td>{rule.severity}</td>
                  <td className="font-mono text-xs">{rule.window || '-'}</td>
                  <td>{rule.alertRoute || '-'}</td>
                  <td>{rule.status}</td>
                  <td className="max-w-[420px] truncate font-mono text-xs text-muted">{rule.query}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DataPanel>
  );
}
