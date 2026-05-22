import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Plus, ShieldAlert, ShieldCheck, UserRoundCog, UsersRound } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { platformApi, type PlatformBinding, type PlatformSubject } from './api';

export function PlatformAccessAdminPage() {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [initialPassword, setInitialPassword] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupDisplayName, setGroupDisplayName] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [scopeMode, setScopeMode] = useState<'global' | 'cluster' | 'namespace'>('global');
  const [clusterId, setClusterId] = useState('');
  const [namespace, setNamespace] = useState('');
  const [lastBinding, setLastBinding] = useState<PlatformBinding | null>(null);

  const meQuery = useQuery({ queryKey: ['platform-me'], queryFn: () => platformApi.me(), retry: false });
  const subjectsQuery = useQuery({ queryKey: ['platform-subjects'], queryFn: () => platformApi.listSubjects(), retry: false });
  const usersQuery = useQuery({ queryKey: ['platform-users'], queryFn: () => platformApi.listUsers(), retry: false });
  const groupsQuery = useQuery({ queryKey: ['platform-groups'], queryFn: () => platformApi.listGroups(), retry: false });
  const serviceAccountsQuery = useQuery({ queryKey: ['platform-service-accounts'], queryFn: () => platformApi.listServiceAccounts(), retry: false });
  const rolesQuery = useQuery({ queryKey: ['platform-roles'], queryFn: () => platformApi.listRoles(), retry: false });
  const bindingsQuery = useQuery({ queryKey: ['platform-bindings'], queryFn: () => platformApi.listBindings(), retry: false });

  const createUserMutation = useMutation({
    mutationFn: () => platformApi.createUser({ username, displayName, email, password: initialPassword }),
    onSuccess: () => {
      setUsername('');
      setDisplayName('');
      setEmail('');
      setInitialPassword('');
      queryClient.invalidateQueries({ queryKey: ['platform-users'] });
      queryClient.invalidateQueries({ queryKey: ['platform-subjects'] });
    },
  });
  const createGroupMutation = useMutation({
    mutationFn: () => platformApi.createGroup({ name: groupName, displayName: groupDisplayName }),
    onSuccess: () => {
      setGroupName('');
      setGroupDisplayName('');
      queryClient.invalidateQueries({ queryKey: ['platform-groups'] });
      queryClient.invalidateQueries({ queryKey: ['platform-subjects'] });
    },
  });
  const createBindingMutation = useMutation({
    mutationFn: () => {
      const [subjectType, subjectId] = splitSubjectValue(selectedSubject);
      return platformApi.createBinding({
        subjectId,
        subjectType,
        roleId: selectedRole,
        scope: {
          global: scopeMode === 'global',
          clusterId: scopeMode === 'global' ? '' : clusterId,
          namespace: scopeMode === 'namespace' ? namespace : '',
        },
      });
    },
    onSuccess: (result) => {
      setLastBinding(result.item ?? null);
      queryClient.invalidateQueries({ queryKey: ['platform-bindings'] });
      queryClient.invalidateQueries({ queryKey: ['platform-subjects'] });
      queryClient.invalidateQueries({ queryKey: ['k8s-platform-subjects'] });
      queryClient.invalidateQueries({ queryKey: ['k8s-platform-access-bindings'] });
    },
  });

  const subjects = subjectsQuery.data ?? [];
  const roles = rolesQuery.data ?? [];
  const bindings = bindingsQuery.data ?? [];
  const users = usersQuery.data ?? [];
  const groups = groupsQuery.data ?? [];
  const serviceAccounts = serviceAccountsQuery.data ?? [];
  const firstSubjectValue = subjectValue(subjects[0]);
  const activeSubjectValue = selectedSubject || firstSubjectValue;
  const activeRole = selectedRole || roles[0]?.id || '';
  const permissionError = useMemo(() => {
    const error = meQuery.error || subjectsQuery.error || usersQuery.error || groupsQuery.error || serviceAccountsQuery.error || rolesQuery.error || bindingsQuery.error || createUserMutation.error || createGroupMutation.error || createBindingMutation.error;
    const message = error?.message ?? '';
    return message.includes('无权') || message.includes('permission_denied') ? message : '';
  }, [meQuery.error, subjectsQuery.error, usersQuery.error, groupsQuery.error, serviceAccountsQuery.error, rolesQuery.error, bindingsQuery.error, createUserMutation.error, createGroupMutation.error, createBindingMutation.error]);
  const canCreateUser = Boolean(username.trim() && displayName.trim() && initialPassword.trim().length >= 8);
  const canCreateGroup = Boolean(groupName.trim() && groupDisplayName.trim());
  const canBind = Boolean(activeSubjectValue && activeRole && (scopeMode === 'global' || clusterId.trim()) && (scopeMode !== 'namespace' || namespace.trim()));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <AdminMetric icon={UserRoundCog} label="当前主体" value={meQuery.data?.subjectId || '-'} meta={meQuery.data?.subjectType || 'request subject'} />
        <AdminMetric icon={UsersRound} label="用户 / 组 / SA" value={`${users.length} / ${groups.length} / ${serviceAccounts.length}`} meta="local identity directory" />
        <AdminMetric icon={ShieldCheck} label="角色" value={String(roles.length)} meta="platform RBAC role set" />
        <AdminMetric icon={KeyRound} label="授权绑定" value={String(bindings.length)} meta={lastBinding?.id || 'global scope ready'} />
      </div>

      <section className="console-panel px-4 py-3">
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1.2fr]">
          <div>
            <div className="text-sm font-semibold text-on-surface">身份源</div>
            <div className="mt-2 text-xs leading-5 text-muted">平台 IAM 是 NovaObs 唯一身份目录；K8s 模块只消费这里的主体并附加 cluster / namespace scope。</div>
          </div>
          <div>
            <div className="text-sm font-semibold text-on-surface">权限模型</div>
            <div className="mt-2 text-xs leading-5 text-muted">Role 复用 `resource:action + scope_mode`，Binding 将主体、角色和作用域绑定到一起。</div>
          </div>
          <div className="rounded-lg bg-white/45 px-3 py-3 text-xs text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
            <div className="font-mono">source=/api/v1/platform/*</div>
            <div className="mt-1 font-mono">sync=platform RBAC</div>
          </div>
        </div>
      </section>

      <DataPanel title="平台用户权限" meta="users / groups / roles / bindings">
        {permissionError ? (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            <ShieldAlert className="h-4 w-4" />
            权限不足：当前用户缺少 `platform.iam:manage`。
          </div>
        ) : null}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="grid gap-4">
            <section className="overflow-auto">
              <table className="console-table min-w-[960px] w-full">
                <thead>
                  <tr>
                    <th>主体</th>
                    <th>类型</th>
                    <th>状态</th>
                    <th>绑定引用</th>
                    <th>来源</th>
                    <th>记录 ID</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((item) => (
                    <tr key={item.id} className="bg-white/35">
                      <td>
                        <div className="font-semibold text-primary">{item.displayName || item.subjectId}</div>
                        <div className="font-mono text-[11px] text-muted">{item.email || item.subjectId}</div>
                      </td>
                      <td><SubjectPill kind={item.subjectType} /></td>
                      <td className="text-xs text-muted">{item.status}</td>
                      <td className="font-mono text-xs">{item.bindingRefs}</td>
                      <td className="text-xs text-muted">{item.source}</td>
                      <td className="font-mono text-[11px] text-muted">{item.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!subjects.length && !subjectsQuery.isLoading ? (
                <div className="mt-3 rounded-lg bg-white/45 px-4 py-6 text-center text-sm text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">暂无平台主体，请先录入用户或用户组。</div>
              ) : null}
            </section>

            <section className="overflow-auto">
              <table className="console-table min-w-[960px] w-full">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Role</th>
                    <th>Scope</th>
                    <th>Binding ID</th>
                  </tr>
                </thead>
                <tbody>
                  {bindings.map((item) => (
                    <tr key={item.id} className="bg-white/35">
                      <td>
                        <div className="font-semibold text-primary">{item.subjectId}</div>
                        <div className="text-[11px] text-muted">{item.subjectType}</div>
                      </td>
                      <td className="text-xs text-muted">{item.roleName || item.roleId}</td>
                      <td className="font-mono text-xs">{formatScope(item.scope)}</td>
                      <td className="font-mono text-[11px] text-muted">{item.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          <aside className="grid gap-4">
            <section className="console-panel px-4 py-3">
              <div className="text-sm font-semibold text-on-surface">录入用户</div>
              <div className="mt-3 grid gap-3">
                <input className="console-input w-full" placeholder="username" value={username} onChange={(event) => setUsername(event.target.value)} />
                <input className="console-input w-full" placeholder="显示名" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
                <input className="console-input w-full" placeholder="邮箱" value={email} onChange={(event) => setEmail(event.target.value)} />
                <input className="console-input w-full" placeholder="初始密码（至少 8 位）" type="password" value={initialPassword} onChange={(event) => setInitialPassword(event.target.value)} />
              </div>
              <div className="mt-2 text-[11px] leading-5 text-muted">设置初始密码后，该用户可直接登录 NovaObs 平台；后续应补充密码轮换与重置流程。</div>
              <button className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={!canCreateUser || createUserMutation.isPending} onClick={() => createUserMutation.mutate()}>
                <Plus className="h-4 w-4" />
                创建用户
              </button>
            </section>

            <section className="console-panel px-4 py-3">
              <div className="text-sm font-semibold text-on-surface">录入用户组</div>
              <div className="mt-3 grid gap-3">
                <input className="console-input w-full" placeholder="group name" value={groupName} onChange={(event) => setGroupName(event.target.value)} />
                <input className="console-input w-full" placeholder="显示名" value={groupDisplayName} onChange={(event) => setGroupDisplayName(event.target.value)} />
              </div>
              <button className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={!canCreateGroup || createGroupMutation.isPending} onClick={() => createGroupMutation.mutate()}>
                <Plus className="h-4 w-4" />
                创建用户组
              </button>
            </section>

            <section className="console-panel px-4 py-3">
              <div className="text-sm font-semibold text-on-surface">授予角色</div>
              <div className="mt-3 grid gap-3">
                <select className="console-input w-full" value={activeSubjectValue} onChange={(event) => setSelectedSubject(event.target.value)} disabled={!subjects.length}>
                  {!subjects.length ? <option value="">暂无主体</option> : null}
                  {subjects.map((item) => <option key={item.id} value={subjectValue(item)}>{item.displayName || item.subjectId} / {item.subjectType}</option>)}
                </select>
                <select className="console-input w-full" value={activeRole} onChange={(event) => setSelectedRole(event.target.value)} disabled={!roles.length}>
                  {!roles.length ? <option value="">暂无角色</option> : null}
                  {roles.map((item) => <option key={item.id} value={item.id}>{item.name || item.id}</option>)}
                </select>
                <select className="console-input w-full" value={scopeMode} onChange={(event) => setScopeMode(event.target.value as typeof scopeMode)}>
                  <option value="global">global</option>
                  <option value="cluster">cluster</option>
                  <option value="namespace">namespace</option>
                </select>
                {scopeMode !== 'global' ? <input className="console-input w-full" placeholder="cluster id" value={clusterId} onChange={(event) => setClusterId(event.target.value)} /> : null}
                {scopeMode === 'namespace' ? <input className="console-input w-full" placeholder="namespace" value={namespace} onChange={(event) => setNamespace(event.target.value)} /> : null}
              </div>
              <button className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={!canBind || createBindingMutation.isPending} onClick={() => createBindingMutation.mutate()}>
                <ShieldCheck className="h-4 w-4" />
                创建授权绑定
              </button>
            </section>
          </aside>
        </div>
      </DataPanel>
    </div>
  );
}

function AdminMetric({ icon: Icon, label, value, meta }: { icon: typeof UsersRound; label: string; value: string; meta: string }) {
  return (
    <section className="console-panel px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-on-surface">{label}</div>
          <div className="mt-3 truncate font-mono text-2xl font-semibold text-on-surface">{value}</div>
          <div className="mt-2 truncate text-xs text-muted">{meta}</div>
        </div>
        <Icon className="h-4 w-4 shrink-0 text-primary" />
      </div>
    </section>
  );
}

function SubjectPill({ kind }: { kind: string }) {
  return <span className="inline-flex rounded-lg bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">{kind || 'unknown'}</span>;
}

function subjectValue(item?: PlatformSubject) {
  if (!item) return '';
  return `${item.subjectType}:${item.subjectId}`;
}

function splitSubjectValue(value: string) {
  const index = value.indexOf(':');
  if (index === -1) return ['user', value] as const;
  return [value.slice(0, index), value.slice(index + 1)] as const;
}

function formatScope(scope: { global: boolean; clusterId: string; namespace: string; environment: string; serviceId: string }) {
  if (scope.global) return 'global';
  if (scope.serviceId) return `service/${scope.serviceId}`;
  if (scope.namespace) return `${scope.clusterId || '-'}/${scope.namespace}`;
  if (scope.clusterId) return `cluster/${scope.clusterId}`;
  if (scope.environment) return `environment/${scope.environment}`;
  return '-';
}
