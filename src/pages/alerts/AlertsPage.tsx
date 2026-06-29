import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, BellRing, History } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { StatusBadge } from '../../components/StatusBadge';
import { api } from '../../services/api';

export function AlertsPage() {
  const queryClient = useQueryClient();
  const rulesQuery = useQuery({ queryKey: ['alerts', 'rules'], queryFn: api.getAlertRules });
  const instancesQuery = useQuery({ queryKey: ['alerts', 'instances'], queryFn: () => api.getAlertInstances() });
  const policiesQuery = useQuery({ queryKey: ['alerts', 'notification-policies'], queryFn: () => api.getNotificationPolicies() });
  const servicesQuery = useQuery({ queryKey: ['services', 'alert-policy-scope'], queryFn: () => api.getServices() });
  const [policyName, setPolicyName] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [policyServiceId, setPolicyServiceId] = useState('');
  const [selected, setSelected] = useState<{ ruleId: string; fingerprint: string } | null>(null);
  const eventsQuery = useQuery({
    queryKey: ['alerts', 'events', selected?.ruleId, selected?.fingerprint],
    queryFn: () => api.getAlertEvents(selected?.ruleId ?? '', selected?.fingerprint),
    enabled: Boolean(selected),
  });
  const rules = rulesQuery.data ?? [];
  const instances = instancesQuery.data ?? [];
  const ruleNames = useMemo(() => new Map(rules.map((rule) => [rule.id, rule.spec.name])), [rules]);
  const activeCount = instances.filter((item) => item.state === 'firing' || item.state === 'pending').length;
  const createPolicyMutation = useMutation({
    mutationFn: () => api.createNotificationPolicy({ name: policyName.trim(), receiver: receiverName.trim(), serviceId: policyServiceId || undefined }),
    onSuccess: async () => {
      setPolicyName(''); setReceiverName(''); setPolicyServiceId('');
      await queryClient.invalidateQueries({ queryKey: ['alerts', 'notification-policies'] });
    },
  });
  const togglePolicyMutation = useMutation({
    mutationFn: ({ policy, enabled }: { policy: NonNullable<typeof policiesQuery.data>[number]; enabled: boolean }) => api.setNotificationPolicyEnabled(policy, enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts', 'notification-policies'] }),
  });

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div><h1 className="page-title">告警中心</h1><p className="page-description">查看当前告警实例与状态变化记录。</p></div>
        <div className={`status-badge ${activeCount > 0 ? 'border-danger/25 bg-red-50 text-danger' : 'border-emerald-600/20 bg-emerald-50 text-emerald-700'}`}><span className="status-dot" aria-hidden />{activeCount} 个活跃告警</div>
      </div>

      <DataPanel title="告警实例" meta={instancesQuery.isLoading ? '加载中' : `${instances.length} instances`}>
        {instancesQuery.error ? <ErrorLine message={(instancesQuery.error as Error).message} /> : null}
        <div className="overflow-auto">
          <table className="console-table min-w-[980px] w-full">
            <thead><tr><th>状态</th><th>告警</th><th>服务</th><th>级别</th><th>开始时间</th><th>最近接收</th><th>动作</th></tr></thead>
            <tbody>
              {instances.map((item) => (
                <tr key={item.fingerprint} className="bg-surface-lowest hover:bg-surface-low">
                  <td><InstanceState state={item.state} /></td>
                  <td><div className="font-semibold text-on-surface">{item.annotations.summary || ruleNames.get(item.ruleId) || item.ruleId}</div><div className="max-w-[320px] truncate font-mono text-[11px] text-muted">{item.fingerprint}</div></td>
                  <td className="font-mono text-xs">{item.serviceId}</td>
                  <td><StatusBadge value={(item.labels.severity as 'critical' | 'warning' | 'info') || 'info'} /></td>
                  <td className="text-xs text-muted">{formatTime(item.startsAt)}</td>
                  <td className="text-xs text-muted">{formatTime(item.lastReceivedAt)}</td>
                  <td><button className="text-xs font-semibold text-primary hover:underline" onClick={() => setSelected({ ruleId: item.ruleId, fingerprint: item.fingerprint })}>更新记录</button></td>
                </tr>
              ))}
              {!instances.length && !instancesQuery.isLoading ? <tr><td colSpan={7} className="py-10 text-center text-sm text-muted">暂无告警实例</td></tr> : null}
            </tbody>
          </table>
        </div>
      </DataPanel>

      {selected ? (
        <DataPanel title="状态更新记录" meta={eventsQuery.isLoading ? '加载中' : `${eventsQuery.data?.length ?? 0} events`}>
          <div className="grid gap-2">
            {(eventsQuery.data ?? []).map((event) => (
              <div key={event.id} className="flex items-center justify-between gap-4 rounded-md border border-outline bg-white px-3 py-2 text-sm">
                <div className="flex items-center gap-2"><History className="h-4 w-4 text-primary" /><span className="font-mono text-xs text-muted">{event.previousState || 'new'}</span><span>→</span><InstanceState state={event.state} /></div>
                <time className="text-xs text-muted">{formatTime(event.occurredAt)}</time>
              </div>
            ))}
          </div>
        </DataPanel>
      ) : null}

      <DataPanel title="通知策略" meta={`${policiesQuery.data?.length ?? 0} policies`}>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid content-start gap-2">
            {(policiesQuery.data ?? []).map((policy) => (
              <div key={policy.id} className="flex items-center justify-between gap-3 rounded-md border border-outline bg-white px-3 py-2">
                <div><div className="text-sm font-semibold text-on-surface">{policy.name}</div><div className="mt-0.5 font-mono text-[11px] text-muted">告警路由标识 · {policy.receiver}</div></div>
                <button className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${policy.enabled ? 'border-primary/20 bg-primary-soft text-primary' : 'border-outline text-muted'}`} disabled={togglePolicyMutation.isPending} onClick={() => togglePolicyMutation.mutate({ policy, enabled: !policy.enabled })}>{policy.enabled ? '停用' : '启用'}</button>
              </div>
            ))}
            {!policiesQuery.data?.length ? <div className="rounded-md border border-dashed border-outline px-3 py-8 text-center text-sm text-muted">暂无通知策略</div> : null}
          </div>
          <div className="rounded-md border border-outline bg-surface p-4">
            <div className="text-sm font-semibold text-on-surface">新增通知策略</div>
            <p className="mt-1 text-xs leading-5 text-muted">策略关联统一告警平台中的稳定 receiver 标识，可设为全局或绑定到单个服务。</p>
            <label className="mt-3 block text-xs font-semibold text-on-surface">策略名称<input className="console-input mt-1.5 w-full" value={policyName} onChange={(event) => setPolicyName(event.target.value)} placeholder="例如：支付团队值班" /></label>
            <label className="mt-3 block text-xs font-semibold text-on-surface">适用范围<select className="console-input mt-1.5 w-full" value={policyServiceId} onChange={(event) => setPolicyServiceId(event.target.value)}><option value="">全局策略</option>{(servicesQuery.data ?? []).map((service) => <option key={service.id} value={service.id}>{service.displayName || service.name}</option>)}</select></label>
            <label className="mt-3 block text-xs font-semibold text-on-surface">Receiver 标识<input className="console-input mt-1.5 w-full font-mono" value={receiverName} onChange={(event) => setReceiverName(event.target.value)} placeholder="pay-oncall" /></label>
            {createPolicyMutation.error ? <ErrorLine message={(createPolicyMutation.error as Error).message} /> : null}
            <button className="console-button console-button-primary mt-3 h-9 w-full text-sm" disabled={!policyName.trim() || !receiverName.trim() || createPolicyMutation.isPending} onClick={() => createPolicyMutation.mutate()}>创建通知策略</button>
          </div>
        </div>
      </DataPanel>

      <DataPanel title="规则列表" meta={`${rules.length} rules`}>
        <div className="overflow-auto">
          <table className="console-table min-w-[1000px] w-full">
            <thead><tr><th>规则</th><th>来源</th><th>窗口</th><th>条件</th><th>级别</th><th>通知策略</th><th>状态</th></tr></thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="bg-surface-lowest hover:bg-surface-low">
                  <td><div className="font-semibold text-primary">{rule.spec.name}</div><div className="max-w-[360px] truncate text-[11px] text-muted">{rule.spec.query.expression}</div></td>
                  <td className="font-mono">logs</td>
                  <td className="font-mono">{rule.spec.trigger.window} / {rule.spec.trigger.evaluationInterval}</td>
                  <td className="font-mono text-muted">{rule.spec.trigger.operator} {rule.spec.trigger.threshold}</td>
                  <td><StatusBadge value={rule.spec.notification.severity} /></td>
                  <td className="font-mono text-muted">{rule.spec.notification.policyId}</td>
                  <td><div className="flex items-center gap-2"><StatusBadge value={rule.state} /><span className="text-[11px] text-muted">{rule.applyStatus}</span></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataPanel>
    </div>
  );
}

function InstanceState({ state }: { state: 'pending' | 'firing' | 'resolved' }) {
  const style = state === 'firing' ? 'border-red-200 bg-red-50 text-red-700' : state === 'pending' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700';
  const Icon = state === 'firing' ? BellRing : Activity;
  return <span className={`status-badge ${style}`}><span className="status-dot" aria-hidden /><Icon className="h-3 w-3" />{state}</span>;
}

function formatTime(value: string) { return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-'; }
function ErrorLine({ message }: { message: string }) { return <div className="console-notice console-notice-danger mb-3">{message}</div>; }
