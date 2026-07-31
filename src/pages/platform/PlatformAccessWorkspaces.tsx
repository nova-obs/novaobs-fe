import { Fragment, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  PenLine,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import { HelpTip } from '../../components/HelpTip';
import { StatusBadge } from '../../components/StatusBadge';
import { Chips, Identity, ListSection, Pill, RowActions } from './PlatformAccessListSection';
import type { Product } from '../../services/types';
import type {
  K8sAccessGrant,
  K8sAccessLevel,
  K8sAccessProfile,
  K8sBreakGlassGrant,
  PlatformAdminGrant,
  ProductAccessGrant,
} from './accessApi';
import type {
  PlatformGroup,
  PlatformMembership,
  PlatformUser,
} from './api';
import type { IdentityKind } from './PlatformAccessAdminPage';

/** 三条授权边界的说明在每个页面都成立，做成 HelpTip 而不是通栏提示条，避免每页都吃掉首屏。 */
const boundaryHelp = '平台控制面、产品与 K8s 工作负载是三条独立授权边界；平台管理员不会自动获得产品数据或工作负载权限。';

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
  onCreateMembership: (groupId?: string) => void;
  onDeleteIdentity: (kind: IdentityKind, id: string, label: string) => void;
  onDeleteMembership: (id: string) => void;
}) {
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([]);
  const emailsById = new Map(users.map((user) => [user.id, user.email]));
  const membersByGroup = new Map<string, PlatformMembership[]>();
  const groupNamesByUser = new Map<string, string[]>();
  memberships.forEach((membership) => {
    membersByGroup.set(membership.groupId, [...(membersByGroup.get(membership.groupId) ?? []), membership]);
    const groupLabel = groups.find((group) => group.id === membership.groupId)?.displayName
      || membership.groupName
      || membership.groupId;
    groupNamesByUser.set(membership.userId, [...(groupNamesByUser.get(membership.userId) ?? []), groupLabel]);
  });
  const toggleGroup = (groupId: string) => setExpandedGroupIds((current) => (
    current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId]
  ));

  return (
    <Workspace
      title="用户与用户组"
      description="用户只能通过用户组继承产品和 K8s 授权。"
      help={boundaryHelp}
      actions={(
        <>
          <button className="console-button" type="button" onClick={() => onCreateMembership()}><UserPlus className="h-4 w-4" />加入用户组</button>
          <PrimaryAction label="创建用户或用户组" onClick={onCreateIdentity} />
        </>
      )}
    >
      <ListSection
        icon={<UsersRound className="h-4 w-4" />}
        title="用户"
        items={users}
        searchPlaceholder="搜索用户名、邮箱"
        searchText={(user) => [user.username, user.email].join(' ')}
        filters={[{
          id: 'status',
          label: '全部状态',
          options: uniqueOptions(users.map((user) => user.status)),
          match: (user, value) => user.status === value,
        }]}
        headers={['用户', '邮箱', '状态', '所属用户组', '操作']}
        empty="暂无用户"
        renderRows={(pagedUsers) => pagedUsers.map((user) => (
          <tr key={user.id}>
            <td><Identity primary={user.username} internalId={user.id} /></td>
            <td className="text-xs text-muted">{user.email || '-'}</td>
            <td><StatusBadge value={user.status} appearance="inline" /></td>
            <td><Chips values={groupNamesByUser.get(user.id) ?? []} /></td>
            <td>
              <RowActions>
                {currentUserId === user.id
                  ? <span className="text-xs text-muted">当前用户</span>
                  : <DangerAction label="删除" onClick={() => onDeleteIdentity('user', user.id, user.username)} />}
              </RowActions>
            </td>
          </tr>
        ))}
      />

      <ListSection
        icon={<UserPlus className="h-4 w-4" />}
        title="用户组"
        items={groups}
        searchPlaceholder="搜索用户组名称、标识"
        searchText={(group) => [group.displayName, group.name, group.description].join(' ')}
        headers={['用户组', '标识 / 邮箱', '成员', '操作']}
        empty="暂无用户组"
        minWidth="min-w-[640px]"
        renderRows={(pagedGroups) => pagedGroups.map((group) => {
          const members = membersByGroup.get(group.id) ?? [];
          const expanded = expandedGroupIds.includes(group.id);
          return (
            <Fragment key={group.id}>
              <tr className="product-catalog-product-row" data-group-id={group.id}>
                <td>
                  <div className="flex min-w-0 items-center gap-1.5">
                    <button
                      className="shrink-0"
                      type="button"
                      aria-expanded={expanded}
                      aria-label={`${expanded ? '折叠' : '展开'}用户组 ${group.displayName || group.name}`}
                      onClick={() => toggleGroup(group.id)}
                    >
                      {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted" /> : <ChevronRight className="h-3.5 w-3.5 text-muted" />}
                    </button>
                    <Link
                      className="truncate font-semibold text-on-surface hover:text-primary"
                      to={`/platform/groups/${encodeURIComponent(group.id)}`}
                    >
                      {group.displayName || group.name}
                    </Link>
                  </div>
                  {group.description ? <div className="ml-5 mt-1 truncate text-[11px] text-muted">{group.description}</div> : null}
                </td>
                <td className="font-mono text-xs text-muted">{group.name}</td>
                <td className="text-xs text-muted">{members.length || group.memberCount} 位成员</td>
                <td>
                  <RowActions>
                    <Link className="console-table-action" to={`/platform/groups/${encodeURIComponent(group.id)}`}>
                      <ShieldCheck className="h-3.5 w-3.5" />查看授权
                    </Link>
                    <button className="console-table-action" type="button" onClick={() => onCreateMembership(group.id)}><UserPlus className="h-3.5 w-3.5" />添加成员</button>
                    <DangerAction label="删除" onClick={() => onDeleteIdentity('group', group.id, group.displayName || group.name)} />
                  </RowActions>
                </td>
              </tr>
              {expanded && members.length === 0 ? (
                <tr className="console-subrow">
                  <td className="console-subrow-cell console-subrow-cell-last" colSpan={4}>
                    <span className="text-xs text-muted">该用户组还没有成员</span>
                  </td>
                </tr>
              ) : null}
              {expanded ? members.map((membership, index) => (
                <tr className="console-subrow" key={membership.id}>
                  <td className={`console-subrow-cell ${index === members.length - 1 ? 'console-subrow-cell-last' : ''}`}>
                    <span className="text-sm text-on-surface">{membership.username || membership.userId}</span>
                  </td>
                  <td className="text-xs text-muted">{emailsById.get(membership.userId) || '-'}</td>
                  <td className="text-xs text-muted">成员</td>
                  <td>
                    <RowActions>
                      <DangerAction label="移除" onClick={() => onDeleteMembership(membership.id)} />
                    </RowActions>
                  </td>
                </tr>
              )) : null}
            </Fragment>
          );
        })}
      />
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
    <Workspace
      title="平台管理员授权"
      description="向用户或用户组授予平台控制面管理权限；最后一项授权不可撤销。"
      help={`${boundaryHelp}平台管理员不自动获得产品数据和 K8s 工作负载权限。`}
      actions={<PrimaryAction label="添加平台管理员" onClick={onCreate} />}
    >
      <ListSection
        items={grants}
        searchPlaceholder="搜索主体、创建人"
        searchText={(grant) => [
          subjectLabel(grant.subjectType, grant.subjectId, users, groups),
          grant.createdBy,
        ].join(' ')}
        filters={[{
          id: 'subjectType',
          label: '全部主体类型',
          options: [{ value: 'user', label: '用户' }, { value: 'group', label: '用户组' }],
          match: (grant, value) => grant.subjectType === value,
        }]}
        headers={['主体类型', '主体', '创建人', '创建时间', '操作']}
        empty="暂无平台管理员授权"
        renderRows={(pagedGrants) => pagedGrants.map((grant) => (
          <tr key={grant.id}>
            <td className="text-xs text-muted">{grant.subjectType === 'group' ? '用户组' : '用户'}</td>
            <td>
              <span className="font-semibold text-on-surface" title={grant.subjectId}>
                {subjectLabel(grant.subjectType, grant.subjectId, users, groups)}
              </span>
            </td>
            <td className="text-xs text-muted">{grant.createdBy || '-'}</td>
            <td className="text-xs text-muted">{formatTime(grant.createdAt)}</td>
            <td><RowActions><DangerAction label="撤销" onClick={() => onDelete(grant)} /></RowActions></td>
          </tr>
        ))}
      />
    </Workspace>
  );
}

export function ProductAccessWorkspace({
  grants,
  products,
  groups,
  loading,
  onCreate,
  onEdit,
  onDelete,
}: {
  grants: ProductAccessGrant[];
  products: Product[];
  groups: PlatformGroup[];
  loading: boolean;
  onCreate: (productId?: string) => void;
  onEdit: (grant: ProductAccessGrant) => void;
  onDelete: (grant: ProductAccessGrant) => void;
}) {
  const [expandedProductIds, setExpandedProductIds] = useState<string[]>([]);
  const productsById = new Map(products.map((product) => [product.id, product]));
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  /** 同一个产品通常授权给多个用户组，平铺时一个产品会占满整页；父行按产品聚合，用户组收进子行。 */
  const productRows = buildProductAccessRows(grants, productsById, groupsById);
  const toggleProduct = (productId: string) => setExpandedProductIds((current) => (
    current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId]
  ));
  return (
    <Workspace
      title="产品访问授权"
      description="管理产品、用户组与权限等级之间的授权关系。"
      help={`${boundaryHelp}只有平台管理员可以分配、调整或撤销产品权限；产品维护者不具备转授权能力，平台管理权也不会自动获得产品数据访问。`}
      actions={<PrimaryAction label="添加产品访问授权" onClick={() => onCreate()} />}
    >
      {loading ? <div className="console-skeleton h-48" /> : <ListSection
        items={productRows}
        searchPlaceholder="搜索产品或用户组"
        searchText={(row) => row.searchText}
        filters={[
          {
            id: 'product',
            label: '全部产品',
            /* 选项只列出已有授权的产品，避免选中后必然落到空结果。 */
            options: productRows.map((row) => ({ value: row.productId, label: row.name })),
            match: (row, value) => row.productId === value,
          },
          {
            id: 'role',
            label: '全部权限等级',
            options: [
              { value: 'product-viewer', label: '产品查看者' },
              { value: 'product-maintainer', label: '产品维护者' },
            ],
            match: (row, value) => row.grants.some((grant) => grant.role === value),
          },
          {
            id: 'status',
            label: '全部产品状态',
            options: [
              { value: 'active', label: '活动' },
              { value: 'archived', label: '已归档' },
            ],
            match: (row, value) => row.product?.status === value,
          },
        ]}
        headers={['产品', '权限等级', '生效范围', '已授权', '最近更新', '操作']}
        empty="暂无产品访问授权"
        minWidth="min-w-[900px]"
        renderRows={(pagedRows) => pagedRows.map((row) => {
          const expanded = expandedProductIds.includes(row.productId);
          const archived = row.product?.status === 'archived';
          return (
            <Fragment key={row.productId}>
              <tr className="product-catalog-product-row" data-product-id={row.productId}>
                <td>
                  <div className="flex min-w-0 items-center gap-1.5">
                    <button
                      className="shrink-0"
                      type="button"
                      aria-expanded={expanded}
                      aria-label={`${expanded ? '折叠' : '展开'}产品 ${row.name} 的已授权用户组`}
                      onClick={() => toggleProduct(row.productId)}
                    >
                      {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted" /> : <ChevronRight className="h-3.5 w-3.5 text-muted" />}
                    </button>
                    <Identity primary={row.name} secondary={row.product?.key || row.productId} internalId={row.productId} />
                    {row.product ? <span className="shrink-0"><StatusBadge value={row.product.status} appearance="inline" /></span> : null}
                  </div>
                </td>
                {/* 父行给的是权限等级的分布，具体哪个用户组拿到哪一级要展开子行才算数。 */}
                <td>
                  <div className="flex flex-wrap items-center gap-1">
                    {row.maintainerCount > 0 ? <Pill tone="warning" label={`产品维护者 ${row.maintainerCount}`} /> : null}
                    {row.viewerCount > 0 ? <Pill tone="neutral" label={`产品查看者 ${row.viewerCount}`} /> : null}
                  </div>
                </td>
                <td><span className="text-xs text-muted">产品下全部服务</span></td>
                <td className="whitespace-nowrap text-xs text-muted">{row.grants.length} 个用户组</td>
                <td>
                  <Identity primary={row.latestBy} secondary={formatTime(row.latestAt)} />
                </td>
                <td>
                  <RowActions>
                    {archived ? (
                      <span className="text-xs text-muted" title="归档产品不能新增或提升授权，只能撤销现有关系">只可撤销</span>
                    ) : row.product ? (
                      <button className="console-table-action" type="button" onClick={() => onCreate(row.productId)}>
                        <UserPlus className="h-3.5 w-3.5" />授权用户组
                      </button>
                    ) : null}
                  </RowActions>
                </td>
              </tr>
              {/* 子行不复用父行的列语义，授权来源合并成一格，避免字段落在不相干的表头下。 */}
              {expanded ? row.grants.map((grant, index) => {
                const group = groupsById.get(grant.groupId);
                return (
                  <tr className="console-subrow" key={grant.id}>
                    <td className={`console-subrow-cell ${index === row.grants.length - 1 ? 'console-subrow-cell-last' : ''}`}>
                      <Link
                        className="truncate text-sm text-on-surface hover:text-primary"
                        to={`/platform/groups/${encodeURIComponent(grant.groupId)}`}
                      >
                        {group?.displayName || group?.name || '未知用户组'}
                      </Link>
                      <div className="truncate font-mono text-[11px] text-muted">
                        {`${group?.name || grant.groupId}${group ? ` · ${group.memberCount} 名成员` : ''}`}
                      </div>
                    </td>
                    <td><Pill tone={grant.role === 'product-maintainer' ? 'warning' : 'neutral'} label={productRoleLabel(grant.role)} /></td>
                    <td className="text-xs text-muted" colSpan={3}>
                      由 {grant.updatedBy || grant.createdBy || '未知'} 于 {formatTime(grant.updatedAt || grant.createdAt)} 更新
                    </td>
                    <td>
                      <RowActions>
                        {archived ? null : (
                          <button className="console-table-action" type="button" onClick={() => onEdit(grant)}>
                            <PenLine className="h-3.5 w-3.5" />修改
                          </button>
                        )}
                        <DangerAction label="撤销" onClick={() => onDelete(grant)} />
                      </RowActions>
                    </td>
                  </tr>
                );
              }) : null}
            </Fragment>
          );
        })}
      />}
    </Workspace>
  );
}

interface ProductAccessRow {
  productId: string;
  product?: Product;
  name: string;
  grants: ProductAccessGrant[];
  maintainerCount: number;
  viewerCount: number;
  latestAt: string;
  latestBy: string;
  searchText: string;
}

/**
 * 按产品聚合授权关系。
 * 产品目录里已经不存在的 productId 也保留成一行（显示为“未知产品”），否则这些残留授权在页面上无法撤销。
 */
function buildProductAccessRows(
  grants: ProductAccessGrant[],
  productsById: Map<string, Product>,
  groupsById: Map<string, PlatformGroup>,
): ProductAccessRow[] {
  const grantsByProduct = new Map<string, ProductAccessGrant[]>();
  grants.forEach((grant) => {
    grantsByProduct.set(grant.productId, [...(grantsByProduct.get(grant.productId) ?? []), grant]);
  });
  return [...grantsByProduct.entries()].map(([productId, productGrants]) => {
    const product = productsById.get(productId);
    const groupLabelOf = (grant: ProductAccessGrant) => {
      const group = groupsById.get(grant.groupId);
      return group?.displayName || group?.name || grant.groupId;
    };
    const sortedGrants = [...productGrants].sort((a, b) => groupLabelOf(a).localeCompare(groupLabelOf(b), 'zh-CN'));
    // 父行的“最近更新”取该产品下最新的一条子行，而不是任意一条。
    const latest = sortedGrants.reduce((newest, grant) => (grantTime(grant) > grantTime(newest) ? grant : newest));
    return {
      productId,
      product,
      name: product?.name || '未知产品',
      grants: sortedGrants,
      maintainerCount: sortedGrants.filter((grant) => grant.role === 'product-maintainer').length,
      viewerCount: sortedGrants.filter((grant) => grant.role === 'product-viewer').length,
      latestAt: latest.updatedAt || latest.createdAt,
      latestBy: latest.updatedBy || latest.createdBy || '-',
      // 折叠后子行不参与匹配，所以用户组名要提前并进产品行的搜索文本。
      searchText: [
        product?.name,
        product?.key,
        productId,
        ...sortedGrants.flatMap((grant) => {
          const group = groupsById.get(grant.groupId);
          return [group?.displayName, group?.name, grant.groupId];
        }),
      ].filter(Boolean).join(' '),
    };
  }).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
}

function grantTime(grant: ProductAccessGrant) {
  const time = new Date(grant.updatedAt || grant.createdAt).getTime();
  return Number.isNaN(time) ? 0 : time;
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
  onCreateGrant: (profileId?: string) => void;
  onEditProfile: (profile: K8sAccessProfile) => void;
  onSync: (id: string) => void;
  onDeleteProfile: (profile: K8sAccessProfile) => void;
  onDeleteGrant: (grant: K8sAccessGrant) => void;
}) {
  const [expandedProfileIds, setExpandedProfileIds] = useState<string[]>([]);
  const grantsByProfile = new Map<string, K8sAccessGrant[]>();
  grants.forEach((grant) => {
    grantsByProfile.set(grant.profileId, [...(grantsByProfile.get(grant.profileId) ?? []), grant]);
  });
  const toggleProfile = (profileId: string) => setExpandedProfileIds((current) => (
    current.includes(profileId) ? current.filter((id) => id !== profileId) : [...current, profileId]
  ));

  return (
    <Workspace
      title="K8s 集群授权"
      description="按集群、权限级别与命名空间建立授权策略，并分配给用户组。"
      help={(
        <>
          {boundaryHelp}
          <br />
          系统内部称为 K8s Access Profile：把一个集群、固定权限等级和若干命名空间组合为可分配模板。点击“下发到集群”会校验并修复 NovaAPM 管理的 Kubernetes RBAC。
          <br />
          开发只读仅能查看；命名空间维护可发布、删除、回滚和进入容器终端，并应按机密访问审计。
        </>
      )}
      actions={(
        <>
          <button className="console-button" type="button" onClick={() => onCreateGrant()}><UserPlus className="h-4 w-4" />授权用户组</button>
          <PrimaryAction label="创建命名空间权限" onClick={onCreateProfile} />
        </>
      )}
    >
      <ListSection
        items={profiles}
        searchPlaceholder="搜索名称、集群、命名空间"
        searchText={(profile) => [profile.name, profile.clusterId, ...profile.namespaces].join(' ')}
        filters={[
          {
            id: 'cluster',
            label: '全部集群',
            options: uniqueOptions(profiles.map((profile) => profile.clusterId)),
            match: (profile, value) => profile.clusterId === value,
          },
          {
            id: 'level',
            label: '全部权限等级',
            options: [
              { value: 'developer', label: '开发只读' },
              { value: 'namespace-maintainer', label: '命名空间维护' },
            ],
            match: (profile, value) => profile.accessLevel === value,
          },
          {
            id: 'drift',
            label: '全部下发状态',
            options: [
              { value: 'in_sync', label: '已下发' },
              { value: 'pending', label: '待下发' },
              { value: 'drifted', label: '存在漂移' },
              { value: 'sync_failed', label: '下发失败' },
            ],
            match: (profile, value) => profile.driftState === value,
          },
        ]}
        headers={['名称', '集群', '权限等级', '命名空间', '下发状态', '已授权', '操作']}
        empty="暂无命名空间权限"
        minWidth="min-w-[1040px]"
        renderRows={(pagedProfiles) => pagedProfiles.map((profile) => {
          const profileGrants = grantsByProfile.get(profile.id) ?? [];
          const expanded = expandedProfileIds.includes(profile.id);
          return (
            <Fragment key={profile.id}>
              <tr className="product-catalog-product-row" data-profile-id={profile.id}>
                <td>
                  <div className="flex min-w-0 items-center gap-1.5">
                    <button
                      className="shrink-0"
                      type="button"
                      aria-expanded={expanded}
                      aria-label={`${expanded ? '折叠' : '展开'}命名空间权限 ${profile.name} 的已授权用户组`}
                      onClick={() => toggleProfile(profile.id)}
                    >
                      {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted" /> : <ChevronRight className="h-3.5 w-3.5 text-muted" />}
                    </button>
                    <span className="truncate font-semibold text-on-surface" title={profile.id}>{profile.name}</span>
                    {/* 已启用是常态，只把停用这种例外状态显式标出来，省下一整列宽度。 */}
                    {profile.status === 'active' ? null : <Pill tone="neutral" label={profileStatusLabel(profile.status)} />}
                  </div>
                </td>
                <td className="whitespace-nowrap font-mono text-xs text-muted">{profile.clusterId}</td>
                <td><Pill tone={k8sLevelTone(profile.accessLevel)} label={k8sLevelLabel(profile.accessLevel)} /></td>
                <td><Chips values={profile.namespaces} /></td>
                <td><Pill tone={driftStateTone(profile.driftState)} label={driftStateLabel(profile.driftState)} /></td>
                <td className="whitespace-nowrap text-xs text-muted">{profileGrants.length} 个用户组</td>
                <td>
                  <RowActions>
                    <button className="console-table-action" type="button" onClick={() => onCreateGrant(profile.id)}><UserPlus className="h-3.5 w-3.5" />授权</button>
                    <button className="console-table-action" type="button" onClick={() => onEditProfile(profile)}><PenLine className="h-3.5 w-3.5" />编辑</button>
                    <button className="console-table-action" type="button" onClick={() => onSync(profile.id)}><RefreshCw className="h-3.5 w-3.5" />下发到集群</button>
                    <DangerAction label="删除" onClick={() => onDeleteProfile(profile)} />
                  </RowActions>
                </td>
              </tr>
              {expanded && profileGrants.length === 0 ? (
                <tr className="console-subrow">
                  <td className="console-subrow-cell console-subrow-cell-last" colSpan={7}>
                    <span className="text-xs text-muted">该命名空间权限还没有授权给任何用户组</span>
                  </td>
                </tr>
              ) : null}
              {/* 子行不复用父行的列语义，合并成一格描述，避免字段落在不相干的表头下。 */}
              {expanded ? profileGrants.map((grant, index) => (
                <tr className="console-subrow" key={grant.id}>
                  <td className={`console-subrow-cell ${index === profileGrants.length - 1 ? 'console-subrow-cell-last' : ''}`}>
                    <Link className="text-sm text-on-surface hover:text-primary" to={`/platform/groups/${encodeURIComponent(grant.groupId)}`}>
                      {groupLabel(groups, grant.groupId)}
                    </Link>
                  </td>
                  <td className="text-xs text-muted" colSpan={5}>
                    由 {grant.createdBy || '未知'} 于 {formatTime(grant.createdAt)} 授权
                  </td>
                  <td>
                    <RowActions>
                      <DangerAction label="撤销" onClick={() => onDeleteGrant(grant)} />
                    </RowActions>
                  </td>
                </tr>
              )) : null}
            </Fragment>
          );
        })}
      />
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
    <Workspace
      title="K8s 紧急访问"
      description="申请和审批集群临时高权限；授权最长 120 分钟，到期自动失效。"
      help="紧急访问必须由另一名平台管理员审批，最长 120 分钟，到期立即失效。进入容器终端时只记录会话元数据，不记录终端输出或环境变量。"
      actions={(
        <>
          <label className="flex items-center gap-2 whitespace-nowrap text-xs font-semibold text-muted">
            审批时长（分钟）
            <input
              className="console-input h-8 w-20"
              type="number"
              min={1}
              max={120}
              value={approvalMinutes}
              onChange={(event) => setApprovalMinutes(Number(event.target.value))}
            />
          </label>
          <PrimaryAction label="申请紧急访问" onClick={onRequest} />
        </>
      )}
    >
      <ListSection
        items={grants}
        searchPlaceholder="搜索申请人、集群、原因"
        searchText={(grant) => [grant.requesterUserId, grant.clusterId, grant.reason].join(' ')}
        filters={[{
          id: 'status',
          label: '全部状态',
          options: [
            { value: 'requested', label: '待审批' },
            { value: 'approved', label: '已生效' },
            { value: 'revoked', label: '已撤销' },
            { value: 'expired', label: '已过期' },
          ],
          match: (grant, value) => grant.status === value,
        }]}
        headers={['申请人', '集群', '原因', '状态', '有效期至', '操作']}
        empty="暂无紧急访问记录"
        minWidth="min-w-[880px]"
        renderRows={(pagedGrants) => pagedGrants.map((grant) => (
          <tr key={grant.id}>
            <td className="text-sm text-on-surface">{grant.requesterUserId}</td>
            <td className="font-mono text-xs text-muted">{grant.clusterId}</td>
            <td className="max-w-[260px] truncate text-xs text-muted" title={grant.reason}>{grant.reason}</td>
            <td><Pill tone={breakGlassTone(grant.status)} label={breakGlassStatusLabel(grant.status)} /></td>
            <td className="whitespace-nowrap text-xs text-muted">{formatTime(grant.expiresAt)}</td>
            <td>
              <RowActions>
                {grant.status === 'requested' && grant.requesterUserId !== currentUserId ? (
                  <button className="console-table-action" type="button" onClick={() => onApprove(grant)}>批准</button>
                ) : null}
                {grant.status === 'approved' ? <DangerAction label="撤销" onClick={() => onRevoke(grant)} /> : null}
                {grant.status === 'requested' && grant.requesterUserId === currentUserId ? <span className="text-xs text-muted">等待他人审批</span> : null}
                <Link className="console-table-action" to={`/k8s/clusters/${encodeURIComponent(grant.clusterId)}/audit`}>
                  <ExternalLink className="h-3.5 w-3.5" />审计
                </Link>
              </RowActions>
            </td>
          </tr>
        ))}
      />
    </Workspace>
  );
}

/** 页头把标题、一句话说明和主操作压到同一条带里，长说明收进 HelpTip，不再占用通栏提示条。 */
function Workspace({
  title,
  description,
  help,
  actions,
  children,
}: {
  title: string;
  description: string;
  help: ReactNode;
  actions: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="platform-access-workspace console-workbench grid min-w-0 gap-3">
      <div className="page-header">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="console-section-title">{title}</h1>
            <HelpTip content={help} label={`${title}说明`} />
          </div>
          <p className="page-description">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </div>
      {children}
    </div>
  );
}

function uniqueOptions(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort().map((value) => ({ value, label: value }));
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

function driftStateTone(state: string) {
  if (state === 'in_sync') return 'success';
  if (state === 'drifted') return 'warning';
  if (state === 'sync_failed') return 'danger';
  if (state === 'pending') return 'info';
  return 'neutral';
}

function breakGlassStatusLabel(status: string) {
  if (status === 'requested') return '待审批';
  if (status === 'approved') return '已生效';
  if (status === 'revoked') return '已撤销';
  if (status === 'expired') return '已过期';
  return status || '未知';
}

function breakGlassTone(status: string) {
  if (status === 'approved') return 'danger';
  if (status === 'requested') return 'warning';
  return 'neutral';
}

function PrimaryAction({ label, onClick }: { label: string; onClick: () => void }) {
  return <button className="console-button console-button-primary" type="button" onClick={onClick}><Plus className="h-4 w-4" />{label}</button>;
}

function DangerAction({ label, onClick }: { label: string; onClick: () => void }) {
  return <button className="console-table-action console-table-action-danger" type="button" onClick={onClick}><Trash2 className="h-3.5 w-3.5" />{label}</button>;
}

function k8sLevelLabel(level: K8sAccessLevel) {
  return level === 'namespace-maintainer' ? '命名空间维护' : '开发只读';
}

function productRoleLabel(role: ProductAccessGrant['role']) {
  return role === 'product-maintainer' ? '产品维护者' : '产品查看者';
}

function k8sLevelTone(level: K8sAccessLevel) {
  return level === 'namespace-maintainer' ? 'warning' : 'neutral';
}

function groupLabel(groups: PlatformGroup[], groupId: string) {
  return groups.find((group) => group.id === groupId)?.displayName || groupId;
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
  return users.find((item) => item.id === subjectId)?.username || subjectId;
}
