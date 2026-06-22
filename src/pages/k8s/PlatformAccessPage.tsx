import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, KeyRound, Plus, ShieldAlert, ShieldCheck, Trash2, UserRoundCog } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { k8sApi, type K8sNamespace, type K8sPlatformAccessBinding, type K8sPlatformAccessPermission, type K8sPlatformAccessProfile } from './api';
import { useK8sOpsContext } from './context';

const defaultPermissionIds = ['k8s.namespace:read', 'k8s.resource:read'];
const customProfileId = '__custom__';
const emptyNamespaces: K8sNamespace[] = [];

type AccessTab = 'grant' | 'bindings';
type GrantScopeMode = 'cluster' | 'selected-namespaces' | 'all-namespaces' | 'global';

const accessTabs: { key: AccessTab; label: string; meta: string }[] = [
  { key: 'grant', label: '新增授权', meta: '主体 / 权限包 / 范围' },
  { key: 'bindings', label: '已授权绑定', meta: '审计与删除' },
];

export function K8sPlatformAccessPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<AccessTab>('grant');
  const [selectedNamespaces, setSelectedNamespaces] = useState<string[]>([]);
  const [namespaceQuery, setNamespaceQuery] = useState('');
  const [scopeMode, setScopeMode] = useState<GrantScopeMode>('selected-namespaces');
  const [riskAccepted, setRiskAccepted] = useState(false);
  const [subjectId, setSubjectId] = useState('');
  const [subjectType, setSubjectType] = useState('user');
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [permissionIds, setPermissionIds] = useState<string[]>(defaultPermissionIds);
  const [selected, setSelected] = useState<K8sPlatformAccessBinding | null>(null);
  const [lastAuditId, setLastAuditId] = useState('');

  const { activeClusterId, activeCluster, clusterError } = useK8sOpsContext();

  const { data: namespaceData, error: namespaceError } = useQuery({
    queryKey: ['k8s-namespaces', activeClusterId],
    queryFn: () => k8sApi.listNamespaces(activeClusterId),
    enabled: Boolean(activeClusterId),
    retry: false,
  });
  const namespaces = namespaceData ?? emptyNamespaces;

  useEffect(() => {
    setSelectedNamespaces((current) => {
      if (!namespaces.length) {
        return current.length ? [] : current;
      }
      const availableNames = new Set(namespaces.map((item) => item.name));
      const kept = current.filter((item) => availableNames.has(item));
      if (kept.length) {
        const unchanged = kept.length === current.length && kept.every((item, index) => item === current[index]);
        return unchanged ? current : kept;
      }
      return namespaces[0]?.name ? [namespaces[0].name] : current;
    });
  }, [namespaces]);

  const permissionsQuery = useQuery({
    queryKey: ['k8s-platform-access-permissions'],
    queryFn: () => k8sApi.listPlatformAccessPermissions(),
    retry: false,
  });
  const profilesQuery = useQuery({
    queryKey: ['k8s-platform-access-profiles'],
    queryFn: () => k8sApi.listPlatformAccessProfiles(),
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

  useEffect(() => {
    const firstProfile = profilesQuery.data?.[0];
    if (!selectedProfileId && firstProfile) {
      setSelectedProfileId(firstProfile.id);
      setPermissionIds(firstProfile.permissionIds);
    }
  }, [profilesQuery.data, selectedProfileId]);

  const permissions = permissionsQuery.data ?? [];
  const profiles = profilesQuery.data ?? [];
  const bindings = bindingsQuery.data ?? [];
  const subjects = subjectsQuery.data ?? [];
  const permissionById = useMemo(() => new Map(permissions.map((item) => [item.id, item])), [permissions]);
  const selectedProfile = selectedProfileId === customProfileId ? undefined : profiles.find((item) => item.id === selectedProfileId);
  const selectedPermissions = permissionIds.map((id) => permissionById.get(id)).filter((item): item is K8sPlatformAccessPermission => Boolean(item));
  const hasNamespacePermissions = selectedPermissions.some((item) => item.scopeMode === 'namespace') || selectedProfile?.scopeMode === 'namespace' || selectedProfile?.scopeMode === 'mixed';
  const isGlobalGrant = selectedPermissions.length > 0 && selectedPermissions.every((item) => item.scopeMode === 'global');
  const effectiveScopeMode: GrantScopeMode = isGlobalGrant ? 'global' : hasNamespacePermissions ? (scopeMode === 'all-namespaces' ? 'all-namespaces' : 'selected-namespaces') : 'cluster';
  const allNamespaces = effectiveScopeMode === 'all-namespaces';
  const namespaceSelectionRequired = effectiveScopeMode === 'selected-namespaces';
  const isWideNamespaceGrant = allNamespaces || selectedNamespaces.length > 1;
  const hasHighRiskPermission = permissionIds.some(isHighRiskPermissionId);
  const hasClusterWideHighRiskPermission = permissionIds.some(isClusterWideHighRiskPermissionId);
  const requiresRiskAccepted = hasHighRiskPermission && (isWideNamespaceGrant || hasClusterWideHighRiskPermission);
  const filteredNamespaces = useMemo(() => {
    const keyword = namespaceQuery.trim().toLowerCase();
    if (!keyword) return namespaces;
    return namespaces.filter((item) => item.name.toLowerCase().includes(keyword));
  }, [namespaceQuery, namespaces]);
  const hasSelectedSubjectInDirectory = subjects.some((item) => item.subjectType === subjectType && item.subjectId === subjectId);
  const currentTarget = selected ?? bindings[0];
  const isLoading = permissionsQuery.isLoading || profilesQuery.isLoading || bindingsQuery.isLoading || subjectsQuery.isLoading;
  const error = permissionsQuery.error || profilesQuery.error || bindingsQuery.error || subjectsQuery.error;
  const canCreate = Boolean((activeClusterId || isGlobalGrant) && (!namespaceSelectionRequired || selectedNamespaces.length) && subjectId.trim() && permissionIds.length && (!requiresRiskAccepted || riskAccepted));

  useEffect(() => {
    if (isGlobalGrant && scopeMode !== 'global') {
      setScopeMode('global');
      return;
    }
    if (!isGlobalGrant && hasNamespacePermissions && scopeMode !== 'selected-namespaces' && scopeMode !== 'all-namespaces') {
      setScopeMode('selected-namespaces');
      return;
    }
    if (!isGlobalGrant && !hasNamespacePermissions && scopeMode !== 'cluster') {
      setScopeMode('cluster');
    }
  }, [hasNamespacePermissions, isGlobalGrant, scopeMode]);

  const createMutation = useMutation({
    mutationFn: () => k8sApi.createPlatformAccessBinding({
      subjectId,
      subjectType,
      clusterId: isGlobalGrant ? '' : activeClusterId,
      namespace: '',
      namespaces: effectiveScopeMode === 'selected-namespaces' ? selectedNamespaces : [],
      allNamespaces,
      global: isGlobalGrant,
      riskAccepted,
      permissionIds,
    }),
    onSuccess: (result) => {
      setLastAuditId(result.auditId);
      setSelected(result.items?.[0] ?? result.item ?? null);
      setActiveTab('bindings');
      queryClient.invalidateQueries({ queryKey: ['k8s-platform-access-bindings'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      const target = selected ?? bindings[0];
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
    const message = permissionsQuery.error?.message || profilesQuery.error?.message || bindingsQuery.error?.message || subjectsQuery.error?.message || createMutation.error?.message || deleteMutation.error?.message || '';
    return message.includes('无权') || message.includes('permission_denied') ? message : '';
  }, [permissionsQuery.error, profilesQuery.error, bindingsQuery.error, subjectsQuery.error, createMutation.error, deleteMutation.error]);

  const togglePermission = (id: string) => {
    setPermissionIds((current) => (
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    ));
    setRiskAccepted(false);
  };

  const selectProfile = (profile: K8sPlatformAccessProfile) => {
    setSelectedProfileId(profile.id);
    setPermissionIds(profile.permissionIds);
    setRiskAccepted(false);
  };

  const toggleNamespaceSelection = (name: string) => {
    setSelectedNamespaces((current) => (
      current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name].sort()
    ));
    setRiskAccepted(false);
  };

  const targetClusterLabel = isGlobalGrant ? 'global' : activeCluster?.name || activeClusterId || '未选择';
  const targetNamespaceLabel = scopeSummaryLabel(effectiveScopeMode, selectedNamespaces);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <AccessMetric icon={UserRoundCog} label="授权绑定" value={String(bindings.length)} meta="platform RBAC" />
        <AccessMetric icon={ShieldCheck} label="权限包" value={String(profiles.length)} meta={selectedProfile?.label || '自定义权限'} />
        <AccessMetric icon={KeyRound} label="操作审计" value={lastAuditId ? 'ready' : 'pending'} meta={lastAuditId || '等待操作'} />
      </div>

      <DataPanel title="平台授权" meta={isLoading ? '加载中' : `${bindings.length} 条绑定 · ${permissionIds.length} 项待授予`} action={<AccessTabNav activeTab={activeTab} onChange={setActiveTab} />}>
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

        {activeTab === 'grant' ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <section className="grid gap-4">
              <GrantStep index="01" title="选择授权主体">
                <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px]">
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
                    <span className="text-xs font-semibold text-muted">主体类型</span>
                    <select className="console-input mt-2 w-full" value={subjectType} onChange={(event) => setSubjectType(event.target.value)}>
                      <option value="user">user</option>
                      <option value="group">group</option>
                      <option value="service-account">service-account</option>
                    </select>
                  </label>
                </div>
                <label className="mt-3 block">
                  <span className="text-xs font-semibold text-muted">主体 ID</span>
                  <input className="console-input mt-2 w-full" value={subjectId} onChange={(event) => setSubjectId(event.target.value)} />
                </label>
              </GrantStep>

              <GrantStep index="02" title="选择权限包">
                <div className="grid gap-2 md:grid-cols-2">
                  {!profiles.length && profilesQuery.isLoading ? (
                    <div className="rounded-lg bg-white/45 px-3 py-3 text-xs text-muted">正在加载权限包：只读观察者、集群运维管理员...</div>
                  ) : null}
                  {profiles.map((profile) => (
                    <button
                      key={profile.id}
                      className={`rounded-lg border px-3 py-3 text-left transition ${selectedProfile?.id === profile.id ? 'border-primary bg-primary-soft' : 'border-[rgba(13,91,215,0.12)] bg-white/45 hover:bg-white/70'}`}
                      onClick={() => selectProfile(profile)}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-on-surface">{profile.label}</span>
                        <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${riskClassName(profile.risk)}`}>{riskLabel(profile.risk)}</span>
                      </span>
                      <span className="mt-2 block text-xs leading-5 text-muted">{profile.description}</span>
                      <span className="mt-2 block font-mono text-[11px] text-muted">{profile.scopeMode} · {profile.permissionIds.length} 项权限</span>
                    </button>
                  ))}
                </div>
                <details className="mt-3 rounded-lg bg-white/35 px-3 py-3 text-xs text-muted">
                  <summary className="cursor-pointer text-sm font-semibold text-on-surface">高级自定义权限</summary>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {permissions.map((item) => (
                      <label key={item.id} className="flex cursor-pointer gap-3 rounded-lg bg-white/45 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
                        <input
                          className="mt-1 h-4 w-4 accent-primary"
                          type="checkbox"
                          checked={permissionIds.includes(item.id)}
                          onChange={() => {
                            setSelectedProfileId(customProfileId);
                            togglePermission(item.id);
                          }}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-on-surface">{item.label}</span>
                          <span className="block break-all font-mono text-[11px] text-muted">{item.id} · {item.scopeMode}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </details>
              </GrantStep>

              <GrantStep index="03" title="选择授权范围">
                <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
                  <div className="rounded-lg bg-white/55 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
                    <div className="text-xs font-semibold text-muted">当前集群</div>
                    <div className="mt-1 font-mono text-sm font-semibold text-on-surface">{activeCluster?.name || activeClusterId || '未选择'}</div>
                    <div className="mt-1 text-[11px] text-muted">{activeCluster?.readOnly ? '只读接入' : activeCluster?.accessMode || 'cluster context'}</div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-3">
                    <ScopeModeButton
                      active={effectiveScopeMode === 'cluster'}
                      disabled={isGlobalGrant || hasNamespacePermissions}
                      label="当前集群级"
                      meta="凭据、命名空间管理、集群 RBAC 等集群维度能力"
                      onClick={() => setScopeMode('cluster')}
                    />
                    <ScopeModeButton
                      active={effectiveScopeMode === 'selected-namespaces'}
                      disabled={isGlobalGrant || !hasNamespacePermissions}
                      label="命名空间多选"
                      meta="适合按业务空间授权用户组"
                      onClick={() => setScopeMode('selected-namespaces')}
                    />
                    <ScopeModeButton
                      active={effectiveScopeMode === 'all-namespaces'}
                      disabled={isGlobalGrant || !hasNamespacePermissions}
                      label="整个集群全部命名空间"
                      meta="适合集群级 SRE 或发布管理员"
                      onClick={() => setScopeMode('all-namespaces')}
                    />
                  </div>
                </div>
                {effectiveScopeMode === 'selected-namespaces' ? (
                  <div className="mt-3 rounded-lg border border-[rgba(13,91,215,0.12)] bg-white/45 px-3 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-on-surface">命名空间多选</div>
                        <div className="mt-1 text-xs text-muted">已选择 {selectedNamespaces.length} 个命名空间，授权会拆成独立 binding，便于后续逐个删除。</div>
                      </div>
                      <span className="rounded-md bg-primary-soft px-2 py-1 font-mono text-[11px] font-semibold text-primary">{selectedNamespaces.length || 0}/{namespaces.length}</span>
                    </div>
                    <input
                      className="console-input mt-3 w-full"
                      value={namespaceQuery}
                      onChange={(event) => setNamespaceQuery(event.target.value)}
                      placeholder="搜索命名空间"
                      disabled={!namespaces.length}
                    />
                    <div className="mt-3 grid max-h-52 gap-2 overflow-auto pr-1 md:grid-cols-2">
                      {filteredNamespaces.map((item) => (
                        <label key={`${item.clusterId}-${item.name}`} className="flex cursor-pointer items-start gap-3 rounded-lg bg-white/60 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
                          <input
                            className="mt-1 h-4 w-4 accent-primary"
                            type="checkbox"
                            checked={selectedNamespaces.includes(item.name)}
                            onChange={() => toggleNamespaceSelection(item.name)}
                          />
                          <span className="min-w-0">
                            <span className="block break-all font-mono text-sm font-semibold text-on-surface">{item.name}</span>
                            <span className="mt-1 block text-[11px] text-muted">{item.phase || item.status || 'namespace'} · {item.owner || 'owner unset'}</span>
                          </span>
                        </label>
                      ))}
                      {!filteredNamespaces.length ? (
                        <div className="rounded-lg bg-white/55 px-3 py-4 text-sm text-muted">暂无匹配命名空间。</div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                {effectiveScopeMode === 'all-namespaces' ? (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm">
                    <div className="font-semibold text-warning">整个集群全部命名空间</div>
                    <div className="mt-1 text-xs leading-5 text-muted">该授权只在当前集群生效，后续新增命名空间也会被匹配；包含发布、终端、导出、RBAC 等高危权限时必须显式确认。</div>
                  </div>
                ) : null}
                {effectiveScopeMode === 'global' ? (
                  <div className="mt-3 rounded-lg border border-[rgba(13,91,215,0.12)] bg-primary-soft px-3 py-3 text-sm font-semibold text-primary">
                    全局授权仅用于模板等平台级 K8s 能力，不会授予任何集群资源写权限。
                  </div>
                ) : null}
                {clusterError || namespaceError ? (
                  <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
                    {clusterError ? '集群列表读取失败，请检查 NovaObs 后端连接。' : `命名空间读取失败：${errorMessage(namespaceError)}`}
                  </div>
                ) : null}
              </GrantStep>

              <GrantStep index="04" title="确认授权">
                <div className="grid gap-2">
                  {permissionIds.map((id) => {
                    const permission = permissionById.get(id);
                    return (
                      <div key={id} className="rounded-lg bg-white/45 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
                        <div className="text-sm font-semibold text-on-surface">{permission?.label || id}</div>
                        <div className="mt-1 break-all font-mono text-[11px] text-muted">{id} · {permission?.scopeMode || 'unknown'}</div>
                      </div>
                    );
                  })}
                </div>
                <div className={`mt-3 rounded-lg px-3 py-3 text-sm ${requiresRiskAccepted ? 'border border-amber-200 bg-amber-50' : 'bg-white/35'}`}>
                  <div className="flex items-start gap-3">
                    <input
                      className="mt-1 h-4 w-4 accent-primary disabled:opacity-40"
                      type="checkbox"
                      checked={riskAccepted}
                      disabled={!requiresRiskAccepted}
                      onChange={(event) => setRiskAccepted(event.target.checked)}
                    />
                    <div>
                      <div className={`font-semibold ${requiresRiskAccepted ? 'text-warning' : 'text-muted'}`}>高危授权确认</div>
                      <div className="mt-1 text-xs leading-5 text-muted">
                        {requiresRiskAccepted
                          ? '当前授权覆盖多个命名空间、整个集群命名空间或集群级高危能力，且包含发布、删除、终端、导出、RBAC、凭据等权限；确认后才允许提交。'
                          : '当前选择未触发宽范围高危授权门禁。'}
                      </div>
                    </div>
                  </div>
                </div>
              </GrantStep>
            </section>

            <GrantSummaryCard
              subjectType={subjectType}
              subjectId={subjectId}
              profile={selectedProfile}
              permissionIds={permissionIds}
              clusterLabel={targetClusterLabel}
              namespaceLabel={targetNamespaceLabel}
              scopeMode={effectiveScopeMode}
              riskBlocked={requiresRiskAccepted && !riskAccepted}
              canCreate={canCreate}
              pending={createMutation.isPending}
              onCreate={() => createMutation.mutate()}
            />
          </div>
        ) : null}

        {activeTab === 'bindings' ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
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
                      <td className="text-xs text-muted">{permissionSummary(item.permissionIds)}</td>
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
            <SelectedBindingPanel target={currentTarget} pending={deleteMutation.isPending} onDelete={() => deleteMutation.mutate()} />
          </div>
        ) : null}
      </DataPanel>
    </div>
  );
}

function AccessTabNav({ activeTab, onChange }: { activeTab: AccessTab; onChange: (tab: AccessTab) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-surface-low px-1 py-1">
      {accessTabs.map((tab) => (
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

function GrantStep({ index, title, children }: { index: string; title: string; children: ReactNode }) {
  return (
    <section className="console-panel px-4 py-3">
      <div className="mb-3 flex items-start gap-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary-soft font-mono text-xs font-semibold text-primary">{index}</span>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-on-surface">{title}</div>
        </div>
      </div>
      {children}
    </section>
  );
}

function ScopeModeButton({
  active,
  disabled,
  label,
  meta,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  label: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`rounded-lg border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${active ? 'border-primary bg-primary-soft text-primary' : 'border-[rgba(13,91,215,0.12)] bg-white/55 text-on-surface hover:bg-white/80'}`}
      type="button"
      disabled={disabled}
      onClick={onClick}
    >
      <span className="block text-sm font-semibold">{label}</span>
      <span className="mt-1 block text-xs leading-5 text-muted">{meta}</span>
    </button>
  );
}

function GrantSummaryCard({
  subjectType,
  subjectId,
  profile,
  permissionIds,
  clusterLabel,
  namespaceLabel,
  scopeMode,
  riskBlocked,
  canCreate,
  pending,
  onCreate,
}: {
  subjectType: string;
  subjectId: string;
  profile?: K8sPlatformAccessProfile;
  permissionIds: string[];
  clusterLabel: string;
  namespaceLabel: string;
  scopeMode: GrantScopeMode;
  riskBlocked: boolean;
  canCreate: boolean;
  pending: boolean;
  onCreate: () => void;
}) {
  return (
    <aside className="console-panel sticky top-3 h-fit px-4 py-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-primary" />
        <div>
          <div className="text-sm font-semibold text-on-surface">授权摘要</div>
          <div className="mt-1 text-[11px] text-muted">有效变更预览</div>
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-xs">
        <SummaryLine label="授权主体" value={`${subjectType}/${subjectId || '-'}`} />
        <SummaryLine label="权限包" value={profile?.label || '自定义权限'} />
        <SummaryLine label="目标集群" value={clusterLabel} />
        <SummaryLine label="命名空间" value={namespaceLabel} />
        <SummaryLine label="授权模式" value={scopeModeSummary(scopeMode)} />
        <SummaryLine label="风险等级" value={riskLabel(profile?.risk || 'unknown')} />
        <SummaryLine label="权限数量" value={`${permissionIds.length} 项`} />
      </div>
      {riskBlocked ? (
        <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-warning">
          需要先勾选高危授权确认，才能创建该组授权。
        </div>
      ) : null}
      <button
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={!canCreate || pending}
        onClick={onCreate}
      >
        <Plus className="h-4 w-4" />
        授权
      </button>
    </aside>
  );
}

function SelectedBindingPanel({ target, pending, onDelete }: { target?: K8sPlatformAccessBinding; pending: boolean; onDelete: () => void }) {
  return (
    <aside className="console-panel px-4 py-3">
      <div className="text-sm font-semibold text-on-surface">绑定详情</div>
      {target ? (
        <>
          <div className="mt-3 grid gap-2 text-xs">
            <SummaryLine label="主体" value={`${target.subjectType}/${target.subjectId}`} />
            <SummaryLine label="Scope" value={formatScope(target.scope)} />
            <SummaryLine label="命名空间范围" value={scopeNamespaceDetail(target.scope)} />
            <SummaryLine label="Role" value={target.roleName || target.roleId} />
            <SummaryLine label="Binding ID" value={target.id} />
          </div>
          <button
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-sm font-semibold text-danger shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pending}
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
            删除绑定
          </button>
        </>
      ) : (
        <div className="mt-3 rounded-lg bg-white/45 px-3 py-4 text-sm text-muted">请选择一条绑定。</div>
      )}
    </aside>
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

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/45 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
      <div className="text-[11px] font-semibold text-muted">{label}</div>
      <div className="mt-1 break-all font-mono text-xs font-semibold text-on-surface">{value}</div>
    </div>
  );
}

function scopeSummaryLabel(scopeMode: GrantScopeMode, selectedNamespaces: string[]) {
  switch (scopeMode) {
    case 'global':
      return '全局授权';
    case 'cluster':
      return '集群级授权';
    case 'all-namespaces':
      return '整个集群全部命名空间';
    case 'selected-namespaces':
      if (!selectedNamespaces.length) return '未选择';
      if (selectedNamespaces.length <= 3) return selectedNamespaces.join(', ');
      return `${selectedNamespaces.slice(0, 3).join(', ')} 等 ${selectedNamespaces.length} 个`;
    default:
      return '未选择';
  }
}

function scopeModeSummary(scopeMode: GrantScopeMode) {
  switch (scopeMode) {
    case 'global':
      return 'global';
    case 'cluster':
      return 'cluster';
    case 'all-namespaces':
      return 'cluster/namespaces=*';
    case 'selected-namespaces':
      return 'cluster/namespaces[]';
    default:
      return 'unknown';
  }
}

function formatScope(scope: K8sPlatformAccessBinding['scope']) {
  if (scope.global) return 'global';
  if (scope.allNamespaces) return `${scope.clusterId || '-'}/namespaces=*`;
  if (scope.namespaces.length) return `${scope.clusterId || '-'}/${scope.namespaces.length} namespaces`;
  return `${scope.clusterId || '-'}/${scope.namespace || 'cluster-scoped'}`;
}

function scopeNamespaceDetail(scope: K8sPlatformAccessBinding['scope']) {
  if (scope.global) return '全局授权';
  if (scope.allNamespaces) return '整个集群全部命名空间';
  if (scope.namespaces.length) return scope.namespaces.join(', ');
  return scope.namespace || '集群级授权';
}

function permissionSummary(permissionIds: string[]) {
  if (!permissionIds.length) return '-';
  if (permissionIds.length <= 3) return permissionIds.join(' · ');
  return `${permissionIds.slice(0, 3).join(' · ')} 等 ${permissionIds.length} 项`;
}

function isHighRiskPermissionId(id: string) {
  switch (id) {
    case 'k8s.namespace:manage':
    case 'k8s.service-account:manage':
    case 'k8s.credential:manage':
    case 'k8s.kubeconfig:export':
    case 'k8s.deploy:apply':
    case 'k8s.deploy:delete':
    case 'k8s.deploy:rollback':
    case 'k8s.certificate:manage':
    case 'k8s.terminal:exec':
    case 'k8s.rbac:manage':
    case 'k8s.cluster-rbac:manage':
      return true;
    default:
      return false;
  }
}

function isClusterWideHighRiskPermissionId(id: string) {
  switch (id) {
    case 'k8s.namespace:manage':
    case 'k8s.credential:manage':
    case 'k8s.cluster-rbac:manage':
      return true;
    default:
      return false;
  }
}

function riskLabel(risk: string) {
  switch (risk) {
    case 'low':
      return '低风险';
    case 'medium':
      return '中风险';
    case 'high':
      return '高风险';
    case 'critical':
      return '关键风险';
    default:
      return '未知风险';
  }
}

function riskClassName(risk: string) {
  switch (risk) {
    case 'low':
      return 'bg-primary-soft text-primary';
    case 'medium':
      return 'bg-amber-50 text-warning';
    case 'high':
    case 'critical':
      return 'bg-red-50 text-danger';
    default:
      return 'bg-white/70 text-muted';
  }
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
