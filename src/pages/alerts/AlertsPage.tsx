import { useQuery } from '@tanstack/react-query';
import { DataPanel } from '../../components/DataPanel';
import { StatusBadge } from '../../components/StatusBadge';
import { api } from '../../services/api';

export function AlertsPage() {
  const { data = [] } = useQuery({ queryKey: ['alerts'], queryFn: api.getAlertRules });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-on-surface">告警中心</h1>
      </div>
      <DataPanel title="规则列表" meta={`${data.length} rules`}>
        <div className="overflow-auto">
          <table className="console-table min-w-[1000px] w-full">
            <thead>
              <tr>
                <th>规则</th>
                <th>来源</th>
                <th>类型</th>
                <th>窗口</th>
                <th>条件</th>
                <th>级别</th>
                <th>路由</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {data.map((rule) => (
                <tr key={rule.id} className="bg-surface-lowest hover:bg-surface-low">
                  <td>
                    <div className="font-semibold text-primary">{rule.name}</div>
                    <div className="text-[11px] text-muted">{rule.query}</div>
                  </td>
                  <td className="font-mono">{rule.source}</td>
                  <td className="font-mono">{rule.ruleType}</td>
                  <td className="font-mono">{rule.window} / {rule.evalInterval}</td>
                  <td className="font-mono text-muted">{rule.condition}</td>
                  <td><StatusBadge value={rule.severity} /></td>
                  <td className="font-mono text-muted">{rule.alertRoute}</td>
                  <td><StatusBadge value={rule.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataPanel>
    </div>
  );
}
