import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, BellRing, History, Plus, X } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { StatusBadge } from '../../components/StatusBadge';
import { api } from '../../services/api';
import type { AlertEvent, AlertInstance, AlertRule, NotificationPolicy, Service } from '../../services/types';

type AlertView = 'instances' | 'policies' | 'rules';

const alertViews: { key: AlertView; label: string }[] = [
  { key: 'instances', label: '告警实例' },
  { key: 'policies', label: '通知策略' },
  { key: 'rules', label: '规则列表' },
];

export function AlertsPage() {
  const queryClient = useQueryClient();
  const rulesQuery = useQuery({ queryKey: ['alerts', 'rules'], queryFn: api.getAlertRules });
  const instancesQuery = useQuery({ queryKey: ['alerts', 'instances'], queryFn: () => api.getAlertInstances() });
  const policiesQuery = useQuery({ queryKey: ['alerts', 'notification-policies'], queryFn: () => api.getNotificationPolicies() });
  const servicesQuery = useQuery({ queryKey: ['services', 'alert-policy-scope'], queryFn: () => api.getServices() });
  const [activeView, setActiveView] = useState<AlertView>('instances');
  const [policyDrawerOpen, setPolicyDrawerOpen] = useState(false);
  const [policyName, setPolicyName] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [policyServiceId, setPolicyServiceId] = useState('');
  const [selectedInstance, setSelectedInstance] = useState<AlertInstance | null>(null);
  const eventsQuery = useQuery({
    queryKey: ['alerts', 'events', selectedInstance?.ruleId, selectedInstance?.fingerprint],
    queryFn: () => api.getAlertEvents(selectedInstance?.ruleId ?? '', selectedInstance?.fingerprint),
    enabled: Boolean(selectedInstance),
  });
  const rules = rulesQuery.data ?? [];
  const instances = instancesQuery.data ?? [];
  const policies = policiesQuery.data ?? [];
  const services = servicesQuery.data ?? [];
  const ruleNames = useMemo(() => new Map(rules.map((rule) => [rule.id, rule.spec.name])), [rules]);
  const activeCount = instances.filter((item) => item.state === 'firing' || item.state === 'pending').length;
  const panelMeta = activeView === 'instances'
    ? (instancesQuery.isLoading ? '加载中' : `${instances.length} 条实例`)
    : activeView === 'policies'
      ? (policiesQuery.isLoading ? '加载中' : `${policies.length} 条策略`)
      : (rulesQuery.isLoading ? '加载中' : `${rules.length} 条规则`);
  const createPolicyMutation = useMutation({
    mutationFn: () => api.createNotificationPolicy({ name: policyName.trim(), receiver: receiverName.trim(), serviceId: policyServiceId || undefined }),
    onSuccess: async () => {
      setPolicyName('');
      setReceiverName('');
      setPolicyServiceId('');
      setPolicyDrawerOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['alerts', 'notification-policies'] });
    },
  });
  const togglePolicyMutation = useMutation({
    mutationFn: ({ policy, enabled }: { policy: NotificationPolicy; enabled: boolean }) => api.setNotificationPolicyEnabled(policy, enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts', 'notification-policies'] }),
  });

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">告警中心</h1>
          <p className="page-description">查看当前告警实例，维护通知策略和规则状态。</p>
        </div>
        <div className={`status-badge ${activeCount > 0 ? 'border-danger/25 bg-red-50 text-danger' : 'border-emerald-600/20 bg-emerald-50 text-emerald-700'}`}>
          <span className="status-dot" aria-hidden />
          {activeCount} 个活跃告警
        </div>
      </div>

      <DataPanel title="告警工作台" meta={panelMeta} action={<AlertViewTabs activeView={activeView} onChange={setActiveView} />}>
        {activeView === 'instances' ? (
          <AlertInstancesTable
            error={instancesQuery.error}
            isLoading={instancesQuery.isLoading}
            instances={instances}
            ruleNames={ruleNames}
            onOpenEvents={setSelectedInstance}
          />
        ) : null}

        {activeView === 'policies' ? (
          <NotificationPoliciesTable
            error={policiesQuery.error}
            policies={policies}
            pending={togglePolicyMutation.isPending}
            onCreate={() => setPolicyDrawerOpen(true)}
            onToggle={(policy, enabled) => togglePolicyMutation.mutate({ policy, enabled })}
          />
        ) : null}

        {activeView === 'rules' ? (
          <AlertRulesTable error={rulesQuery.error} rules={rules} />
        ) : null}
      </DataPanel>

      {selectedInstance ? (
        <AlertEventsDrawer
          instance={selectedInstance}
          ruleName={ruleNames.get(selectedInstance.ruleId)}
          events={eventsQuery.data ?? []}
          error={eventsQuery.error}
          isLoading={eventsQuery.isLoading}
          onClose={() => setSelectedInstance(null)}
        />
      ) : null}

      {policyDrawerOpen ? (
        <NotificationPolicyDrawer
          policyName={policyName}
          receiverName={receiverName}
          policyServiceId={policyServiceId}
          services={services}
          pending={createPolicyMutation.isPending}
          error={createPolicyMutation.error}
          setPolicyName={setPolicyName}
          setReceiverName={setReceiverName}
          setPolicyServiceId={setPolicyServiceId}
          onCreate={() => createPolicyMutation.mutate()}
          onClose={() => setPolicyDrawerOpen(false)}
        />
      ) : null}
    </div>
  );
}

function AlertViewTabs({ activeView, onChange }: { activeView: AlertView; onChange: (view: AlertView) => void }) {
  return (
    <div className="inline-flex rounded-md border border-outline bg-surface-lowest p-0.5">
      {alertViews.map((view) => (
        <button
          key={view.key}
          className={`h-7 rounded px-3 text-xs font-semibold transition-colors ${activeView === view.key ? 'bg-primary text-white' : 'text-muted hover:bg-surface hover:text-on-surface'}`}
          onClick={() => onChange(view.key)}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
}

function AlertInstancesTable({
  error,
  isLoading,
  instances,
  ruleNames,
  onOpenEvents,
}: {
  error: unknown;
  isLoading: boolean;
  instances: AlertInstance[];
  ruleNames: Map<string, string>;
  onOpenEvents: (instance: AlertInstance) => void;
}) {
  return (
    <div className="grid gap-3">
      {error ? <ErrorLine message={(error as Error).message} /> : null}
      <div className="overflow-auto">
        <table className="console-table min-w-[980px] w-full">
          <thead>
            <tr>
              <th>状态</th>
              <th>告警</th>
              <th>服务</th>
              <th>级别</th>
              <th>开始时间</th>
              <th>最近接收</th>
              <th className="w-[96px]">操作</th>
            </tr>
          </thead>
          <tbody>
            {instances.map((item) => (
              <tr key={item.fingerprint} className="bg-surface-lowest hover:bg-surface-low">
                <td><InstanceState state={item.state} /></td>
                <td>
                  <div className="font-semibold text-on-surface">{item.annotations.summary || ruleNames.get(item.ruleId) || item.ruleId}</div>
                  <div className="max-w-[320px] truncate font-mono text-[11px] text-muted">{item.fingerprint}</div>
                </td>
                <td className="font-mono text-xs">{item.serviceId || '-'}</td>
                <td><StatusBadge value={(item.labels.severity as 'critical' | 'warning' | 'info') || 'info'} /></td>
                <td className="text-xs text-muted">{formatTime(item.startsAt)}</td>
                <td className="text-xs text-muted">{formatTime(item.lastReceivedAt)}</td>
                <td>
                  <button className="text-xs font-semibold text-primary hover:underline" onClick={() => onOpenEvents(item)}>更新记录</button>
                </td>
              </tr>
            ))}
            {!instances.length && !isLoading ? <tr><td colSpan={7} className="py-10 text-center text-sm text-muted">暂无告警实例</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NotificationPoliciesTable({
  error,
  policies,
  pending,
  onCreate,
  onToggle,
}: {
  error: unknown;
  policies: NotificationPolicy[];
  pending: boolean;
  onCreate: () => void;
  onToggle: (policy: NotificationPolicy, enabled: boolean) => void;
}) {
  return (
    <div className="grid gap-3">
      <div className="console-list-toolbar">
        <div className="text-xs text-muted">策略关联稳定 receiver，可按服务收敛告警通知。</div>
        <button className="console-button console-button-primary" onClick={onCreate}>
          <Plus className="h-4 w-4" />
          新增通知策略
        </button>
      </div>
      {error ? <ErrorLine message={(error as Error).message} /> : null}
      <div className="overflow-auto">
        <table className="console-table min-w-[920px] w-full">
          <thead>
            <tr>
              <th>策略</th>
              <th>Receiver</th>
              <th>作用域</th>
              <th>状态</th>
              <th>更新时间</th>
              <th className="w-[96px]">操作</th>
            </tr>
          </thead>
          <tbody>
            {policies.map((policy) => (
              <tr key={policy.id} className="bg-surface-lowest hover:bg-surface-low">
                <td>
                  <div className="font-semibold text-on-surface">{policy.name}</div>
                  <div className="max-w-[320px] truncate text-[11px] text-muted">{policy.description || policy.id}</div>
                </td>
                <td className="font-mono text-xs">{policy.receiver}</td>
                <td className="font-mono text-xs">{policy.serviceId || 'global'}</td>
                <td><StatusBadge value={policy.enabled ? 'enabled' : 'disabled'} /></td>
                <td className="font-mono text-[11px] text-muted">{formatTime(policy.updatedAt)}</td>
                <td>
                  <button
                    className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${policy.enabled ? 'border-primary/20 bg-primary-soft text-primary' : 'border-outline text-muted'}`}
                    disabled={pending}
                    onClick={() => onToggle(policy, !policy.enabled)}
                  >
                    {policy.enabled ? '停用' : '启用'}
                  </button>
                </td>
              </tr>
            ))}
            {!policies.length ? <tr><td colSpan={6} className="py-10 text-center text-sm text-muted">暂无通知策略</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AlertRulesTable({ error, rules }: { error: unknown; rules: AlertRule[] }) {
  return (
    <div className="grid gap-3">
      {error ? <ErrorLine message={(error as Error).message} /> : null}
      <div className="overflow-auto">
        <table className="console-table min-w-[1000px] w-full">
          <thead>
            <tr>
              <th>规则</th>
              <th>来源</th>
              <th>窗口</th>
              <th>条件</th>
              <th>级别</th>
              <th>通知策略</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id} className="bg-surface-lowest hover:bg-surface-low">
                <td>
                  <div className="font-semibold text-primary">{rule.spec.name}</div>
                  <div className="max-w-[360px] truncate text-[11px] text-muted">{rule.spec.query.expression}</div>
                </td>
                <td className="font-mono">logs</td>
                <td className="font-mono">{rule.spec.trigger.window} / {rule.spec.trigger.evaluationInterval}</td>
                <td className="font-mono text-muted">{rule.spec.trigger.operator} {rule.spec.trigger.threshold}</td>
                <td><StatusBadge value={rule.spec.notification.severity} /></td>
                <td className="font-mono text-muted">{rule.spec.notification.policyId}</td>
                <td><div className="flex items-center gap-2"><StatusBadge value={rule.state} /><span className="text-[11px] text-muted">{rule.applyStatus}</span></div></td>
              </tr>
            ))}
            {!rules.length ? <tr><td colSpan={7} className="py-10 text-center text-sm text-muted">暂无规则</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AlertEventsDrawer({
  instance,
  ruleName,
  events,
  error,
  isLoading,
  onClose,
}: {
  instance: AlertInstance;
  ruleName?: string;
  events: AlertEvent[];
  error: unknown;
  isLoading: boolean;
  onClose: () => void;
}) {
  return (
    <Drawer title="状态更新记录" meta={ruleName || instance.ruleId} onClose={onClose}>
      <div className="grid gap-4">
        <div className="grid gap-2 rounded-md border border-outline bg-surface px-3 py-3 text-xs">
          <DetailRow label="Fingerprint" value={instance.fingerprint} mono />
          <DetailRow label="服务" value={instance.serviceId || '-'} mono />
          <DetailRow label="当前状态" value={<InstanceState state={instance.state} />} />
          <DetailRow label="最近接收" value={formatTime(instance.lastReceivedAt)} />
        </div>
        {error ? <ErrorLine message={(error as Error).message} /> : null}
        <div className="grid gap-2">
          {events.map((event) => (
            <div key={event.id} className="flex items-center justify-between gap-4 rounded-md border border-outline bg-white px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                <span className="font-mono text-xs text-muted">{event.previousState || 'new'}</span>
                <span>→</span>
                <InstanceState state={event.state} />
              </div>
              <time className="text-xs text-muted">{formatTime(event.occurredAt)}</time>
            </div>
          ))}
          {!events.length && !isLoading ? <div className="rounded-md border border-dashed border-outline py-10 text-center text-sm text-muted">暂无状态更新记录</div> : null}
        </div>
      </div>
    </Drawer>
  );
}

function NotificationPolicyDrawer({
  policyName,
  receiverName,
  policyServiceId,
  services,
  pending,
  error,
  setPolicyName,
  setReceiverName,
  setPolicyServiceId,
  onCreate,
  onClose,
}: {
  policyName: string;
  receiverName: string;
  policyServiceId: string;
  services: Service[];
  pending: boolean;
  error: unknown;
  setPolicyName: (value: string) => void;
  setReceiverName: (value: string) => void;
  setPolicyServiceId: (value: string) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  return (
    <Drawer title="新增通知策略" meta="receiver 与服务作用域" onClose={onClose}>
      <div className="grid gap-4">
        <label className="block text-xs font-semibold text-on-surface">
          策略名称
          <input className="console-input mt-1.5 w-full" value={policyName} onChange={(event) => setPolicyName(event.target.value)} placeholder="例如：支付团队值班" />
        </label>
        <label className="block text-xs font-semibold text-on-surface">
          适用范围
          <select className="console-input mt-1.5 w-full" value={policyServiceId} onChange={(event) => setPolicyServiceId(event.target.value)}>
            <option value="">全局策略</option>
            {services.map((service) => <option key={service.id} value={service.id}>{service.displayName || service.name}</option>)}
          </select>
        </label>
        <label className="block text-xs font-semibold text-on-surface">
          Receiver 标识
          <input className="console-input mt-1.5 w-full font-mono" value={receiverName} onChange={(event) => setReceiverName(event.target.value)} placeholder="pay-oncall" />
        </label>
        {error ? <ErrorLine message={(error as Error).message} /> : null}
      </div>
      <div className="mt-auto flex items-center justify-end gap-2 border-t border-outline pt-4">
        <button className="console-button" onClick={onClose}>取消</button>
        <button className="console-button console-button-primary" disabled={!policyName.trim() || !receiverName.trim() || pending} onClick={onCreate}>创建通知策略</button>
      </div>
    </Drawer>
  );
}

function Drawer({ title, meta, children, onClose }: { title: string; meta: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-slate-900/28">
      <button className="absolute inset-0 cursor-default" aria-label={`关闭${title}`} onClick={onClose} />
      <aside className="console-drawer-panel relative flex h-full w-full max-w-[760px] flex-col border-l border-outline bg-white shadow-[0_20px_60px_rgba(24,52,96,0.24)]" role="dialog" aria-modal="true" aria-labelledby="alert-drawer-title">
        <header className="flex items-start justify-between gap-4 border-b border-outline px-5 py-4">
          <div className="min-w-0">
            <h2 id="alert-drawer-title" className="text-base font-semibold text-on-surface">{title}</h2>
            <p className="mt-1 truncate text-xs text-muted">{meta}</p>
          </div>
          <button className="console-button h-8 w-8 p-0" aria-label={`关闭${title}`} onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </div>
  );
}

function DetailRow({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[120px_minmax(0,1fr)]">
      <span className="text-muted">{label}</span>
      <span className={`min-w-0 break-all font-semibold text-on-surface ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function InstanceState({ state }: { state: 'pending' | 'firing' | 'resolved' }) {
  const style = state === 'firing' ? 'border-red-200 bg-red-50 text-red-700' : state === 'pending' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700';
  const Icon = state === 'firing' ? BellRing : Activity;
  return <span className={`status-badge ${style}`}><span className="status-dot" aria-hidden /><Icon className="h-3 w-3" />{state}</span>;
}

function formatTime(value: string) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
}

function ErrorLine({ message }: { message: string }) {
  return <div className="console-notice console-notice-danger">{message}</div>;
}
