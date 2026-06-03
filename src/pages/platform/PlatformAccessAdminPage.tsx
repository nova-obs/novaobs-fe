import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, KeyRound, Link2, Plus, ShieldAlert, ShieldCheck, Trash2, UserRoundCog, UsersRound } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import {
  platformApi,
  type PlatformBinding,
  type PlatformGroup,
  type PlatformPermission,
  type PlatformRole,
  type PlatformScope,
  type PlatformServiceAccount,
  type PlatformSubject,
  type PlatformUser,
} from './api';

type PlatformAdminTab = 'users' | 'groups' | 'service-accounts' | 'roles' | 'bindings' | 'effective';

const platformAdminTabs: { key: PlatformAdminTab; label: string; meta: string }[] = [
  { key: 'users', label: '用户', meta: '登录账号' },
  { key: 'groups', label: '用户组', meta: '成员关系' },
  { key: 'service-accounts', label: '服务账号', meta: '自动化主体' },
  { key: 'roles', label: '角色', meta: '权限集合' },
  { key: 'bindings', label: '授权绑定', meta: '主体到角色' },
  { key: 'effective', label: '有效权限', meta: '继承预览' },
];

interface SubjectDeleteTarget {
  subjectId: string;
  subjectType: string;
  source?: string;
}

export function PlatformAccessAdminPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<PlatformAdminTab>('users');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [initialPassword, setInitialPassword] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupDisplayName, setGroupDisplayName] = useState('');
  const [serviceAccountName, setServiceAccountName] = useState('');
  const [serviceAccountDisplayName, setServiceAccountDisplayName] = useState('');
  const [serviceAccountOwner, setServiceAccountOwner] = useState('');
  const [serviceAccountDescription, setServiceAccountDescription] = useState('');
  const [memberGroupId, setMemberGroupId] = useState('');
  const [memberSubject, setMemberSubject] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [scopeMode, setScopeMode] = useState<'global' | 'cluster' | 'namespace'>('global');
  const [clusterId, setClusterId] = useState('');
  const [namespace, setNamespace] = useState('');
  const [lastBinding, setLastBinding] = useState<PlatformBinding | null>(null);
  const [roleId, setRoleId] = useState('');
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [rolePermissions, setRolePermissions] = useState('k8s.resource:read:namespace');
  const [confirmDeleteKey, setConfirmDeleteKey] = useState('');

  const meQuery = useQuery({ queryKey: ['platform-me'], queryFn: () => platformApi.me(), retry: false });
  const subjectsQuery = useQuery({ queryKey: ['platform-subjects'], queryFn: () => platformApi.listSubjects(), retry: false });
  const usersQuery = useQuery({ queryKey: ['platform-users'], queryFn: () => platformApi.listUsers(), retry: false });
  const groupsQuery = useQuery({ queryKey: ['platform-groups'], queryFn: () => platformApi.listGroups(), retry: false });
  const membershipsQuery = useQuery({ queryKey: ['platform-group-memberships'], queryFn: () => platformApi.listMemberships(), retry: false });
  const serviceAccountsQuery = useQuery({ queryKey: ['platform-service-accounts'], queryFn: () => platformApi.listServiceAccounts(), retry: false });
  const rolesQuery = useQuery({ queryKey: ['platform-roles'], queryFn: () => platformApi.listRoles(), retry: false });
  const bindingsQuery = useQuery({ queryKey: ['platform-bindings'], queryFn: () => platformApi.listBindings(), retry: false });

  const subjects = subjectsQuery.data ?? [];
  const roles = rolesQuery.data ?? [];
  const bindings = bindingsQuery.data ?? [];
  const memberships = membershipsQuery.data ?? [];
  const users = usersQuery.data ?? [];
  const groups = groupsQuery.data ?? [];
  const serviceAccounts = serviceAccountsQuery.data ?? [];
  const firstSubjectValue = subjectValue(subjects[0]);
  const activeSubjectValue = selectedSubject || firstSubjectValue;
  const activePreviewSubject = previewSubject || activeSubjectValue;
  const assignableMemberSubjects = useMemo(
    () => subjects.filter((item) => item.subjectType !== 'group'),
    [subjects],
  );
  const assignableMemberSubjectValues = useMemo(
    () => new Set(assignableMemberSubjects.map((item) => subjectValue(item))),
    [assignableMemberSubjects],
  );
  const firstMemberSubjectValue = subjectValue(assignableMemberSubjects[0]);
  const activeMemberSubjectValue = assignableMemberSubjectValues.has(memberSubject) ? memberSubject : firstMemberSubjectValue;
  const activeRole = selectedRole || roles[0]?.id || '';

  const effectiveQuery = useQuery({
    queryKey: ['platform-effective-permissions', activePreviewSubject],
    queryFn: () => {
      const [subjectType, subjectId] = splitSubjectValue(activePreviewSubject);
      return platformApi.effectivePermissions({ subjectId, subjectType });
    },
    enabled: Boolean(activePreviewSubject),
    retry: false,
  });
  const effectivePermissions = effectiveQuery.data ?? [];

  const invalidatePlatformIAM = () => {
    queryClient.invalidateQueries({ queryKey: ['platform-me'] });
    queryClient.invalidateQueries({ queryKey: ['platform-subjects'] });
    queryClient.invalidateQueries({ queryKey: ['platform-users'] });
    queryClient.invalidateQueries({ queryKey: ['platform-groups'] });
    queryClient.invalidateQueries({ queryKey: ['platform-service-accounts'] });
    queryClient.invalidateQueries({ queryKey: ['platform-group-memberships'] });
    queryClient.invalidateQueries({ queryKey: ['platform-roles'] });
    queryClient.invalidateQueries({ queryKey: ['platform-bindings'] });
    queryClient.invalidateQueries({ queryKey: ['platform-effective-permissions'] });
    queryClient.invalidateQueries({ queryKey: ['k8s-platform-subjects'] });
    queryClient.invalidateQueries({ queryKey: ['k8s-platform-access-bindings'] });
  };

  const createUserMutation = useMutation({
    mutationFn: () => platformApi.createUser({ username, displayName, email, password: initialPassword }),
    onSuccess: () => {
      setUsername('');
      setDisplayName('');
      setEmail('');
      setInitialPassword('');
      invalidatePlatformIAM();
    },
  });
  const createGroupMutation = useMutation({
    mutationFn: () => platformApi.createGroup({ name: groupName, displayName: groupDisplayName }),
    onSuccess: () => {
      setGroupName('');
      setGroupDisplayName('');
      invalidatePlatformIAM();
    },
  });
  const createServiceAccountMutation = useMutation({
    mutationFn: () => platformApi.createServiceAccount({
      name: serviceAccountName,
      displayName: serviceAccountDisplayName,
      owner: serviceAccountOwner,
      description: serviceAccountDescription,
    }),
    onSuccess: () => {
      setServiceAccountName('');
      setServiceAccountDisplayName('');
      setServiceAccountOwner('');
      setServiceAccountDescription('');
      invalidatePlatformIAM();
    },
  });
  const createMembershipMutation = useMutation({
    mutationFn: () => {
      const [subjectType, subjectId] = splitSubjectValue(activeMemberSubjectValue);
      return platformApi.createMembership({ groupId: memberGroupId || groups[0]?.id || '', subjectId, subjectType });
    },
    onSuccess: invalidatePlatformIAM,
  });
  const deleteMembershipMutation = useMutation({
    mutationFn: (id: string) => platformApi.deleteMembership(id),
    onSuccess: () => {
      setConfirmDeleteKey('');
      invalidatePlatformIAM();
    },
  });
  const deleteSubjectMutation = useMutation<unknown, Error, SubjectDeleteTarget>({
    mutationFn: (item) => deletePlatformSubject(item),
    onSuccess: () => {
      setConfirmDeleteKey('');
      invalidatePlatformIAM();
    },
  });
  const createRoleMutation = useMutation({
    mutationFn: () => platformApi.createRole({ id: roleId, name: roleName, description: roleDescription, permissions: parsePermissionLines(rolePermissions) }),
    onSuccess: () => {
      setRoleId('');
      setRoleName('');
      setRoleDescription('');
      invalidatePlatformIAM();
    },
  });
  const deleteRoleMutation = useMutation({
    mutationFn: (id: string) => platformApi.deleteRole(id),
    onSuccess: () => {
      setConfirmDeleteKey('');
      invalidatePlatformIAM();
    },
  });
  const createBindingMutation = useMutation({
    mutationFn: () => {
      const [subjectType, subjectId] = splitSubjectValue(activeSubjectValue);
      return platformApi.createBinding({
        subjectId,
        subjectType,
        roleId: activeRole,
        scope: {
          global: scopeMode === 'global',
          clusterId: scopeMode === 'global' ? '' : clusterId,
          namespace: scopeMode === 'namespace' ? namespace : '',
        },
      });
    },
    onSuccess: (result) => {
      setLastBinding(result.item ?? null);
      invalidatePlatformIAM();
    },
  });
  const deleteBindingMutation = useMutation({
    mutationFn: (id: string) => platformApi.deleteBinding(id),
    onSuccess: () => {
      setConfirmDeleteKey('');
      invalidatePlatformIAM();
    },
  });

  const permissionError = useMemo(() => {
    const error = meQuery.error || subjectsQuery.error || usersQuery.error || groupsQuery.error || membershipsQuery.error || serviceAccountsQuery.error || rolesQuery.error || bindingsQuery.error || effectiveQuery.error || createUserMutation.error || createGroupMutation.error || createServiceAccountMutation.error || createMembershipMutation.error || deleteMembershipMutation.error || deleteSubjectMutation.error || createRoleMutation.error || deleteRoleMutation.error || createBindingMutation.error || deleteBindingMutation.error;
    const message = error?.message ?? '';
    return message.includes('无权') || message.includes('permission_denied') ? message : '';
  }, [meQuery.error, subjectsQuery.error, usersQuery.error, groupsQuery.error, membershipsQuery.error, serviceAccountsQuery.error, rolesQuery.error, bindingsQuery.error, effectiveQuery.error, createUserMutation.error, createGroupMutation.error, createServiceAccountMutation.error, createMembershipMutation.error, deleteMembershipMutation.error, deleteSubjectMutation.error, createRoleMutation.error, deleteRoleMutation.error, createBindingMutation.error, deleteBindingMutation.error]);

  const canCreateUser = Boolean(username.trim() && displayName.trim() && initialPassword.trim().length >= 8);
  const canCreateGroup = Boolean(groupName.trim() && groupDisplayName.trim());
  const canCreateServiceAccount = Boolean(serviceAccountName.trim() && serviceAccountDisplayName.trim());
  const canCreateMembership = Boolean((memberGroupId || groups[0]?.id) && activeMemberSubjectValue);
  const canCreateRole = Boolean(roleName.trim() && parsePermissionLines(rolePermissions).length);
  const canBind = Boolean(activeSubjectValue && activeRole && (scopeMode === 'global' || clusterId.trim()) && (scopeMode !== 'namespace' || namespace.trim()));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <AdminMetric icon={UserRoundCog} label="当前主体" value={meQuery.data?.subjectId || '-'} meta={meQuery.data?.subjectType || 'request subject'} />
        <AdminMetric icon={UsersRound} label="用户 / 组 / SA" value={`${users.length} / ${groups.length} / ${serviceAccounts.length}`} meta="local identity directory" />
        <AdminMetric icon={ShieldCheck} label="角色" value={String(roles.length)} meta="custom platform role set" />
        <AdminMetric icon={KeyRound} label="授权绑定" value={String(bindings.length)} meta={lastBinding?.id || 'scoped RBAC grant'} />
      </div>

      <DataPanel title="平台用户权限" meta="users / groups / service accounts / roles / bindings" action={<PlatformTabNav activeTab={activeTab} onChange={setActiveTab} />}>
        {permissionError ? (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            <ShieldAlert className="h-4 w-4" />
            权限不足：当前用户缺少 `platform.iam:manage`。
          </div>
        ) : null}

        {activeTab === 'users' ? (
          <TabWorkspace
            table={<UsersTable users={users} current={meQuery.data} confirmDeleteKey={confirmDeleteKey} pending={deleteSubjectMutation.isPending} onConfirmKey={setConfirmDeleteKey} onDelete={(item) => deleteSubjectMutation.mutate(item)} />}
            side={<CreateUserPanel username={username} displayName={displayName} email={email} initialPassword={initialPassword} pending={createUserMutation.isPending} canSubmit={canCreateUser} setUsername={setUsername} setDisplayName={setDisplayName} setEmail={setEmail} setInitialPassword={setInitialPassword} onSubmit={() => createUserMutation.mutate()} />}
          />
        ) : null}

        {activeTab === 'groups' ? (
          <TabWorkspace
            table={(
              <div className="grid gap-4">
                <GroupsTable groups={groups} current={meQuery.data} confirmDeleteKey={confirmDeleteKey} pending={deleteSubjectMutation.isPending} onConfirmKey={setConfirmDeleteKey} onDelete={(item) => deleteSubjectMutation.mutate(item)} />
                <MembershipsTable memberships={memberships} confirmDeleteKey={confirmDeleteKey} pending={deleteMembershipMutation.isPending} onConfirmKey={setConfirmDeleteKey} onDelete={(id) => deleteMembershipMutation.mutate(id)} />
              </div>
            )}
            side={<GroupEditorPanel groupName={groupName} groupDisplayName={groupDisplayName} groups={groups} assignableMemberSubjects={assignableMemberSubjects} activeMemberSubjectValue={activeMemberSubjectValue} memberGroupId={memberGroupId} createGroupPending={createGroupMutation.isPending} createMembershipPending={createMembershipMutation.isPending} canCreateGroup={canCreateGroup} canCreateMembership={canCreateMembership} setGroupName={setGroupName} setGroupDisplayName={setGroupDisplayName} setMemberGroupId={setMemberGroupId} setMemberSubject={setMemberSubject} onCreateGroup={() => createGroupMutation.mutate()} onCreateMembership={() => createMembershipMutation.mutate()} />}
          />
        ) : null}

        {activeTab === 'service-accounts' ? (
          <TabWorkspace
            table={<ServiceAccountsTable serviceAccounts={serviceAccounts} confirmDeleteKey={confirmDeleteKey} pending={deleteSubjectMutation.isPending} onConfirmKey={setConfirmDeleteKey} onDelete={(item) => deleteSubjectMutation.mutate(item)} />}
            side={<CreateServiceAccountPanel name={serviceAccountName} displayName={serviceAccountDisplayName} owner={serviceAccountOwner} description={serviceAccountDescription} pending={createServiceAccountMutation.isPending} canSubmit={canCreateServiceAccount} setName={setServiceAccountName} setDisplayName={setServiceAccountDisplayName} setOwner={setServiceAccountOwner} setDescription={setServiceAccountDescription} onSubmit={() => createServiceAccountMutation.mutate()} />}
          />
        ) : null}

        {activeTab === 'roles' ? (
          <TabWorkspace
            table={<RolesTable roles={roles} confirmDeleteKey={confirmDeleteKey} pending={deleteRoleMutation.isPending} onConfirmKey={setConfirmDeleteKey} onDelete={(id) => deleteRoleMutation.mutate(id)} />}
            side={<CreateRolePanel roleId={roleId} roleName={roleName} roleDescription={roleDescription} rolePermissions={rolePermissions} pending={createRoleMutation.isPending} canSubmit={canCreateRole} setRoleId={setRoleId} setRoleName={setRoleName} setRoleDescription={setRoleDescription} setRolePermissions={setRolePermissions} onSubmit={() => createRoleMutation.mutate()} />}
          />
        ) : null}

        {activeTab === 'bindings' ? (
          <TabWorkspace
            table={<BindingsTable bindings={bindings} confirmDeleteKey={confirmDeleteKey} pending={deleteBindingMutation.isPending} onConfirmKey={setConfirmDeleteKey} onDelete={(id) => deleteBindingMutation.mutate(id)} />}
            side={<BindingEditorPanel subjects={subjects} roles={roles} activeSubjectValue={activeSubjectValue} activeRole={activeRole} scopeMode={scopeMode} clusterId={clusterId} namespace={namespace} pending={createBindingMutation.isPending} canSubmit={canBind} setSelectedSubject={setSelectedSubject} setSelectedRole={setSelectedRole} setScopeMode={setScopeMode} setClusterId={setClusterId} setNamespace={setNamespace} onSubmit={() => createBindingMutation.mutate()} />}
          />
        ) : null}

        {activeTab === 'effective' ? (
          <EffectivePermissionsWorkspace subjects={subjects} activePreviewSubject={activePreviewSubject} effectivePermissions={effectivePermissions} isLoading={effectiveQuery.isLoading} setPreviewSubject={setPreviewSubject} />
        ) : null}
      </DataPanel>
    </div>
  );
}

function PlatformTabNav({ activeTab, onChange }: { activeTab: PlatformAdminTab; onChange: (tab: PlatformAdminTab) => void }) {
  return (
    <div className="flex max-w-full flex-wrap gap-1 rounded-lg bg-surface-low px-1 py-1">
      {platformAdminTabs.map((tab) => (
        <button
          key={tab.key}
          className={`rounded-md px-3 py-1.5 text-left text-xs font-semibold transition ${tab.key === activeTab ? 'bg-white text-primary shadow-sm' : 'text-muted hover:bg-white/55 hover:text-on-surface'}`}
          onClick={() => onChange(tab.key)}
        >
          <span className="block">{tab.label}</span>
          <span className="block text-[10px] font-medium opacity-75">{tab.meta}</span>
        </button>
      ))}
    </div>
  );
}

function TabWorkspace({ table, side }: { table: ReactNode; side: ReactNode }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0">{table}</div>
      <aside className="grid content-start gap-4">{side}</aside>
    </div>
  );
}

function UsersTable({ users, current, confirmDeleteKey, pending, onConfirmKey, onDelete }: { users: PlatformUser[]; current?: PlatformSubject; confirmDeleteKey: string; pending: boolean; onConfirmKey: (value: string) => void; onDelete: (target: SubjectDeleteTarget) => void }) {
  return (
    <section className="overflow-auto">
      <table className="console-table min-w-[900px] w-full">
        <thead>
          <tr>
            <th>用户</th>
            <th>邮箱</th>
            <th>密码</th>
            <th>状态</th>
            <th>来源</th>
            <th className="sticky right-0 bg-surface-lowest/95 shadow-[-8px_0_12px_rgba(216,226,239,0.45)]">操作</th>
          </tr>
        </thead>
        <tbody>
          {users.map((item) => {
            const target = { subjectId: item.id, subjectType: 'user', source: item.source };
            const protectReason = subjectDeleteBlockReason(target, current);
            return (
              <tr key={item.id} className="bg-white/35">
                <td>
                  <div className="font-semibold text-primary">{item.displayName || item.username}</div>
                  <div className="font-mono text-[11px] text-muted">{item.id}</div>
                </td>
                <td className="text-xs text-muted">{item.email || '-'}</td>
                <td className="text-xs text-muted">{item.passwordSet ? '已设置' : '未设置'}</td>
                <td className="text-xs text-muted">{item.status}</td>
                <td className="text-xs text-muted">{item.source}</td>
                <td className="sticky right-0 bg-white/95 shadow-[-8px_0_12px_rgba(216,226,239,0.45)]">
                  {protectReason ? <ProtectedHint label={protectReason} /> : <DeleteActionButton id={`subject:user:${item.id}`} confirmKey={confirmDeleteKey} label="删除" pending={pending} setConfirmKey={onConfirmKey} onDelete={() => onDelete(target)} />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!users.length ? <EmptyState text="暂无本地用户，请先创建登录账号。" /> : null}
    </section>
  );
}

function GroupsTable({ groups, current, confirmDeleteKey, pending, onConfirmKey, onDelete }: { groups: PlatformGroup[]; current?: PlatformSubject; confirmDeleteKey: string; pending: boolean; onConfirmKey: (value: string) => void; onDelete: (target: SubjectDeleteTarget) => void }) {
  return (
    <section className="overflow-auto">
      <div className="mb-2 text-sm font-semibold text-on-surface">用户组</div>
      <table className="console-table min-w-[820px] w-full">
        <thead>
          <tr>
            <th>用户组</th>
            <th>成员数</th>
            <th>状态</th>
            <th>来源</th>
            <th>描述</th>
            <th className="sticky right-0 bg-surface-lowest/95 shadow-[-8px_0_12px_rgba(216,226,239,0.45)]">操作</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((item) => {
            const target = { subjectId: item.id, subjectType: 'group', source: item.source };
            const protectReason = subjectDeleteBlockReason(target, current);
            return (
              <tr key={item.id} className="bg-white/35">
                <td>
                  <div className="font-semibold text-primary">{item.displayName || item.name}</div>
                  <div className="font-mono text-[11px] text-muted">{item.id}</div>
                </td>
                <td className="font-mono text-xs">{item.memberCount}</td>
                <td className="text-xs text-muted">{item.status}</td>
                <td className="text-xs text-muted">{item.source}</td>
                <td className="max-w-[260px] truncate text-xs text-muted">{item.description || '-'}</td>
                <td className="sticky right-0 bg-white/95 shadow-[-8px_0_12px_rgba(216,226,239,0.45)]">
                  {protectReason ? <ProtectedHint label={protectReason} /> : <DeleteActionButton id={`subject:group:${item.id}`} confirmKey={confirmDeleteKey} label="删除" pending={pending} setConfirmKey={onConfirmKey} onDelete={() => onDelete(target)} />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!groups.length ? <EmptyState text="暂无用户组。" /> : null}
    </section>
  );
}

function MembershipsTable({ memberships, confirmDeleteKey, pending, onConfirmKey, onDelete }: { memberships: any[]; confirmDeleteKey: string; pending: boolean; onConfirmKey: (value: string) => void; onDelete: (id: string) => void }) {
  return (
    <section className="overflow-auto">
      <div className="mb-2 text-sm font-semibold text-on-surface">组成员</div>
      <table className="console-table min-w-[720px] w-full">
        <thead>
          <tr>
            <th>用户组</th>
            <th>成员</th>
            <th>类型</th>
            <th className="sticky right-0 bg-surface-lowest/95 shadow-[-8px_0_12px_rgba(216,226,239,0.45)]">操作</th>
          </tr>
        </thead>
        <tbody>
          {memberships.map((item) => (
            <tr key={item.id} className="bg-white/35">
              <td>
                <div className="font-semibold text-primary">{item.groupName || item.groupId}</div>
                <div className="font-mono text-[11px] text-muted">{item.groupId}</div>
              </td>
              <td>
                <div className="font-semibold text-on-surface">{item.subjectDisplayName || item.subjectId}</div>
                <div className="font-mono text-[11px] text-muted">{item.subjectId}</div>
              </td>
              <td><SubjectPill kind={item.subjectType} /></td>
              <td className="sticky right-0 bg-white/95 shadow-[-8px_0_12px_rgba(216,226,239,0.45)]">
                <DeleteActionButton id={`membership:${item.id}`} confirmKey={confirmDeleteKey} label="移出" confirmingLabel="确认移出" pending={pending} setConfirmKey={onConfirmKey} onDelete={() => onDelete(item.id)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!memberships.length ? <EmptyState text="暂无组成员。" /> : null}
    </section>
  );
}

function ServiceAccountsTable({ serviceAccounts, confirmDeleteKey, pending, onConfirmKey, onDelete }: { serviceAccounts: PlatformServiceAccount[]; confirmDeleteKey: string; pending: boolean; onConfirmKey: (value: string) => void; onDelete: (target: SubjectDeleteTarget) => void }) {
  return (
    <section className="overflow-auto">
      <table className="console-table min-w-[860px] w-full">
        <thead>
          <tr>
            <th>服务账号</th>
            <th>Owner</th>
            <th>描述</th>
            <th>更新时间</th>
            <th className="sticky right-0 bg-surface-lowest/95 shadow-[-8px_0_12px_rgba(216,226,239,0.45)]">操作</th>
          </tr>
        </thead>
        <tbody>
          {serviceAccounts.map((item) => {
            const target = { subjectId: item.id, subjectType: 'service-account' };
            return (
              <tr key={item.id} className="bg-white/35">
                <td>
                  <div className="font-semibold text-primary">{item.displayName || item.name}</div>
                  <div className="font-mono text-[11px] text-muted">{item.id}</div>
                </td>
                <td className="text-xs text-muted">{item.owner || '-'}</td>
                <td className="max-w-[320px] truncate text-xs text-muted">{item.description || '-'}</td>
                <td className="font-mono text-[11px] text-muted">{item.updatedAt || '-'}</td>
                <td className="sticky right-0 bg-white/95 shadow-[-8px_0_12px_rgba(216,226,239,0.45)]">
                  <DeleteActionButton id={`subject:service-account:${item.id}`} confirmKey={confirmDeleteKey} label="删除" pending={pending} setConfirmKey={onConfirmKey} onDelete={() => onDelete(target)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!serviceAccounts.length ? <EmptyState text="暂无服务账号。" /> : null}
    </section>
  );
}

function RolesTable({ roles, confirmDeleteKey, pending, onConfirmKey, onDelete }: { roles: PlatformRole[]; confirmDeleteKey: string; pending: boolean; onConfirmKey: (value: string) => void; onDelete: (id: string) => void }) {
  return (
    <section className="overflow-auto">
      <table className="console-table min-w-[900px] w-full">
        <thead>
          <tr>
            <th>角色</th>
            <th>权限数</th>
            <th>描述</th>
            <th>Role ID</th>
            <th className="sticky right-0 bg-surface-lowest/95 shadow-[-8px_0_12px_rgba(216,226,239,0.45)]">操作</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((item) => (
            <tr key={item.id} className="bg-white/35">
              <td>
                <div className="font-semibold text-primary">{item.name || item.id}</div>
                <div className="mt-0.5 text-[11px] text-muted">平台角色</div>
              </td>
              <td className="font-mono text-xs">{item.permissions.length}</td>
              <td className="max-w-[320px] truncate text-xs text-muted">{item.description || '-'}</td>
              <td className="font-mono text-[11px] text-muted">{item.id}</td>
              <td className="sticky right-0 bg-white/95 shadow-[-8px_0_12px_rgba(216,226,239,0.45)]">
                <DeleteActionButton id={`role:${item.id}`} confirmKey={confirmDeleteKey} label="删除" pending={pending} setConfirmKey={onConfirmKey} onDelete={() => onDelete(item.id)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!roles.length ? <EmptyState text="暂无角色。开发态 dev-admin 不通过角色授予权限。" /> : null}
    </section>
  );
}

function BindingsTable({ bindings, confirmDeleteKey, pending, onConfirmKey, onDelete }: { bindings: PlatformBinding[]; confirmDeleteKey: string; pending: boolean; onConfirmKey: (value: string) => void; onDelete: (id: string) => void }) {
  return (
    <section className="overflow-auto">
      <table className="console-table min-w-[960px] w-full">
        <thead>
          <tr>
            <th>Subject</th>
            <th>Role</th>
            <th>Scope</th>
            <th>Binding ID</th>
            <th className="sticky right-0 bg-surface-lowest/95 shadow-[-8px_0_12px_rgba(216,226,239,0.45)]">操作</th>
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
              <td className="sticky right-0 bg-white/95 shadow-[-8px_0_12px_rgba(216,226,239,0.45)]">
                <DeleteActionButton id={`binding:${item.id}`} confirmKey={confirmDeleteKey} label="删除" pending={pending} setConfirmKey={onConfirmKey} onDelete={() => onDelete(item.id)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!bindings.length ? <EmptyState text="暂无授权绑定。" /> : null}
    </section>
  );
}

function EffectivePermissionsWorkspace({ subjects, activePreviewSubject, effectivePermissions, isLoading, setPreviewSubject }: { subjects: PlatformSubject[]; activePreviewSubject: string; effectivePermissions: any[]; isLoading: boolean; setPreviewSubject: (value: string) => void }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <section className="console-panel px-4 py-3">
        <div className="text-sm font-semibold text-on-surface">选择主体</div>
        <select className="console-input mt-3 w-full" value={activePreviewSubject} onChange={(event) => setPreviewSubject(event.target.value)} disabled={!subjects.length}>
          {!subjects.length ? <option value="">暂无主体</option> : null}
          {subjects.map((item) => <option key={item.id} value={subjectValue(item)}>{item.displayName || item.subjectId} / {item.subjectType}</option>)}
        </select>
        <div className="mt-3 rounded-lg bg-white/50 px-3 py-3 text-xs leading-5 text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
          这里聚合直接授权与用户组继承，适合排查“为什么这个用户有某个模块权限”。
        </div>
      </section>
      <section className="overflow-auto">
        <table className="console-table min-w-[820px] w-full">
          <thead>
            <tr>
              <th>来源</th>
              <th>Role</th>
              <th>Scope</th>
              <th>权限</th>
            </tr>
          </thead>
          <tbody>
            {effectivePermissions.map((item) => (
              <tr key={item.bindingId} className="bg-white/35">
                <td>
                  <div className="font-semibold text-primary">{item.grantedVia === 'group' ? '用户组继承' : '直接授权'}</div>
                  <div className="font-mono text-[11px] text-muted">{item.grantedToType}/{item.grantedToSubjectId}</div>
                </td>
                <td className="text-xs text-muted">{item.roleName || item.roleId}</td>
                <td className="font-mono text-xs">{formatScope(item.scope)}</td>
                <td className="text-xs text-muted">{item.permissions.map((permission: PlatformPermission) => `${permission.resource}:${permission.action}:${permission.scopeMode}`).join(' · ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!effectivePermissions.length && !isLoading ? <EmptyState text="当前主体暂无有效权限。" /> : null}
      </section>
    </div>
  );
}

function CreateUserPanel(props: {
  username: string;
  displayName: string;
  email: string;
  initialPassword: string;
  pending: boolean;
  canSubmit: boolean;
  setUsername: (value: string) => void;
  setDisplayName: (value: string) => void;
  setEmail: (value: string) => void;
  setInitialPassword: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <section className="console-panel px-4 py-3">
      <PanelTitle icon={UserRoundCog} title="录入用户" meta="创建后可登录 NovaObs" />
      <div className="mt-3 grid gap-3">
        <input className="console-input w-full" placeholder="username" value={props.username} onChange={(event) => props.setUsername(event.target.value)} />
        <input className="console-input w-full" placeholder="显示名" value={props.displayName} onChange={(event) => props.setDisplayName(event.target.value)} />
        <input className="console-input w-full" placeholder="邮箱" value={props.email} onChange={(event) => props.setEmail(event.target.value)} />
        <input className="console-input w-full" placeholder="初始密码（至少 8 位）" type="password" value={props.initialPassword} onChange={(event) => props.setInitialPassword(event.target.value)} />
      </div>
      <PrimaryAction label="创建用户" disabled={!props.canSubmit || props.pending} icon={Plus} onClick={props.onSubmit} />
    </section>
  );
}

function GroupEditorPanel(props: {
  groupName: string;
  groupDisplayName: string;
  groups: PlatformGroup[];
  assignableMemberSubjects: PlatformSubject[];
  activeMemberSubjectValue: string;
  memberGroupId: string;
  createGroupPending: boolean;
  createMembershipPending: boolean;
  canCreateGroup: boolean;
  canCreateMembership: boolean;
  setGroupName: (value: string) => void;
  setGroupDisplayName: (value: string) => void;
  setMemberGroupId: (value: string) => void;
  setMemberSubject: (value: string) => void;
  onCreateGroup: () => void;
  onCreateMembership: () => void;
}) {
  return (
    <>
      <section className="console-panel px-4 py-3">
        <PanelTitle icon={UsersRound} title="录入用户组" meta="承载平台与模块授权" />
        <div className="mt-3 grid gap-3">
          <input className="console-input w-full" placeholder="group name" value={props.groupName} onChange={(event) => props.setGroupName(event.target.value)} />
          <input className="console-input w-full" placeholder="显示名" value={props.groupDisplayName} onChange={(event) => props.setGroupDisplayName(event.target.value)} />
        </div>
        <PrimaryAction label="创建用户组" disabled={!props.canCreateGroup || props.createGroupPending} icon={Plus} onClick={props.onCreateGroup} />
      </section>
      <section className="console-panel px-4 py-3">
        <PanelTitle icon={Link2} title="维护组成员" meta="把用户或服务账号加入组" />
        <div className="mt-3 grid gap-3">
          <select className="console-input w-full" value={props.memberGroupId || props.groups[0]?.id || ''} onChange={(event) => props.setMemberGroupId(event.target.value)} disabled={!props.groups.length}>
            {!props.groups.length ? <option value="">暂无用户组</option> : null}
            {props.groups.map((item) => <option key={item.id} value={item.id}>{item.displayName || item.name}</option>)}
          </select>
          <select className="console-input w-full" value={props.activeMemberSubjectValue} onChange={(event) => props.setMemberSubject(event.target.value)} disabled={!props.assignableMemberSubjects.length}>
            {!props.assignableMemberSubjects.length ? <option value="">暂无可加入主体</option> : null}
            {props.assignableMemberSubjects.map((item) => <option key={item.id} value={subjectValue(item)}>{item.displayName || item.subjectId} / {item.subjectType}</option>)}
          </select>
        </div>
        <PrimaryAction label="加入用户组" disabled={!props.canCreateMembership || props.createMembershipPending} icon={Plus} onClick={props.onCreateMembership} />
      </section>
    </>
  );
}

function CreateServiceAccountPanel(props: {
  name: string;
  displayName: string;
  owner: string;
  description: string;
  pending: boolean;
  canSubmit: boolean;
  setName: (value: string) => void;
  setDisplayName: (value: string) => void;
  setOwner: (value: string) => void;
  setDescription: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <section className="console-panel px-4 py-3">
      <PanelTitle icon={Bot} title="录入服务账号" meta="用于自动化或外部系统" />
      <div className="mt-3 grid gap-3">
        <input className="console-input w-full" placeholder="service account name" value={props.name} onChange={(event) => props.setName(event.target.value)} />
        <input className="console-input w-full" placeholder="显示名" value={props.displayName} onChange={(event) => props.setDisplayName(event.target.value)} />
        <input className="console-input w-full" placeholder="owner" value={props.owner} onChange={(event) => props.setOwner(event.target.value)} />
        <textarea className="console-input min-h-20 w-full resize-y" placeholder="描述" value={props.description} onChange={(event) => props.setDescription(event.target.value)} />
      </div>
      <PrimaryAction label="创建服务账号" disabled={!props.canSubmit || props.pending} icon={Plus} onClick={props.onSubmit} />
    </section>
  );
}

function CreateRolePanel(props: {
  roleId: string;
  roleName: string;
  roleDescription: string;
  rolePermissions: string;
  pending: boolean;
  canSubmit: boolean;
  setRoleId: (value: string) => void;
  setRoleName: (value: string) => void;
  setRoleDescription: (value: string) => void;
  setRolePermissions: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <section className="console-panel px-4 py-3">
      <PanelTitle icon={ShieldCheck} title="创建角色" meta="resource:action:scopeMode" />
      <div className="mt-3 grid gap-3">
        <input className="console-input w-full" placeholder="role id（可选）" value={props.roleId} onChange={(event) => props.setRoleId(event.target.value)} />
        <input className="console-input w-full" placeholder="角色名称" value={props.roleName} onChange={(event) => props.setRoleName(event.target.value)} />
        <input className="console-input w-full" placeholder="描述" value={props.roleDescription} onChange={(event) => props.setRoleDescription(event.target.value)} />
        <textarea className="console-input min-h-[120px] w-full resize-y font-mono text-xs" value={props.rolePermissions} onChange={(event) => props.setRolePermissions(event.target.value)} />
      </div>
      <div className="mt-2 text-[11px] leading-5 text-muted">每行一个权限，例如 k8s.resource:read:namespace。</div>
      <PrimaryAction label="创建角色" disabled={!props.canSubmit || props.pending} icon={Plus} onClick={props.onSubmit} />
    </section>
  );
}

function BindingEditorPanel(props: {
  subjects: PlatformSubject[];
  roles: PlatformRole[];
  activeSubjectValue: string;
  activeRole: string;
  scopeMode: 'global' | 'cluster' | 'namespace';
  clusterId: string;
  namespace: string;
  pending: boolean;
  canSubmit: boolean;
  setSelectedSubject: (value: string) => void;
  setSelectedRole: (value: string) => void;
  setScopeMode: (value: 'global' | 'cluster' | 'namespace') => void;
  setClusterId: (value: string) => void;
  setNamespace: (value: string) => void;
  onSubmit: () => void;
}) {
  const [subjectType, subjectId] = splitSubjectValue(props.activeSubjectValue);
  const activeRole = props.roles.find((item) => item.id === props.activeRole);
  return (
    <section className="console-panel px-4 py-3">
      <PanelTitle icon={KeyRound} title="创建授权绑定" meta="主体 + 角色 + 作用域" />
      <div className="mt-3 grid gap-3">
        <select className="console-input w-full" value={props.activeSubjectValue} onChange={(event) => props.setSelectedSubject(event.target.value)} disabled={!props.subjects.length}>
          {!props.subjects.length ? <option value="">暂无主体</option> : null}
          {props.subjects.map((item) => <option key={item.id} value={subjectValue(item)}>{item.displayName || item.subjectId} / {item.subjectType}</option>)}
        </select>
        <select className="console-input w-full" value={props.activeRole} onChange={(event) => props.setSelectedRole(event.target.value)} disabled={!props.roles.length}>
          {!props.roles.length ? <option value="">暂无角色</option> : null}
          {props.roles.map((item) => <option key={item.id} value={item.id}>{item.name || item.id}</option>)}
        </select>
        <select className="console-input w-full" value={props.scopeMode} onChange={(event) => props.setScopeMode(event.target.value as 'global' | 'cluster' | 'namespace')}>
          <option value="global">global</option>
          <option value="cluster">cluster</option>
          <option value="namespace">namespace</option>
        </select>
        {props.scopeMode !== 'global' ? <input className="console-input w-full" placeholder="cluster id" value={props.clusterId} onChange={(event) => props.setClusterId(event.target.value)} /> : null}
        {props.scopeMode === 'namespace' ? <input className="console-input w-full" placeholder="namespace" value={props.namespace} onChange={(event) => props.setNamespace(event.target.value)} /> : null}
      </div>
      <div className="mt-3 rounded-lg bg-white/50 px-3 py-3 text-xs leading-5 text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
        <div className="font-semibold text-on-surface">授权摘要</div>
        <div className="mt-2 font-mono">subject={subjectType}/{subjectId || '-'}</div>
        <div className="font-mono">role={activeRole?.name || props.activeRole || '-'}</div>
        <div className="font-mono">scope={props.scopeMode === 'global' ? 'global' : props.scopeMode === 'namespace' ? `${props.clusterId || '-'}/${props.namespace || '-'}` : `cluster/${props.clusterId || '-'}`}</div>
      </div>
      <PrimaryAction label="创建授权绑定" disabled={!props.canSubmit || props.pending} icon={ShieldCheck} onClick={props.onSubmit} />
    </section>
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

function PanelTitle({ icon: Icon, title, meta }: { icon: typeof UsersRound; title: string; meta: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div>
        <div className="text-sm font-semibold text-on-surface">{title}</div>
        <div className="mt-1 text-[11px] text-muted">{meta}</div>
      </div>
    </div>
  );
}

function PrimaryAction({ label, icon: Icon, disabled, onClick }: { label: string; icon: typeof Plus; disabled: boolean; onClick: () => void }) {
  return (
    <button className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60" disabled={disabled} onClick={onClick}>
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function SubjectPill({ kind }: { kind: string }) {
  return <span className="inline-flex rounded-lg bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">{kind || 'unknown'}</span>;
}

function ProtectedHint({ label }: { label: string }) {
  return <span className="inline-flex rounded-lg bg-white/60 px-2 py-1 text-[11px] font-semibold text-muted">{label}</span>;
}

function DeleteActionButton({
  id,
  label,
  confirmingLabel = '确认删除',
  confirmKey,
  pending,
  setConfirmKey,
  onDelete,
}: {
  id: string;
  label: string;
  confirmingLabel?: string;
  confirmKey: string;
  pending: boolean;
  setConfirmKey: (value: string) => void;
  onDelete: () => void;
}) {
  const confirming = confirmKey === id;
  return (
    <button
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition ${confirming ? 'bg-danger text-white' : 'bg-white/70 text-danger hover:bg-danger/10'}`}
      disabled={pending}
      onClick={() => {
        if (!confirming) {
          setConfirmKey(id);
          return;
        }
        onDelete();
      }}
    >
      <Trash2 className="h-3.5 w-3.5" />
      {confirming ? confirmingLabel : label}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="mt-3 rounded-lg bg-white/45 px-4 py-6 text-center text-sm text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">{text}</div>;
}

function subjectValue(item?: PlatformSubject) {
  if (!item) return '';
  return `${item.subjectType}:${item.subjectId}`;
}

function deletePlatformSubject(item: SubjectDeleteTarget): Promise<unknown> {
  switch (item.subjectType) {
    case 'user':
      return platformApi.deleteUser(item.subjectId);
    case 'group':
      return platformApi.deleteGroup(item.subjectId);
    case 'service-account':
      return platformApi.deleteServiceAccount(item.subjectId);
    default:
      return Promise.reject(new Error('不支持删除该主体'));
  }
}

function subjectDeleteBlockReason(item: SubjectDeleteTarget, current?: PlatformSubject) {
  if (item.source === 'binding') return '绑定派生';
  if (current && item.subjectType === current.subjectType && item.subjectId === current.subjectId) return '当前用户';
  if (item.subjectType === 'user' && item.subjectId === 'dev-admin') return '保留账号';
  if (!['user', 'group', 'service-account'].includes(item.subjectType)) return '不支持';
  return '';
}

function splitSubjectValue(value: string) {
  const index = value.indexOf(':');
  if (index === -1) return ['user', value] as const;
  return [value.slice(0, index), value.slice(index + 1)] as const;
}

function parsePermissionLines(value: string): PlatformPermission[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [resource = '', action = '', scopeMode = 'global'] = line.split(':').map((part) => part.trim());
      return { resource, action, scopeMode };
    })
    .filter((permission) => permission.resource && permission.action && permission.scopeMode);
}

function formatScope(scope: PlatformScope) {
  if (scope.global) return 'global';
  if (scope.serviceId) return `service/${scope.serviceId}`;
  if (scope.namespace) return `${scope.clusterId || '-'}/${scope.namespace}`;
  if (scope.clusterId) return `cluster/${scope.clusterId}`;
  if (scope.environment) return `environment/${scope.environment}`;
  return '-';
}
