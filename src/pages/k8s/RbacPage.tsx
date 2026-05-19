import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, Plus, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { k8sApi, type K8sRBACBinding } from './api';

const DEFAULT_CLUSTER = 'prod';
const DEFAULT_NAMESPACE = 'orders';

export function K8sRbacPage() {
  const queryClient = useQueryClient();
  const [roleName, setRoleName] = useState('orders-reader');
  const [bindingName, setBindingName] = useState('orders-reader-binding');
  const [serviceAccountName, setServiceAccountName] = useState('orders-reader');
  const [selectedBinding, setSelectedBinding] = useState<K8sRBACBinding | null>(null);
  const [lastAuditId, setLastAuditId] = useState('');

  const rolesQuery = useQuery({
    queryKey: ['k8s-rbac-roles', DEFAULT_CLUSTER, DEFAULT_NAMESPACE],
    queryFn: () => k8sApi.listRBACRoles(DEFAULT_CLUSTER, DEFAULT_NAMESPACE),
    retry: false,
  });
  const bindingsQuery = useQuery({
    queryKey: ['k8s-rbac-bindings', DEFAULT_CLUSTER, DEFAULT_NAMESPACE],
    queryFn: () => k8sApi.listRBACBindings(DEFAULT_CLUSTER, DEFAULT_NAMESPACE),
    retry: false,
  });

  const createRoleMutation = useMutation({
    mutationFn: () => k8sApi.createRBACRole({ clusterId: DEFAULT_CLUSTER, namespace: DEFAULT_NAMESPACE, name: roleName }),
    onSuccess: (result) => {
      setLastAuditId(result.auditId);
      queryClient.invalidateQueries({ queryKey: ['k8s-rbac-roles'] });
    },
  });
  const createBindingMutation = useMutation({
    mutationFn: () => k8sApi.createRBACBinding({ clusterId: DEFAULT_CLUSTER, namespace: DEFAULT_NAMESPACE, name: bindingName, roleName, serviceAccountName }),
    onSuccess: (result) => {
      setLastAuditId(result.auditId);
      setSelectedBinding(result.item ?? null);
      queryClient.invalidateQueries({ queryKey: ['k8s-rbac-bindings'] });
    },
  });
  const deleteBindingMutation = useMutation({
    mutationFn: () => {
      const target = selectedBinding ?? bindingsQuery.data?.[0];
      if (!target) throw new Error('请选择要删除的 Binding');
      return k8sApi.deleteRBACBinding({ clusterId: target.clusterId, namespace: target.namespace, kind: target.kind, name: target.name, uid: target.uid });
    },
    onSuccess: (result) => {
      setLastAuditId(result.auditId);
      setSelectedBinding(null);
      queryClient.invalidateQueries({ queryKey: ['k8s-rbac-bindings'] });
    },
  });

  const permissionError = useMemo(() => {
    const message = createRoleMutation.error?.message || createBindingMutation.error?.message || deleteBindingMutation.error?.message || '';
    return message.includes('无权') || message.includes('permission_denied') ? message : '';
  }, [createRoleMutation.error, createBindingMutation.error, deleteBindingMutation.error]);

  const roles = rolesQuery.data ?? [];
  const bindings = bindingsQuery.data ?? [];
  const currentBinding = selectedBinding ?? bindings[0];
  const isLoading = rolesQuery.isLoading || bindingsQuery.isLoading;
  const error = rolesQuery.error || bindingsQuery.error;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_0.8fr]">
        <RbacMetric icon={ShieldCheck} label="Role" value={String(roles.length)} meta="namespace scoped" />
        <RbacMetric icon={Link2} label="Binding" value={String(bindings.length)} meta="subject mapping" />
        <RbacMetric icon={ShieldAlert} label="写权限" value="RBAC" meta="k8s.rbac" />
      </div>

      <DataPanel title="RBAC" meta={isLoading ? '加载中' : `${roles.length} 个 Role · ${bindings.length} 个 Binding`}>
        {error ? (
          <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            RBAC API 暂未连接，等待后端 `/api/v1/k8s/rbac/roles` 与 `/api/v1/k8s/rbac/bindings`。
          </div>
        ) : null}
        {permissionError ? (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            <ShieldAlert className="h-4 w-4" />
            权限不足：当前用户缺少 `k8s.rbac` 写权限，操作已被后端拒绝。
          </div>
        ) : null}
        {lastAuditId ? (
          <div className="mb-3 rounded-lg bg-primary-soft px-3 py-2 text-sm font-semibold text-primary">
            操作已落审计：<span className="font-mono">{lastAuditId}</span>
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className="space-y-4 overflow-hidden">
            <section className="overflow-auto">
              <table className="console-table min-w-[820px] w-full">
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>集群</th>
                    <th>命名空间</th>
                    <th>规则</th>
                    <th>UID</th>
                    <th>来源</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((item) => (
                    <tr key={item.uid || item.id} className="bg-white/35 hover:bg-white/60">
                      <td>
                        <div className="font-semibold text-primary">{item.name}</div>
                        <div className="text-[11px] text-muted">{item.kind}</div>
                      </td>
                      <td className="font-mono text-xs">{item.clusterId}</td>
                      <td className="font-mono text-xs">{item.namespace || '-'}</td>
                      <td className="text-xs text-muted">{item.rules.map((rule) => `${rule.resources.join(',')}:${rule.verbs.join(',')}`).join(' · ') || '-'}</td>
                      <td className="font-mono text-[11px] text-muted">{item.uid}</td>
                      <td className="text-xs text-muted">{item.source || 'startorch'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="overflow-auto">
              <table className="console-table min-w-[820px] w-full">
                <thead>
                  <tr>
                    <th>Binding</th>
                    <th>RoleRef</th>
                    <th>Subject</th>
                    <th>UID</th>
                    <th>来源</th>
                  </tr>
                </thead>
                <tbody>
                  {bindings.map((item) => (
                    <tr
                      key={item.uid || item.id}
                      className={`cursor-pointer bg-white/35 hover:bg-white/60 ${currentBinding?.uid === item.uid ? 'ring-1 ring-primary/25' : ''}`}
                      onClick={() => setSelectedBinding(item)}
                    >
                      <td>
                        <div className="font-semibold text-primary">{item.name}</div>
                        <div className="text-[11px] text-muted">{item.kind}</div>
                      </td>
                      <td className="font-mono text-xs">{item.roleRef.kind}/{item.roleRef.name}</td>
                      <td className="text-xs text-muted">{item.subjects.map((subject) => `${subject.kind}:${subject.namespace}/${subject.name}`).join(' · ') || '-'}</td>
                      <td className="font-mono text-[11px] text-muted">{item.uid}</td>
                      <td className="text-xs text-muted">{item.source || 'startorch'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          <aside className="console-panel px-4 py-3">
            <div className="text-sm font-semibold text-on-surface">写操作确认</div>
            <p className="mt-1 text-xs text-muted">提交前确认 Role/Binding 摘要，成功后返回审计 ID。</p>
            <label className="mt-4 block text-xs font-semibold text-muted" htmlFor="rbac-role-name">Role Name</label>
            <input id="rbac-role-name" className="console-input mt-2 w-full" value={roleName} onChange={(event) => setRoleName(event.target.value)} />
            <label className="mt-3 block text-xs font-semibold text-muted" htmlFor="rbac-binding-name">Binding Name</label>
            <input id="rbac-binding-name" className="console-input mt-2 w-full" value={bindingName} onChange={(event) => setBindingName(event.target.value)} />
            <label className="mt-3 block text-xs font-semibold text-muted" htmlFor="rbac-sa-name">ServiceAccount</label>
            <input id="rbac-sa-name" className="console-input mt-2 w-full" value={serviceAccountName} onChange={(event) => setServiceAccountName(event.target.value)} />

            <div className="mt-4 rounded-lg bg-white/45 px-3 py-3 text-xs text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
              <div className="font-mono">cluster={DEFAULT_CLUSTER}</div>
              <div className="font-mono">namespace={DEFAULT_NAMESPACE}</div>
              <div className="font-mono">role={roleName || '-'}</div>
              <div className="font-mono">binding={bindingName || '-'}</div>
            </div>
            <div className="mt-3 rounded-lg bg-white/45 px-3 py-3 text-xs text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
              <div className="font-semibold text-on-surface">删除确认摘要</div>
              <div className="mt-2 font-mono">kind={currentBinding?.kind ?? '-'}</div>
              <div className="font-mono">name={currentBinding?.name ?? '-'}</div>
              <div className="font-mono">uid={currentBinding?.uid ?? '-'}</div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60" disabled={!roleName.trim() || createRoleMutation.isPending} onClick={() => createRoleMutation.mutate()}>
                <Plus className="h-4 w-4" />
                Role
              </button>
              <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60" disabled={!bindingName.trim() || !serviceAccountName.trim() || createBindingMutation.isPending} onClick={() => createBindingMutation.mutate()}>
                <Plus className="h-4 w-4" />
                Binding
              </button>
              <button className="col-span-2 inline-flex items-center justify-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-sm font-semibold text-danger shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60" disabled={!currentBinding || deleteBindingMutation.isPending} onClick={() => deleteBindingMutation.mutate()}>
                <Trash2 className="h-4 w-4" />
                删除 Binding
              </button>
            </div>
          </aside>
        </div>
      </DataPanel>
    </div>
  );
}

function RbacMetric({ icon: Icon, label, value, meta }: { icon: typeof ShieldCheck; label: string; value: string; meta: string }) {
  return (
    <section className="console-panel px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-on-surface">{label}</div>
          <div className="mt-3 font-mono text-2xl font-semibold text-on-surface">{value}</div>
          <div className="mt-2 text-xs text-muted">{meta}</div>
        </div>
        <Icon className="h-4 w-4 text-primary" />
      </div>
    </section>
  );
}
