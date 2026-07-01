import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, Plus, ShieldAlert, ShieldCheck, Trash2, X } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { k8sApi, type K8sRBACBinding } from './api';
import { useK8sOpsContext } from './context';

export function K8sRbacPage() {
  const queryClient = useQueryClient();
  const [namespace, setNamespace] = useState('');
  const [roleName, setRoleName] = useState('');
  const [bindingName, setBindingName] = useState('');
  const [serviceAccountName, setServiceAccountName] = useState('');
  const [activeAction, setActiveAction] = useState<'role' | 'binding' | 'delete' | null>(null);
  const [selectedBinding, setSelectedBinding] = useState<K8sRBACBinding | null>(null);
  const [lastAuditId, setLastAuditId] = useState('');

  const { activeClusterId, activeCluster, clusterError } = useK8sOpsContext();

  const { data: namespaces = [], error: namespaceError } = useQuery({
    queryKey: ['k8s-namespaces', activeClusterId],
    queryFn: () => k8sApi.listNamespaces(activeClusterId),
    enabled: Boolean(activeClusterId),
    retry: false,
  });

  useEffect(() => {
    const namespaceExists = namespaces.some((item) => item.name === namespace);
    if (namespace && !namespaceExists) {
      setNamespace(namespaces[0]?.name ?? '');
      setSelectedBinding(null);
      return;
    }
    if (!namespace && namespaces[0]?.name) {
      setNamespace(namespaces[0].name);
    }
  }, [namespace, namespaces]);

  const rolesQuery = useQuery({
    queryKey: ['k8s-rbac-roles', activeClusterId, namespace],
    queryFn: () => k8sApi.listRBACRoles(activeClusterId, namespace),
    enabled: Boolean(activeClusterId && namespace),
    retry: false,
  });
  const bindingsQuery = useQuery({
    queryKey: ['k8s-rbac-bindings', activeClusterId, namespace],
    queryFn: () => k8sApi.listRBACBindings(activeClusterId, namespace),
    enabled: Boolean(activeClusterId && namespace),
    retry: false,
  });

  const createRoleMutation = useMutation({
    mutationFn: () => k8sApi.createRBACRole({ clusterId: activeClusterId, namespace, name: roleName }),
    onSuccess: (result) => {
      setLastAuditId(result.auditId);
      setActiveAction(null);
      setRoleName('');
      queryClient.invalidateQueries({ queryKey: ['k8s-rbac-roles'] });
    },
  });
  const createBindingMutation = useMutation({
    mutationFn: () => k8sApi.createRBACBinding({ clusterId: activeClusterId, namespace, name: bindingName, roleName, serviceAccountName }),
    onSuccess: (result) => {
      setLastAuditId(result.auditId);
      setSelectedBinding(result.item ?? null);
      setActiveAction(null);
      setBindingName('');
      setServiceAccountName('');
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
      setActiveAction(null);
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
  const canList = Boolean(activeClusterId && namespace);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_0.8fr]">
        <RbacMetric icon={ShieldCheck} label="Role" value={String(roles.length)} meta={activeClusterId ? `cluster/${activeClusterId}` : '等待集群'} />
        <RbacMetric icon={Link2} label="Binding" value={String(bindings.length)} meta={namespace ? `namespace/${namespace}` : '等待命名空间'} />
        <RbacMetric icon={ShieldAlert} label="写权限" value="RBAC" meta="k8s.rbac" />
      </div>

      <section className="console-panel px-4 py-3">
        <div className="grid gap-3 md:grid-cols-[minmax(200px,280px)_minmax(180px,240px)_1fr] md:items-end">
          <div className="rounded-lg bg-white/55 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            <div className="text-xs font-semibold text-muted">当前集群</div>
            <div className="mt-1 font-mono text-sm font-semibold text-on-surface">{activeCluster?.name || activeClusterId || '未选择'}</div>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-muted">命名空间选择</span>
            <select className="console-input mt-2 w-full" value={namespace} onChange={(event) => setNamespace(event.target.value)} disabled={!namespaces.length}>
              {!namespaces.length ? <option value="">暂无命名空间</option> : null}
              {namespaces.map((item) => (
                <option key={`${item.clusterId}-${item.name}`} value={item.name}>{item.name}</option>
              ))}
            </select>
          </label>

        </div>
        {clusterError || namespaceError ? (
          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            {clusterError ? '集群列表读取失败，请检查 NovaObs 后端连接。' : `命名空间读取失败：${errorMessage(namespaceError)}`}
          </div>
        ) : null}
      </section>

      <DataPanel
        title="RBAC"
        meta={isLoading ? '加载中' : `${roles.length} 个 Role · ${bindings.length} 个 Binding`}
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <button className="console-button" disabled={!currentBinding} onClick={() => setActiveAction('delete')}><Trash2 className="h-4 w-4" />删除 Binding</button>
            <button className="console-button" disabled={!activeClusterId || !namespace} onClick={() => setActiveAction('binding')}><Link2 className="h-4 w-4" />创建 Binding</button>
            <button className="console-button console-button-primary" disabled={!activeClusterId || !namespace} onClick={() => setActiveAction('role')}><Plus className="h-4 w-4" />创建 Role</button>
          </div>
        )}
      >
        {error ? (
          <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            RBAC 读取失败：{errorMessage(error)}
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

        <div className="space-y-4 overflow-hidden">
          {!canList ? (
            <div className="rounded-lg bg-white/45 px-4 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
              <div className="font-semibold text-on-surface">请先选择集群和命名空间</div>
              <p className="mt-2 text-sm text-muted">RBAC 资源按 namespace 读取，不做默认跨命名空间扫描。</p>
            </div>
          ) : null}
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
                    <td className="text-xs text-muted">{item.source || 'Kubernetes API'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {canList && !isLoading && !error && !roles.length ? (
              <div className="mt-3 rounded-lg bg-white/45 px-4 py-6 text-center text-sm text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">当前命名空间没有返回 Role。</div>
            ) : null}
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
                    <td className="text-xs text-muted">{item.subjects.map(formatSubject).join(' · ') || '-'}</td>
                    <td className="font-mono text-[11px] text-muted">{item.uid}</td>
                    <td className="text-xs text-muted">{item.source || 'Kubernetes API'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {canList && !isLoading && !error && !bindings.length ? (
              <div className="mt-3 rounded-lg bg-white/45 px-4 py-6 text-center text-sm text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">当前命名空间没有返回 RoleBinding。</div>
            ) : null}
          </section>
        </div>
      </DataPanel>

      {activeAction === 'role' ? (
        <RbacActionDrawer title="创建 Role" onClose={() => setActiveAction(null)}>
          <div className="text-sm font-semibold text-on-surface">写操作确认</div>
          <p className="text-xs text-muted">提交前确认 Role 摘要，成功后返回审计 ID。</p>
          <label className="block text-xs font-semibold text-muted" htmlFor="rbac-role-name">Role Name</label>
          <input id="rbac-role-name" className="console-input w-full" value={roleName} onChange={(event) => setRoleName(event.target.value)} />
          <SummaryBox rows={[`cluster=${activeClusterId || '-'}`, `namespace=${namespace || '-'}`, `role=${roleName || '-'}`]} />
          <DrawerFooter>
            <button className="console-button" onClick={() => setActiveAction(null)}>取消</button>
            <button className="console-button console-button-primary" disabled={!activeClusterId || !namespace || !roleName.trim() || createRoleMutation.isPending} onClick={() => createRoleMutation.mutate()}>创建 Role</button>
          </DrawerFooter>
        </RbacActionDrawer>
      ) : null}

      {activeAction === 'binding' ? (
        <RbacActionDrawer title="创建 Binding" onClose={() => setActiveAction(null)}>
          <div className="text-sm font-semibold text-on-surface">写操作确认</div>
          <p className="text-xs text-muted">提交前确认 Role/Binding 摘要，成功后返回审计 ID。</p>
          <label className="block text-xs font-semibold text-muted" htmlFor="rbac-binding-name">Binding Name</label>
          <input id="rbac-binding-name" className="console-input w-full" value={bindingName} onChange={(event) => setBindingName(event.target.value)} />
          <label className="block text-xs font-semibold text-muted" htmlFor="rbac-sa-name">ServiceAccount</label>
          <input id="rbac-sa-name" className="console-input w-full" value={serviceAccountName} onChange={(event) => setServiceAccountName(event.target.value)} />
          <label className="block text-xs font-semibold text-muted" htmlFor="rbac-binding-role-name">Role Name</label>
          <input id="rbac-binding-role-name" className="console-input w-full" value={roleName} onChange={(event) => setRoleName(event.target.value)} />
          <SummaryBox rows={[`cluster=${activeClusterId || '-'}`, `namespace=${namespace || '-'}`, `role=${roleName || '-'}`, `binding=${bindingName || '-'}`]} />
          <DrawerFooter>
            <button className="console-button" onClick={() => setActiveAction(null)}>取消</button>
            <button className="console-button console-button-primary" disabled={!activeClusterId || !namespace || !bindingName.trim() || !serviceAccountName.trim() || createBindingMutation.isPending} onClick={() => createBindingMutation.mutate()}>创建 Binding</button>
          </DrawerFooter>
        </RbacActionDrawer>
      ) : null}

      {activeAction === 'delete' ? (
        <RbacActionDrawer title="删除 Binding" onClose={() => setActiveAction(null)}>
          <div className="text-sm font-semibold text-on-surface">删除确认摘要</div>
          <SummaryBox rows={[`kind=${currentBinding?.kind ?? '-'}`, `name=${currentBinding?.name ?? '-'}`, `uid=${currentBinding?.uid ?? '-'}`]} />
          <DrawerFooter>
            <button className="console-button" onClick={() => setActiveAction(null)}>取消</button>
            <button className="console-button console-button-danger" disabled={!currentBinding || deleteBindingMutation.isPending} onClick={() => deleteBindingMutation.mutate()}>删除 Binding</button>
          </DrawerFooter>
        </RbacActionDrawer>
      ) : null}
    </div>
  );
}

function RbacActionDrawer({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-slate-900/28">
      <button className="absolute inset-0 cursor-default" aria-label={`关闭${title}`} onClick={onClose} />
      <aside className="console-drawer-panel relative flex h-full w-full max-w-[680px] flex-col border-l border-outline bg-white shadow-[0_20px_60px_rgba(24,52,96,0.24)]" role="dialog" aria-modal="true" aria-labelledby="rbac-action-title">
        <header className="flex items-start justify-between gap-4 border-b border-outline px-5 py-4">
          <h2 id="rbac-action-title" className="text-base font-semibold text-on-surface">{title}</h2>
          <button className="console-button h-8 w-8 p-0" aria-label={`关闭${title}`} onClick={onClose}><X className="h-4 w-4" /></button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </div>
  );
}

function SummaryBox({ rows }: { rows: string[] }) {
  return (
    <div className="rounded-lg bg-surface px-3 py-3 text-xs text-muted">
      {rows.map((row) => <div key={row} className="font-mono">{row}</div>)}
    </div>
  );
}

function DrawerFooter({ children }: { children: ReactNode }) {
  return <div className="mt-auto flex items-center justify-end gap-2 border-t border-outline pt-4">{children}</div>;
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

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : '请检查集群凭据、平台 RBAC 与 Kubernetes API 连通性。';
}

function formatSubject(subject: { kind: string; namespace: string; name: string }) {
  return subject.namespace ? `${subject.kind}:${subject.namespace}/${subject.name}` : `${subject.kind}:${subject.name}`;
}
