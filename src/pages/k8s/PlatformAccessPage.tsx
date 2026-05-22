import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Plus, ShieldAlert, ShieldCheck, Trash2, UserRoundCog } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { k8sApi, type K8sPlatformAccessBinding } from './api';

const defaultPermissionIds = ['k8s.resource:read'];

export function K8sPlatformAccessPage() {
  const queryClient = useQueryClient();
  const [selectedClusterId, setSelectedClusterId] = useState('');
  const [namespace, setNamespace] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [subjectType, setSubjectType] = useState('user');
  const [permissionIds, setPermissionIds] = useState<string[]>(defaultPermissionIds);
  const [selected, setSelected] = useState<K8sPlatformAccessBinding | null>(null);
  const [lastAuditId, setLastAuditId] = useState('');

  const { data: clusters = [], isLoading: isLoadingClusters, error: clusterError } = useQuery({
    queryKey: ['k8s-clusters'],
    queryFn: () => k8sApi.listClusters(),
    retry: false,
  });
  const activeClusterId = selectedClusterId || clusters[0]?.id || '';

  const { data: namespaces = [], error: namespaceError } = useQuery({
    queryKey: ['k8s-namespaces', activeClusterId],
    queryFn: () => k8sApi.listNamespaces(activeClusterId),
    enabled: Boolean(activeClusterId),
    retry: false,
  });

  useEffect(() => {
    if (!selectedClusterId && clusters[0]?.id) {
      setSelectedClusterId(clusters[0].id);
    }
  }, [clusters, selectedClusterId]);

  useEffect(() => {
    const namespaceExists = namespaces.some((item) => item.name === namespace);
    if (namespace && !namespaceExists) {
      setNamespace(namespaces[0]?.name ?? '');
      return;
    }
    if (!namespace && namespaces[0]?.name) {
      setNamespace(namespaces[0].name);
    }
  }, [namespace, namespaces]);

  const permissionsQuery = useQuery({
    queryKey: ['k8s-platform-access-permissions'],
    queryFn: () => k8sApi.listPlatformAccessPermissions(),
    retry: false,
  });
  const bindingsQuery = useQuery({
    queryKey: ['k8s-platform-access-bindings'],
    queryFn: () => k8sApi.listPlatformAccessBindings(),
    retry: false,
  });
  const subjectsQuery = useQuery({
    queryKey: ['k8s-platform-subjects'],
    queryFn: () => k8sApi.listPlatformSubjects(),
    retry: false,
  });

  useEffect(() => {
    if (!subjectId && subjectsQuery.data?.[0]) {
      setSubjectType(subjectsQuery.data[0].subjectType);
      setSubjectId(subjectsQuery.data[0].subjectId);
    }
  }, [subjectId, subjectsQuery.data]);

  const createMutation = useMutation({
    mutationFn: () => k8sApi.createPlatformAccessBinding({
      subjectId,
      subjectType,
      clusterId: activeClusterId,
      namespace,
      permissionIds,
    }),
    onSuccess: (result) => {
      setLastAuditId(result.auditId);
      setSelected(result.item ?? null);
      queryClient.invalidateQueries({ queryKey: ['k8s-platform-access-bindings'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      const target = selected ?? bindingsQuery.data?.[0];
      if (!target) throw new Error('请选择要删除的平台授权绑定');
      return k8sApi.deletePlatformAccessBinding(target.id);
    },
    onSuccess: (result) => {
      setLastAuditId(result.auditId);
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ['k8s-platform-access-bindings'] });
    },
  });

  const permissionError = useMemo(() => {
    const message = permissionsQuery.error?.message || bindingsQuery.error?.message || createMutation.error?.message || deleteMutation.error?.message || '';
    return message.includes('无权') || message.includes('permission_denied') ? message : '';
  }, [permissionsQuery.error, bindingsQuery.error, createMutation.error, deleteMutation.error]);

  const permissions = permissionsQuery.data ?? [];
  const bindings = bindingsQuery.data ?? [];
  const subjects = subjectsQuery.data ?? [];
  const hasSelectedSubjectInDirectory = subjects.some((item) => item.subjectType === subjectType && item.subjectId === subjectId);
  const currentTarget = selected ?? bindings[0];
  const isLoading = permissionsQuery.isLoading || bindingsQuery.isLoading || subjectsQuery.isLoading;
  const error = permissionsQuery.error || bindingsQuery.error || subjectsQuery.error;
  const canCreate = Boolean(activeClusterId && namespace && subjectId.trim() && permissionIds.length);

  const togglePermission = (id: string) => {
    setPermissionIds((current) => (
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    ));
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <AccessMetric icon={UserRoundCog} label="授权绑定" value={String(bindings.length)} meta="platform RBAC" />
        <AccessMetric icon={ShieldCheck} label="可授予权限" value={String(permissions.length)} meta="NovaObs permission set" />
        <AccessMetric icon={KeyRound} label="操作审计" value={lastAuditId ? 'ready' : 'pending'} meta={lastAuditId || '等待操作'} />
      </div>

      <section className="console-panel px-4 py-3">
        <div className="grid gap-3 md:grid-cols-[minmax(180px,260px)_minmax(160px,220px)_minmax(160px,220px)_minmax(160px,220px)] md:items-end">
          <label className="block">
            <span className="text-xs font-semibold text-muted">授权主体</span>
            <select
              className="console-input mt-2 w-full"
              value={subjectRecordValue(subjectType, subjectId)}
              onChange={(event) => {
                const [nextType, nextId] = splitSubjectRecordValue(event.target.value);
                setSubjectType(nextType);
                setSubjectId(nextId);
              }}
              disabled={!subjects.length}
            >
              {!subjects.length || !hasSelectedSubjectInDirectory ? <option value={subjectRecordValue(subjectType, subjectId)}>手工输入主体</option> : null}
              {subjects.map((item) => (
                <option key={item.id} value={subjectRecordValue(item.subjectType, item.subjectId)}>
                  {item.displayName || item.subjectId} / {item.subjectType}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-muted">Subject Type</span>
            <select className="console-input mt-2 w-full" value={subjectType} onChange={(event) => setSubjectType(event.target.value)}>
              <option value="user">user</option>
              <option value="group">group</option>
              <option value="service-account">service-account</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-muted">集群</span>
            <select className="console-input mt-2 w-full" value={activeClusterId} onChange={(event) => setSelectedClusterId(event.target.value)} disabled={isLoadingClusters || !clusters.length}>
              {!clusters.length ? <option value="">暂无已登记集群</option> : null}
              {clusters.map((item) => (
                <option key={item.id} value={item.id}>{item.name || item.id}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-muted">命名空间</span>
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

      <DataPanel title="平台授权" meta={isLoading ? '加载中' : `${bindings.length} 条绑定 · ${permissionIds.length} 项待授予`}>
        {permissionError ? (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            <ShieldAlert className="h-4 w-4" />
            权限不足：当前用户缺少 `k8s.platform-access:manage`。
          </div>
        ) : null}
        {error && !permissionError ? (
          <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            平台授权读取失败：{errorMessage(error)}
          </div>
        ) : null}
        {lastAuditId ? (
          <div className="mb-3 rounded-lg bg-primary-soft px-3 py-2 text-sm font-semibold text-primary">
            操作已落审计：<span className="font-mono">{lastAuditId}</span>
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
          <div className="overflow-auto">
            <table className="console-table min-w-[980px] w-full">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Scope</th>
                  <th>权限</th>
                  <th>Role</th>
                  <th>Binding ID</th>
                </tr>
              </thead>
              <tbody>
                {bindings.map((item) => (
                  <tr
                    key={item.id}
                    className={`cursor-pointer bg-white/35 hover:bg-white/60 ${currentTarget?.id === item.id ? 'shadow-[inset_3px_0_0_rgba(13,91,215,0.78)]' : ''}`}
                    onClick={() => setSelected(item)}
                  >
                    <td>
                      <div className="font-semibold text-primary">{item.subjectId}</div>
                      <div className="text-[11px] text-muted">{item.subjectType}</div>
                    </td>
                    <td className="font-mono text-xs">{formatScope(item.scope)}</td>
                    <td className="text-xs text-muted">{item.permissionIds.join(' · ') || '-'}</td>
                    <td className="text-xs text-muted">{item.roleName || item.roleId}</td>
                    <td className="font-mono text-[11px] text-muted">{item.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!isLoading && !error && !bindings.length ? (
              <div className="mt-3 rounded-lg bg-white/45 px-4 py-6 text-center text-sm text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">暂无平台授权绑定。</div>
            ) : null}
          </div>

          <aside className="console-panel px-4 py-3">
            <div className="text-sm font-semibold text-on-surface">授予权限</div>
            <div className="mt-3 grid gap-2">
              {permissions.map((item) => (
                <label key={item.id} className="flex cursor-pointer gap-3 rounded-lg bg-white/45 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
                  <input
                    className="mt-1 h-4 w-4 accent-primary"
                    type="checkbox"
                    checked={permissionIds.includes(item.id)}
                    onChange={() => togglePermission(item.id)}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-on-surface">{item.label}</span>
                    <span className="block break-all font-mono text-[11px] text-muted">{item.id} · {item.scopeMode}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-4 rounded-lg bg-white/45 px-3 py-3 text-xs text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
              <label className="block">
                <span className="text-xs font-semibold text-muted">Subject ID</span>
                <input className="console-input mt-2 w-full" value={subjectId} onChange={(event) => setSubjectId(event.target.value)} />
              </label>
              <div className="mt-3 border-t border-[rgba(13,91,215,0.12)] pt-3">
              <div className="font-mono">subject={subjectType}/{subjectId || '-'}</div>
              <div className="font-mono">cluster={activeClusterId || '-'}</div>
              <div className="font-mono">namespace={namespace || '-'}</div>
              <div className="mt-2">终端、资源只读、发布和 K8s RBAC 可拆开授权。</div>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!canCreate || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                <Plus className="h-4 w-4" />
                授权
              </button>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-sm font-semibold text-danger shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!currentTarget || deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                <Trash2 className="h-4 w-4" />
                删除
              </button>
            </div>
          </aside>
        </div>
      </DataPanel>
    </div>
  );
}

function AccessMetric({ icon: Icon, label, value, meta }: { icon: typeof ShieldCheck; label: string; value: string; meta: string }) {
  return (
    <section className="console-panel px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-on-surface">{label}</div>
          <div className="mt-3 font-mono text-2xl font-semibold text-on-surface">{value}</div>
          <div className="mt-2 break-all text-xs text-muted">{meta}</div>
        </div>
        <Icon className="h-4 w-4 text-primary" />
      </div>
    </section>
  );
}

function formatScope(scope: K8sPlatformAccessBinding['scope']) {
  if (scope.global) return 'global';
  return `${scope.clusterId || '-'}/${scope.namespace || 'cluster-scoped'}`;
}

function subjectRecordValue(subjectType: string, subjectId: string) {
  return `${subjectType}:${subjectId}`;
}

function splitSubjectRecordValue(value: string) {
  const separator = value.indexOf(':');
  if (separator < 0) {
    return ['user', value] as const;
  }
  return [value.slice(0, separator) || 'user', value.slice(separator + 1)] as const;
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : '请检查平台 RBAC、集群连接与后端响应。';
}
