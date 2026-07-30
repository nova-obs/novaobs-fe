import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Boxes,
  ExternalLink,
  KeyRound,
  PenLine,
  Plus,
  RefreshCw,
  Trash2,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import { EmptyState } from '../../components/EmptyState';
import { HelpTip } from '../../components/HelpTip';
import type {
  K8sAccessGrant,
  K8sAccessLevel,
  K8sAccessProfile,
  K8sBreakGlassGrant,
  PlatformAdminGrant,
  ProductAccessGrant,
  ProductAccessRole,
} from './accessApi';
import type {
  PlatformGroup,
  PlatformMembership,
  PlatformUser,
} from './api';
import type { IdentityKind } from './PlatformAccessAdminPage';

export function IdentityWorkspace({
  users,
  groups,
  memberships,
  currentUserId,
  onCreateIdentity,
  onCreateMembership,
  onDeleteIdentity,
  onDeleteMembership,
}: {
  users: PlatformUser[];
  groups: PlatformGroup[];
  memberships: PlatformMembership[];
  currentUserId: string;
  onCreateIdentity: () => void;
  onCreateMembership: () => void;
  onDeleteIdentity: (kind: IdentityKind, id: string, label: string) => void;
  onDeleteMembership: (id: string) => void;
}) {
  return (
    <Workspace
      actions={(
        <>
          <button className="console-button" type="button" onClick={onCreateMembership}><UserPlus className="h-4 w-4" />加入用户组</button>
          <PrimaryAction label="创建用户或用户组" onClick={onCreateIdentity} />
        </>
      )}
    >
      <section>
        <SectionTitle icon={<UsersRound className="h-4 w-4" />} title="用户与用户组" meta={`${users.length} 个用户 · ${groups.length} 个用户组`} />
        <Table
          headers={['类型', '名称', '标识', '状态', '操作']}
          rows={[
            ...users.map((user) => [
              '用户',
              user.displayName || user.username,
              user.username,
              user.status,
              currentUserId === user.id
                ? <span className="text-xs text-muted">当前用户</span>
                : <DangerAction key={user.id} label="删除" onClick={() => onDeleteIdentity('user', user.id, user.displayName || user.username)} />,
            ]),
            ...groups.map((group) => [
              '用户组',
              group.displayName || group.name,
              group.name,
              `${group.memberCount} 位成员`,
              <DangerAction key={group.id} label="删除" onClick={() => onDeleteIdentity('group', group.id, group.displayName || group.name)} />,
            ]),
          ]}
          empty="暂无用户或用户组"
        />
      </section>
      <section>
        <SectionTitle icon={<UserPlus className="h-4 w-4" />} title="用户组成员" meta="用户通过用户组继承产品和 K8S 授权" />
        <Table
          headers={['用户组', '用户', '操作']}
          rows={memberships.map((item) => [
            item.groupName || item.groupId,
            item.userDisplayName || item.userId,
            <DangerAction key={item.id} label="移除" onClick={() => onDeleteMembership(item.id)} />,
          ])}
          empty="暂无成员关系"
        />
      </section>
    </Workspace>
  );
}

export function PlatformAdminsWorkspace({
  grants,
  users,
  groups,
  onCreate,
  onDelete,
}: {
  grants: PlatformAdminGrant[];
  users: PlatformUser[];
  groups: PlatformGroup[];
  onCreate: () => void;
  onDelete: (grant: PlatformAdminGrant) => void;
}) {
  return (
    <Workspace actions={<PrimaryAction label="添加平台管理员" onClick={onCreate} />}>
      <div className="console-notice console-notice-warning">
        <AlertTriangle className="h-4 w-4" />
        平台管理员仅管理控制面，不自动获得 Product 数据和 K8S 工作负载权限；最后一名管理员不能撤销。
      </div>
      <Table
        headers={['主体类型', '主体', '创建人', '创建时间', '操作']}
        rows={grants.map((grant) => [
          grant.subjectType,
          subjectLabel(grant.subjectType, grant.subjectId, users, groups),
          grant.createdBy || '-',
          formatTime(grant.createdAt),
          <DangerAction key={grant.id} label="撤销" onClick={() => onDelete(grant)} />,
        ])}
        empty="暂无平台管理员授权"
      />
    </Workspace>
  );
}

export function ProductAccessWorkspace({
  grants,
  groups,
  onCreate,
  onDelete,
}: {
  grants: Array<ProductAccessGrant & { productName: string }>;
  groups: PlatformGroup[];
  onCreate: () => void;
  onDelete: (grant: ProductAccessGrant) => void;
}) {
  return (
    <Workspace actions={<PrimaryAction label="添加产品授权" onClick={onCreate} />}>
      <div className="console-notice">
        <Boxes className="h-4 w-4" />
        产品是唯一业务授权边界，授权自动覆盖其全部服务；不提供服务级授权，也不会产生 K8S 权限。
      </div>
      <Table
        headers={['产品', '用户组', '权限', '创建时间', '操作']}
        rows={grants.map((grant) => [
          grant.productName || grant.productId,
          groups.find((item) => item.id === grant.groupId)?.displayName || grant.groupId,
          productRoleLabel(grant.role),
          formatTime(grant.createdAt),
          <DangerAction key={grant.id} label="撤销" onClick={() => onDelete(grant)} />,
        ])}
        empty="暂无 Product 授权"
      />
    </Workspace>
  );
}

export function K8sProfilesWorkspace({
  profiles,
  grants,
  groups,
  onCreateProfile,
  onCreateGrant,
  onEditProfile,
  onSync,
  onDeleteProfile,
  onDeleteGrant,
}: {
  profiles: K8sAccessProfile[];
  grants: K8sAccessGrant[];
  groups: PlatformGroup[];
  onCreateProfile: () => void;
  onCreateGrant: () => void;
  onEditProfile: (profile: K8sAccessProfile) => void;
  onSync: (id: string) => void;
  onDeleteProfile: (profile: K8sAccessProfile) => void;
  onDeleteGrant: (grant: K8sAccessGrant) => void;
}) {
  return (
    <Workspace
      actions={(
        <>
          <button className="console-button" type="button" onClick={onCreateGrant}><UserPlus className="h-4 w-4" />授权用户组</button>
          <PrimaryAction label="创建命名空间权限" onClick={onCreateProfile} />
        </>
      )}
    >
      <div className="console-notice console-notice-warning">
        <AlertTriangle className="h-4 w-4" />
        命名空间权限覆盖整个命名空间。开发只读仅能查看；命名空间维护可发布、删除、回滚和进入容器终端，并应按机密访问审计。
      </div>
      <section>
        <SectionTitle
          icon={<KeyRound className="h-4 w-4" />}
          title={(
            <span className="inline-flex items-center gap-2">
              命名空间权限
              <HelpTip content="系统内部称为 K8S Access Profile：它把一个集群、固定权限等级和若干命名空间组合为可分配模板。点击“下发到集群”会校验并修复 NovaAPM 管理的 Kubernetes RBAC。" label="命名空间权限说明" />
            </span>
          )}
          meta="固定两级权限，不允许空命名空间或全局范围"
        />
        <Table
          headers={['名称', '集群', '权限等级', '命名空间', '下发状态', '操作']}
          rows={profiles.map((profile) => [
            profile.name,
            profile.clusterId,
            k8sLevelLabel(profile.accessLevel),
            profile.namespaces.join(', '),
            `${profileStatusLabel(profile.status)} / ${driftStateLabel(profile.driftState)}`,
            <div key={profile.id} className="flex gap-2">
              <button className="console-table-action" type="button" onClick={() => onEditProfile(profile)}><PenLine className="h-3.5 w-3.5" />编辑</button>
              <button className="console-table-action" type="button" onClick={() => onSync(profile.id)}><RefreshCw className="h-3.5 w-3.5" />下发到集群</button>
              <DangerAction label="删除" onClick={() => onDeleteProfile(profile)} />
            </div>,
          ])}
          empty="暂无命名空间权限"
        />
      </section>
      <section>
        <SectionTitle icon={<UsersRound className="h-4 w-4" />} title="用户组授权" meta="SRE、开发、测试负责人均通过用户组获得命名空间权限" />
        <Table
          headers={['用户组', '命名空间权限', '创建人', '创建时间', '操作']}
          rows={grants.map((grant) => [
            groups.find((group) => group.id === grant.groupId)?.displayName || grant.groupId,
            profiles.find((profile) => profile.id === grant.profileId)?.name || grant.profileId,
            grant.createdBy || '-',
            formatTime(grant.createdAt),
            <DangerAction key={grant.id} label="撤销" onClick={() => onDeleteGrant(grant)} />,
          ])}
          empty="暂无 K8S 用户组授权"
        />
      </section>
    </Workspace>
  );
}

export function BreakGlassWorkspace({
  grants,
  currentUserId,
  approvalMinutes,
  setApprovalMinutes,
  onRequest,
  onApprove,
  onRevoke,
}: {
  grants: K8sBreakGlassGrant[];
  currentUserId: string;
  approvalMinutes: number;
  setApprovalMinutes: (minutes: number) => void;
  onRequest: () => void;
  onApprove: (grant: K8sBreakGlassGrant) => void;
  onRevoke: (grant: K8sBreakGlassGrant) => void;
}) {
  return (
    <Workspace actions={<PrimaryAction label="申请紧急访问" onClick={onRequest} />}>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="console-notice console-notice-warning">
          <AlertTriangle className="h-4 w-4" />
          紧急访问（Break Glass）必须由另一名平台管理员审批，最长 120 分钟，到期立即失效。进入容器终端时只记录会话元数据，不记录终端输出或环境变量。
        </div>
        <label className="text-xs font-semibold text-muted">
          审批时长（分钟）
          <input
            className="console-input mt-1.5 w-full"
            type="number"
            min={1}
            max={120}
            value={approvalMinutes}
            onChange={(event) => setApprovalMinutes(Number(event.target.value))}
          />
        </label>
      </div>
      <Table
        headers={['申请人', '集群', '原因', '状态/有效期', '审计', '操作']}
        rows={grants.map((grant) => [
          grant.requesterUserId,
          grant.clusterId,
          grant.reason,
          `${breakGlassStatusLabel(grant.status)} / ${formatTime(grant.expiresAt)}`,
          <Link key={`audit-${grant.id}`} className="console-table-action" to={`/k8s/clusters/${encodeURIComponent(grant.clusterId)}/audit`}>
            <ExternalLink className="h-3.5 w-3.5" />审计
          </Link>,
          <div key={grant.id} className="flex gap-2">
            {grant.status === 'requested' && grant.requesterUserId !== currentUserId ? (
              <button className="console-table-action" type="button" onClick={() => onApprove(grant)}>批准</button>
            ) : null}
            {grant.status === 'approved' ? <DangerAction label="撤销" onClick={() => onRevoke(grant)} /> : null}
            {grant.status === 'requested' && grant.requesterUserId === currentUserId ? <span className="text-xs text-muted">等待他人审批</span> : null}
          </div>,
        ])}
        empty="暂无紧急访问记录"
      />
    </Workspace>
  );
}

function Workspace({ actions, children }: { actions: ReactNode; children: ReactNode }) {
  return (
    <div className="platform-access-workspace console-workbench grid min-w-0 gap-4">
      <div className="console-list-toolbar justify-end">{actions}</div>
      {children}
    </div>
  );
}

function profileStatusLabel(status: string) {
  if (status === 'active') return '已启用';
  if (status === 'inactive') return '已停用';
  return status || '未知';
}

function driftStateLabel(state: string) {
  if (state === 'in_sync') return '已下发';
  if (state === 'drifted') return '存在漂移';
  if (state === 'pending') return '待下发';
  if (state === 'sync_failed') return '下发失败';
  return state || '待检查';
}

function breakGlassStatusLabel(status: string) {
  if (status === 'requested') return '待审批';
  if (status === 'approved') return '已生效';
  if (status === 'revoked') return '已撤销';
  if (status === 'expired') return '已过期';
  return status || '未知';
}

function SectionTitle({ icon, title, meta }: { icon: ReactNode; title: ReactNode; meta: string }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-on-surface">{icon}{title}</h2>
      <span className="text-xs text-muted">{meta}</span>
    </div>
  );
}

function Table({ headers, rows, empty }: { headers: string[]; rows: ReactNode[][]; empty: string }) {
  if (!rows.length) return <EmptyState title={empty} />;
  return (
    <div className="console-resource-list min-w-0 overflow-x-auto">
      <table className="console-table min-w-[760px] w-full">
        <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PrimaryAction({ label, onClick }: { label: string; onClick: () => void }) {
  return <button className="console-button console-button-primary" type="button" onClick={onClick}><Plus className="h-4 w-4" />{label}</button>;
}

function DangerAction({ label, onClick }: { label: string; onClick: () => void }) {
  return <button className="console-table-action console-table-action-danger" type="button" onClick={onClick}><Trash2 className="h-3.5 w-3.5" />{label}</button>;
}

function productRoleLabel(role: ProductAccessRole) {
  return role === 'product-maintainer' ? '产品维护者' : '产品查看者';
}

function k8sLevelLabel(level: K8sAccessLevel) {
  return level === 'namespace-maintainer' ? '命名空间维护' : '开发只读';
}

function formatTime(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN');
}

function subjectLabel(
  subjectType: string,
  subjectId: string,
  users: PlatformUser[],
  groups: PlatformGroup[],
) {
  if (subjectType === 'group') return groups.find((item) => item.id === subjectId)?.displayName || subjectId;
  return users.find((item) => item.id === subjectId)?.displayName || subjectId;
}
