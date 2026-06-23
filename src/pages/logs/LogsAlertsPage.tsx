import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, XCircle } from 'lucide-react';
import { api } from '../../services/api';
import { LogsEmptyState, LogsSection } from './LogsPrimitives';

export function LogsAlertsPage() {
  const { data: rules = [], isLoading, error } = useQuery({
    queryKey: ['logs-alert-rules'],
    queryFn: api.getAlertRules,
  });
  const logRules = rules;
  const enabledCount = logRules.filter((rule) => rule.state === 'enabled').length;

  return (
    <div className="logs-alerts-workbench min-h-[680px]">
      <LogsSection
        title="日志告警规则"
        meta={isLoading ? 'loading' : `${logRules.length} rules · ${enabledCount} enabled`}
        bodyClassName="p-0"
        action={
          <Link className="inline-flex h-8 items-center justify-center rounded-md border border-primary bg-primary-soft px-3 text-xs font-semibold text-primary transition-all active:translate-y-px" to="/logs/alerts/new">创建告警</Link>
        }
      >
        {error ? <ErrorLine message={(error as Error).message} /> : null}
        {logRules.length === 0 ? (
          <LogsEmptyState
            title="日志告警规则为空"
            action={<Link className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-semibold text-white" to="/logs/alerts/new">创建告警</Link>}
          />
        ) : (
          <div className="overflow-auto">
            <table className="console-table min-w-[960px] w-full">
              <thead>
                <tr>
                  <th>名称</th>
                  <th>级别</th>
                  <th>窗口</th>
                  <th>路由</th>
                  <th>状态</th>
                  <th>查询</th>
                  <th>动作</th>
                </tr>
              </thead>
              <tbody>
                {logRules.map((rule) => (
                  <tr key={rule.id}>
                    <td className="font-semibold text-on-surface">{rule.spec.name}</td>
                    <td>{rule.spec.notification.severity}</td>
                    <td className="font-mono text-xs">{rule.spec.trigger.window || '-'}</td>
                    <td>{rule.spec.notification.policyId || '-'}</td>
                    <td>
                      <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${rule.state === 'enabled' ? 'border-primary/20 bg-primary-soft text-primary' : 'border-outline bg-white text-muted'}`}>
                        {rule.state} · {rule.applyStatus}
                      </span>
                    </td>
                    <td className="max-w-[420px] truncate font-mono text-xs text-muted">{rule.spec.query.expression}</td>
                    <td><div className="flex items-center gap-3"><Link className="text-primary hover:underline" to={`/logs/alerts/${rule.id}`}>编辑</Link><Link className="inline-flex items-center gap-1 text-primary hover:underline" to="/alerts"><ExternalLink className="h-3.5 w-3.5" />告警中心</Link></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </LogsSection>
    </div>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <div className="m-3 flex items-center gap-2 rounded border border-red-500/30 bg-red-50 px-3 py-2 text-sm text-red-600">
      <XCircle className="h-4 w-4" />{message}
    </div>
  );
}
