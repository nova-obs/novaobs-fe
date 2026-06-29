import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Plus, RefreshCw, Search, XCircle } from 'lucide-react';
import { StatusBadge } from '../../components/StatusBadge';
import { api } from '../../services/api';
import type { AlertRule } from '../../services/types';
import { LogsEmptyState } from './LogsPrimitives';

export function LogsAlertsPage() {
  const [ruleQuery, setRuleQuery] = useState('');
  const [selectedRuleId, setSelectedRuleId] = useState('');
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
  const selectedRule = filteredRules.find((rule) => rule.id === selectedRuleId) ?? filteredRules[0];

  useEffect(() => {
    if (!filteredRules.length) {
      if (selectedRuleId) setSelectedRuleId('');
      return;
    }
    if (!filteredRules.some((rule) => rule.id === selectedRuleId)) {
      setSelectedRuleId(filteredRules[0].id);
    }
  }, [filteredRules, selectedRuleId]);

  return (
    <div className="logs-alerts-workbench console-workbench min-h-0">
      <section className="console-panel flex min-h-0 flex-col overflow-hidden">
        {error ? <ErrorLine message={(error as Error).message} /> : null}
        <div className="console-list-toolbar shrink-0">
          <div className="console-list-toolbar-actions">
            <Link className="console-button console-button-primary" to="/logs/alerts/new"><Plus className="h-3.5 w-3.5" />创建告警</Link>
            <button className="console-button" onClick={() => refetch()}><RefreshCw className="h-3.5 w-3.5" />刷新</button>
          </div>
          <label className="console-list-toolbar-search">
            <span className="sr-only">搜索告警规则</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input className="console-input h-8 w-full pl-8" value={ruleQuery} onChange={(event) => setRuleQuery(event.target.value)} placeholder="搜索告警规则" />
          </label>
        </div>
        {logRules.length === 0 ? (
          <LogsEmptyState
            title="暂无日志告警"
            action={<Link className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-semibold text-white" to="/logs/alerts/new">创建告警</Link>}
          />
        ) : filteredRules.length === 0 ? (
          <LogsEmptyState title="未找到匹配的告警规则" description="请调整搜索关键字。" />
        ) : (
          <div className="console-split-workbench grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="console-resource-list min-w-0">
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
                      className={`cursor-pointer ${selectedRule?.id === rule.id ? 'console-selected-row' : ''}`}
                      onClick={() => setSelectedRuleId(rule.id)}
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
                          <Link className="console-table-action" to={`/logs/alerts/${rule.id}`} onClick={(event) => event.stopPropagation()}>编辑</Link>
                          <Link className="console-table-action" to="/alerts" onClick={(event) => event.stopPropagation()}><ExternalLink className="h-3.5 w-3.5" />告警中心</Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <LogsAlertRuleInspector rule={selectedRule} />
          </div>
        )}
      </section>
    </div>
  );
}

function LogsAlertRuleInspector({ rule }: { rule: AlertRule | undefined }) {
  if (!rule) {
    return (
      <aside className="console-detail-rail console-inspector hidden xl:block">
        <div className="console-empty-state">请选择一条告警规则</div>
      </aside>
    );
  }

  return (
    <aside className="console-detail-rail console-inspector hidden xl:block" aria-label="日志告警详情">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-muted">当前规则</div>
          <h2 className="mt-1 truncate text-base font-semibold text-on-surface">{rule.spec.name}</h2>
          <div className="mt-1 font-mono text-[11px] text-muted">{rule.id}</div>
        </div>
        <StatusBadge value={rule.state} />
      </div>
      <div className="mt-4 grid gap-2 text-xs">
        <InspectorLine label="级别" value={rule.spec.notification.severity || '-'} />
        <InspectorLine label="窗口" value={rule.spec.trigger.window || '-'} />
        <InspectorLine label="策略" value={rule.spec.notification.policyId || '-'} />
        <InspectorLine label="Owner" value={rule.spec.notification.ownerTeam || '-'} />
        <InspectorLine label="应用" value={rule.applyStatus || '-'} />
      </div>
      <div className="mt-4 rounded-md border border-outline bg-surface px-3 py-2">
        <div className="text-[11px] font-semibold text-muted">LogsQL</div>
        <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap break-all font-mono text-xs leading-5 text-on-surface">{rule.spec.query.expression || '-'}</pre>
      </div>
      <div className="mt-4 flex gap-2">
        <Link className="console-button console-button-primary" to={`/logs/alerts/${rule.id}`}>编辑规则</Link>
        <Link className="console-button" to="/alerts"><ExternalLink className="h-3.5 w-3.5" />告警中心</Link>
      </div>
    </aside>
  );
}

function InspectorLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-outline bg-surface px-3 py-2">
      <span className="text-muted">{label}</span>
      <span className="min-w-0 truncate font-mono font-semibold text-on-surface">{value}</span>
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
