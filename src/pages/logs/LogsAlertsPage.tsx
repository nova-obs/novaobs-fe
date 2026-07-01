import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ExternalLink, Plus, RefreshCw, Search, XCircle } from 'lucide-react';
import { StatusBadge } from '../../components/StatusBadge';
import { api } from '../../services/api';
import { LogsAlertRuleEditorDrawer } from './LogsAlertRulePage';
import { LogsEmptyState } from './LogsPrimitives';

export function LogsAlertsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { id: routeRuleId = '' } = useParams();
  const [ruleQuery, setRuleQuery] = useState('');
  const { data: rules = [], error, refetch } = useQuery({
    queryKey: ['logs-alert-rules'],
    queryFn: api.getAlertRules,
  });
  const logRules = rules;
  const filteredRules = useMemo(() => {
    const query = ruleQuery.trim().toLowerCase();
    if (!query) return logRules;
    return logRules.filter((rule) => [
      rule.spec.name,
      rule.id,
      rule.spec.query.expression,
      rule.spec.notification.ownerTeam,
      rule.spec.notification.severity,
    ].filter(Boolean).join(' ').toLowerCase().includes(query));
  }, [logRules, ruleQuery]);

  const editorRuleId = location.pathname.endsWith('/new') ? '' : routeRuleId;
  const editorOpen = location.pathname.endsWith('/new') || Boolean(routeRuleId);

  return (
    <div className="logs-alerts-workbench console-workbench min-h-0">
      <section className="console-panel flex min-h-0 flex-col overflow-hidden">
        {error ? <ErrorLine message={(error as Error).message} /> : null}
        <div className="console-panel-header shrink-0 justify-end">
          <div className="flex w-full flex-wrap items-center justify-end gap-2 md:w-auto">
            <label className="relative w-full md:w-80">
              <span className="sr-only">搜索告警规则</span>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <input className="console-input h-9 w-full pl-8 text-sm" value={ruleQuery} onChange={(event) => setRuleQuery(event.target.value)} placeholder="搜索告警规则" />
            </label>
            <button className="console-button" onClick={() => refetch()}><RefreshCw className="h-3.5 w-3.5" />刷新</button>
            <Link className="console-button console-button-primary" to="/logs/alerts/new"><Plus className="h-3.5 w-3.5" />创建告警</Link>
          </div>
        </div>
        {logRules.length === 0 ? (
          <LogsEmptyState
            title="暂无日志告警"
            action={<Link className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-semibold text-white" to="/logs/alerts/new">创建告警</Link>}
          />
        ) : filteredRules.length === 0 ? (
          <LogsEmptyState title="未找到匹配的告警规则" description="请调整搜索关键字。" />
        ) : (
          <div className="console-resource-list min-w-0 flex-1">
              <table className="console-table logs-alert-rules-table min-w-[960px] w-full">
                <thead className="[&>tr>th]:text-[13px] [&>tr>th]:font-semibold">
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
                <tbody className="[&>tr>td]:text-[11px]">
                  {filteredRules.map((rule) => (
                    <tr
                      key={rule.id}
                      className="bg-surface-lowest hover:bg-surface-low"
                    >
                      <td>
                        <div className="font-semibold text-on-surface">{rule.spec.name}</div>
                        <div className="font-mono text-[11px] text-muted">{rule.id}</div>
                      </td>
                      <td>{rule.spec.notification.severity}</td>
                      <td className="font-mono text-xs">{rule.spec.trigger.window || '-'}</td>
                      <td>{rule.spec.notification.policyId || '-'}</td>
                      <td>
                        <div className="flex flex-wrap gap-1.5">
                          <StatusBadge value={rule.state} />
                          <StatusBadge value={rule.applyStatus} />
                        </div>
                      </td>
                      <td className="max-w-[420px] truncate font-mono text-xs text-muted">{rule.spec.query.expression}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Link className="console-table-action" to={`/logs/alerts/${rule.id}`}>编辑</Link>
                          <Link className="console-table-action" to="/alerts"><ExternalLink className="h-3.5 w-3.5" />告警中心</Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          </div>
        )}
      </section>
      {editorOpen ? (
        <LogsAlertRuleEditorDrawer ruleId={editorRuleId} onClose={() => navigate('/logs/alerts')} />
      ) : null}
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
