import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ShieldCheck, Trash2, UsersRound } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { DataPanel } from '../../components/DataPanel';
import { EmptyState } from '../../components/EmptyState';
import { api } from '../../services/api';
import {
  accessApi,
  type ProductAccessGrant,
  type ProductAccessRole,
} from '../platform/accessApi';

export function ProductAccessPage() {
  const { productId = '' } = useParams();
  const queryClient = useQueryClient();
  const [groupId, setGroupId] = useState('');
  const [role, setRole] = useState<ProductAccessRole>('product-viewer');
  const productsQuery = useQuery({ queryKey: ['products', 'accessible'], queryFn: api.getProducts, retry: false });
  const grantsQuery = useQuery({
    queryKey: ['fixed-access', 'product-grants', productId],
    queryFn: () => accessApi.listProductAccessGrants(productId),
    enabled: Boolean(productId),
    retry: false,
  });
  const subjectsQuery = useQuery({
    queryKey: ['fixed-access', 'product-grant-subjects', productId],
    queryFn: () => accessApi.listProductGrantGroups(productId),
    enabled: Boolean(productId),
    retry: false,
  });
  const product = productsQuery.data?.find((item) => item.id === productId);
  const subjects = subjectsQuery.data ?? [];
  const grants = grantsQuery.data ?? [];
  const selectedGroupId = subjects.some((item) => item.groupId === groupId)
    ? groupId
    : subjects[0]?.groupId ?? '';

  const invalidate = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['fixed-access', 'product-grants', productId] }),
    queryClient.invalidateQueries({ queryKey: ['platform-me'] }),
  ]);
  const saveGrant = useMutation({
    mutationFn: (input: { groupId: string; role: ProductAccessRole }) => (
      accessApi.createProductAccessGrant(productId, input)
    ),
    onSuccess: invalidate,
  });
  const deleteGrant = useMutation({
    mutationFn: (grant: ProductAccessGrant) => accessApi.deleteProductAccessGrant(productId, grant.id),
    onSuccess: invalidate,
  });
  const groupLabels = new Map(subjects.map((item) => [
    item.groupId,
    item.displayName || item.groupId,
  ]));
  const error = productsQuery.error || grantsQuery.error || subjectsQuery.error || saveGrant.error || deleteGrant.error;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-primary" to="/products">
            <ArrowLeft className="h-3.5 w-3.5" />返回产品与服务
          </Link>
          <h1 className="page-title">{product?.name || '产品'} · 产品授权</h1>
          <p className="page-description">
            授权以 Product 为唯一业务边界，自动覆盖产品下全部服务；产品权限不会产生任何 K8S 权限。
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-md border border-outline bg-white px-3 py-2 text-xs text-muted">
          <ShieldCheck className="h-4 w-4 text-primary" />
          当前页面仅管理本产品授权
        </div>
      </div>

      {error ? <div className="console-notice console-notice-danger">{errorMessage(error)}</div> : null}

      <DataPanel
        title="添加产品授权"
        meta="只可选择平台中已启用的用户组；用户通过用户组继承权限。"
      >
        {subjectsQuery.isLoading ? <div className="console-skeleton h-10" /> : (
          <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_190px_auto] lg:items-end">
            <Field label="授权用户组">
              <select
                className="console-select w-full"
                value={selectedGroupId}
                onChange={(event) => setGroupId(event.target.value)}
              >
                {subjects.length === 0 ? <option value="">暂无可用用户组</option> : null}
                {subjects.map((item) => (
                  <option key={item.groupId} value={item.groupId}>
                    {item.displayName || item.groupId} · {item.groupId}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="产品角色">
              <select className="console-select w-full" value={role} onChange={(event) => setRole(event.target.value as ProductAccessRole)}>
                <option value="product-viewer">产品查看者</option>
                <option value="product-maintainer">产品维护者</option>
              </select>
            </Field>
            <button
              className="console-button console-button-primary"
              type="button"
              disabled={!selectedGroupId || saveGrant.isPending}
              onClick={() => saveGrant.mutate({ groupId: selectedGroupId, role })}
            >
              {saveGrant.isPending ? '保存中…' : '添加授权'}
            </button>
          </div>
        )}
      </DataPanel>

      <DataPanel
        title="当前授权"
        meta={`${grants.length} 条固定授权；修改角色会覆盖同一主体的现有授权。`}
      >
        {grantsQuery.isLoading ? <div className="console-skeleton h-40" /> : grants.length === 0 ? (
          <EmptyState title="本产品还没有授权" action={<span className="text-xs text-muted">平台管理员仍可管理 Product 生命周期，但不会自动获得业务数据访问权。</span>} />
        ) : (
          <div className="console-resource-list overflow-x-auto">
            <table className="console-table w-full min-w-[760px]">
              <thead><tr><th>用户组</th><th>产品角色</th><th>生效范围</th><th className="text-right">操作</th></tr></thead>
              <tbody>
                {grants.map((grant) => (
                  <tr key={grant.id}>
                    <td>
                      <div className="font-semibold text-on-surface">
                        {groupLabels.get(grant.groupId) || grant.groupId}
                      </div>
                      <div className="mt-1 font-mono text-[11px] text-muted">{grant.groupId}</div>
                    </td>
                    <td>
                      <select
                        className="console-select min-w-[180px]"
                        aria-label={`修改 ${grant.groupId} 的产品角色`}
                        value={grant.role}
                        disabled={saveGrant.isPending}
                        onChange={(event) => saveGrant.mutate({
                          groupId: grant.groupId,
                          role: event.target.value as ProductAccessRole,
                        })}
                      >
                        <option value="product-viewer">产品查看者</option>
                        <option value="product-maintainer">产品维护者</option>
                      </select>
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                        <UsersRound className="h-3.5 w-3.5" />全部服务
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        className="console-icon-button text-red-600"
                        type="button"
                        aria-label={`移除 ${grant.groupId} 的产品授权`}
                        title="移除授权"
                        disabled={deleteGrant.isPending}
                        onClick={() => {
                          if (window.confirm(`确认移除 ${grant.groupId} 的产品授权？该用户组将立即失去本产品访问能力。`)) {
                            deleteGrant.mutate(grant);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataPanel>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-on-surface">{label}</span>
      {children}
    </label>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '产品授权操作失败';
}
