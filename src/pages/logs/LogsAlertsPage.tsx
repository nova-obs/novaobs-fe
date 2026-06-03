import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, ExternalLink, XCircle } from 'lucide-react';
import { api } from '../../services/api';
import { LogsEmptyState, LogsInfoCell, LogsSection } from './LogsPrimitives';

export function LogsAlertsPage() {
  const { data: rules = [], isLoading, error } = useQuery({
    queryKey: ['logs-alert-rules'],
    queryFn: api.getAlertRules,
  });
  const logRules = rules.filter((rule) => rule.source === 'logs');
  const enabledCount = logRules.filter((rule) => rule.status === 'enabled').length;

  return (
    <div className="logs-alerts-workbench grid min-h-[680px] gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
      <LogsSection
        title="日志告警规则"
        meta={isLoading ? 'loading' : `${logRules.length} rules · ${enabledCount} enabled`}
        bodyClassName="p-0"
        action={
          <Link className="inline-flex h-8 items-center justify-center rounded-md border border-primary bg-primary-soft px-3 text-xs font-semibold text-primary transition-all active:translate-y-px" to="/logs/explore">从查询创建</Link>
        }
      >
        {error ? <ErrorLine message={(error as Error).message} /> : null}
        {logRules.length === 0 ? (
          <LogsEmptyState
            title="日志告警规则为空"
            action={<Link className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-semibold text-white" to="/logs/explore">日志分析</Link>}
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
                    <td className="font-semibold text-on-surface">{rule.name}</td>
                    <td>{rule.severity}</td>
                    <td className="font-mono text-xs">{rule.window || '-'}</td>
                    <td>{rule.alertRoute || '-'}</td>
                    <td>
                      <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${rule.status === 'enabled' ? 'border-primary/20 bg-primary-soft text-primary' : 'border-outline bg-white text-muted'}`}>
                        {rule.status}
                      </span>
                    </td>
                    <td className="max-w-[420px] truncate font-mono text-xs text-muted">{rule.query}</td>
                    <td><Link className="inline-flex items-center gap-1 text-primary hover:underline" to="/alerts"><ExternalLink className="h-3.5 w-3.5" />告警中心</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </LogsSection>

      <LogsSection title="规则上下文" meta="query / threshold / route" bodyClassName="p-0">
        <LogsInfoCell label="规则数量" value={String(logRules.length)} tone="primary" />
        <LogsInfoCell label="已启用" value={String(enabledCount)} tone="primary" />
        <LogsInfoCell label="默认窗口" value="最近 15 分钟" />
        <div className="border-t border-outline/70 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-on-surface">
            <Bell className="h-3.5 w-3.5 text-primary" />
            规则字段
          </div>
          <div className="mt-2 grid gap-2 text-xs text-muted">
            <div className="rounded-lg bg-white/55 px-3 py-2">query</div>
            <div className="rounded-lg bg-white/55 px-3 py-2">window / threshold</div>
            <div className="rounded-lg bg-white/55 px-3 py-2">alert route</div>
          </div>
        </div>
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
