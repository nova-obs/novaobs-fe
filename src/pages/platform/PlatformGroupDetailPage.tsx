import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Boxes,
  ExternalLink,
  KeyRound,
  ShieldCheck,
  Trash2,
  UsersRound,
} from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { EmptyState } from '../../components/EmptyState';
import { api } from '../../services/api';
import { accessApi, type K8sAccessLevel } from './accessApi';
import { platformApi } from './api';
import { Chips, Identity, ListSection, Pill, RowActions } from './PlatformAccessListSection';

/**
 * 用户组是产品和 K8S 两条授权链路唯一的共同主体，这里把一个组的成员、
 * 产品授权、命名空间权限和管理员标记收拢到一页，替代跨三个页面手工比对。
 */
export function PlatformGroupDetailPage() {
  const { groupId = '' } = useParams();
  const queryClient = useQueryClient();

  const usersQuery = useQuery({ queryKey: ['platform-users'], queryFn: platformApi.listUsers, retry: false });
  const groupsQuery = useQuery({ queryKey: ['platform-groups'], queryFn: platformApi.listGroups, retry: false });
  const membershipsQuery = useQuery({ queryKey: ['platform-group-memberships'], queryFn: platformApi.listMemberships, retry: false });
  const accessQuery = useQuery({
    queryKey: ['fixed-access', 'group-access', groupId],
    queryFn: () => accessApi.getGroupAccess(groupId),
    enabled: Boolean(groupId),
    retry: false,
  });
  const productsQuery = useQuery({ queryKey: ['platform-products'], queryFn: api.getProductsForAdministration, retry: false });
  const profilesQuery = useQuery({ queryKey: ['fixed-access', 'k8s-profiles'], queryFn: accessApi.listK8sAccessProfiles, retry: false });

  const emailsById = new Map((usersQuery.data ?? []).map((item) => [item.id, item.email]));
  const group = (groupsQuery.data ?? []).find((item) => item.id === groupId);
  const members = (membershipsQuery.data ?? []).filter((item) => item.groupId === groupId);
  const access = accessQuery.data ?? null;
  const products = productsQuery.data ?? [];
  const profiles = profilesQuery.data ?? [];
  const productGrants = access?.productGrants ?? [];
  const k8sGrants = access?.k8sGrants ?? [];

  const invalidate = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['platform-group-memberships'] }),
    queryClient.invalidateQueries({ queryKey: ['fixed-access'] }),
    queryClient.invalidateQueries({ queryKey: ['platform-me'] }),
  ]);
  const deleteMembership = useMutation({ mutationFn: platformApi.deleteMembership, onSettled: invalidate });
  const deleteK8sGrant = useMutation({ mutationFn: accessApi.deleteK8sAccessGrant, onSettled: invalidate });

  const error = groupsQuery.error
    || membershipsQuery.error
    || accessQuery.error
    || productsQuery.error
    || profilesQuery.error
    || deleteMembership.error
    || deleteK8sGrant.error;
  const loading = groupsQuery.isLoading || accessQuery.isLoading;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-primary" to="/platform/identities">
            <ArrowLeft className="h-3.5 w-3.5" />返回用户与用户组
          </Link>
          <h1 className="page-title">{group?.displayName || group?.name || groupId}</h1>
          <p className="page-description">
            用户通过用户组继承全部授权；本页汇总该组的成员、产品访问授权和命名空间权限。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="neutral" label={`${members.length} 名成员`} />
          <Pill tone="neutral" label={`${productGrants.length} 条产品访问授权`} />
          <Pill tone={k8sGrants.length ? 'warning' : 'neutral'} label={`${k8sGrants.length} 条命名空间权限`} />
          {access?.platformAdmin ? <Pill tone="danger" label="平台管理员" /> : null}
        </div>
      </div>

      {error ? (
        <div className="console-notice console-notice-danger">
          <ShieldCheck className="h-4 w-4" />
          用户组授权读取或写入失败：{error instanceof Error ? error.message : '未知错误'}
        </div>
      ) : null}

      {access?.platformAdmin ? (
        <div className="console-notice console-notice-warning">
          <ShieldCheck className="h-4 w-4" />
          该用户组持有平台管理员授权，其全部成员都能管理控制面；平台管理员不会自动获得产品数据或工作负载权限。
        </div>
      ) : null}

      {loading ? (
        <DataPanel><div className="console-skeleton h-40" /></DataPanel>
      ) : !group ? (
        <DataPanel><EmptyState title="用户组不存在或已被删除" /></DataPanel>
      ) : (
        <DataPanel>
          <div className="platform-access-workspace console-workbench grid min-w-0 gap-4">
            <ListSection
              icon={<UsersRound className="h-4 w-4" />}
              title="成员"
              meta="成员通过本组继承下面全部授权"
              items={members}
              searchPlaceholder="搜索成员"
              searchText={(item) => [item.username, item.userId, emailsById.get(item.userId)].join(' ')}
              headers={['用户', '邮箱', '操作']}
              empty="该用户组还没有成员"
              minWidth="min-w-[560px]"
              renderRows={(paged) => paged.map((membership) => (
                <tr key={membership.id}>
                  <td className="text-sm text-on-surface">{membership.username || membership.userId}</td>
                  <td className="text-xs text-muted">{emailsById.get(membership.userId) || '-'}</td>
                  <td>
                    <RowActions>
                      <button
                        className="console-table-action console-table-action-danger"
                        type="button"
                        onClick={() => {
                          if (window.confirm(`确认将 ${membership.username || membership.userId} 移出本用户组？该用户会立即失去本组的全部授权。`)) {
                            deleteMembership.mutate(membership.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />移除
                      </button>
                    </RowActions>
                  </td>
                </tr>
              ))}
            />

            <ListSection
              icon={<Boxes className="h-4 w-4" />}
              title="产品访问授权"
              meta="授权自动覆盖产品下全部服务，不会产生 K8s 权限"
              items={productGrants}
              searchPlaceholder="搜索产品"
              searchText={(grant) => [productName(products, grant.productId), grant.productId].join(' ')}
              headers={['产品', '权限', '生效范围', '操作']}
              empty="该用户组还没有产品访问授权"
              minWidth="min-w-[640px]"
              renderRows={(paged) => paged.map((grant) => (
                <tr key={grant.id}>
                  <td><Identity primary={productName(products, grant.productId)} internalId={grant.productId} /></td>
                  <td>
                    <Pill
                      tone={grant.role === 'product-maintainer' ? 'warning' : 'neutral'}
                      label={grant.role === 'product-maintainer' ? '产品维护者' : '产品查看者'}
                    />
                  </td>
                  <td className="text-xs text-muted">全部服务</td>
                  <td>
                    <RowActions>
                      <Link className="console-table-action" to="/platform/product-access">
                        <ExternalLink className="h-3.5 w-3.5" />打开授权工作台
                      </Link>
                    </RowActions>
                  </td>
                </tr>
              ))}
            />

            <ListSection
              icon={<KeyRound className="h-4 w-4" />}
              title="K8s 集群授权"
              meta="命名空间维护可发布、删除、回滚和进入容器终端"
              items={k8sGrants}
              searchPlaceholder="搜索权限名称、集群"
              searchText={(grant) => {
                const profile = profiles.find((item) => item.id === grant.profileId);
                return [profile?.name, profile?.clusterId, ...(profile?.namespaces ?? [])].join(' ');
              }}
              headers={['命名空间权限', '集群', '权限等级', '命名空间', '操作']}
              empty="该用户组还没有命名空间权限"
              minWidth="min-w-[820px]"
              renderRows={(paged) => paged.map((grant) => {
                const profile = profiles.find((item) => item.id === grant.profileId);
                return (
                  <tr key={grant.id}>
                    <td><Identity primary={profile?.name || grant.profileId} internalId={grant.profileId} /></td>
                    <td className="whitespace-nowrap font-mono text-xs text-muted">{profile?.clusterId || '-'}</td>
                    <td>
                      {profile
                        ? <Pill tone={levelTone(profile.accessLevel)} label={levelLabel(profile.accessLevel)} />
                        : <span className="text-xs text-muted">-</span>}
                    </td>
                    <td><Chips values={profile?.namespaces ?? []} /></td>
                    <td>
                      <RowActions>
                        <button
                          className="console-table-action console-table-action-danger"
                          type="button"
                          onClick={() => {
                            if (window.confirm(`确认撤销本组的「${profile?.name || grant.profileId}」命名空间权限？组内 ${members.length} 名成员会立即失去对应命名空间权限。`)) {
                              deleteK8sGrant.mutate(grant.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />撤销
                        </button>
                      </RowActions>
                    </td>
                  </tr>
                );
              })}
            />
          </div>
        </DataPanel>
      )}
    </div>
  );
}

function productName(products: Array<{ id: string; name: string }>, productId: string) {
  return products.find((item) => item.id === productId)?.name || productId;
}

function levelLabel(level: K8sAccessLevel) {
  return level === 'namespace-maintainer' ? '命名空间维护' : '开发只读';
}

function levelTone(level: K8sAccessLevel) {
  return level === 'namespace-maintainer' ? 'warning' : 'neutral';
}
