import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Plus, ShieldAlert, ShieldCheck, Trash2, UserRoundCheck, X } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { k8sApi, type K8sServiceAccount } from './api';
import { useK8sOpsContext } from './context';

export function K8sServiceAccountPage() {
  const queryClient = useQueryClient();
  const [namespace, setNamespace] = useState('');
  const [name, setName] = useState('');
  const [activeAction, setActiveAction] = useState<'create' | 'delete' | null>(null);
  const [selected, setSelected] = useState<K8sServiceAccount | null>(null);
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
      setSelected(null);
      return;
    }
    if (!namespace && namespaces[0]?.name) {
      setNamespace(namespaces[0].name);
    }
  }, [namespace, namespaces]);

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['k8s-service-accounts', activeClusterId, namespace],
    queryFn: () => k8sApi.listServiceAccounts(activeClusterId, namespace),
    enabled: Boolean(activeClusterId && namespace),
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: () => k8sApi.createServiceAccount({ clusterId: activeClusterId, namespace, name }),
    onSuccess: (result) => {
      setLastAuditId(result.auditId);
      setSelected(result.item ?? null);
      setActiveAction(null);
      setName('');
      queryClient.invalidateQueries({ queryKey: ['k8s-service-accounts'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      const target = selected ?? data[0];
      if (!target) throw new Error('请选择要删除的 ServiceAccount');
      return k8sApi.deleteServiceAccount({ clusterId: target.clusterId, namespace: target.namespace, name: target.name, uid: target.uid });
    },
    onSuccess: (result) => {
      setLastAuditId(result.auditId);
      setSelected(null);
      setActiveAction(null);
      queryClient.invalidateQueries({ queryKey: ['k8s-service-accounts'] });
    },
  });

  const permissionError = useMemo(() => {
    const message = createMutation.error?.message || deleteMutation.error?.message || '';
    return message.includes('无权') || message.includes('permission_denied') ? message : '';
  }, [createMutation.error, deleteMutation.error]);

  const currentTarget = selected ?? data[0];
  const canList = Boolean(activeClusterId && namespace);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr_0.9fr]">
        <ServiceAccountMetric icon={UserRoundCheck} label="ServiceAccount" value={String(data.length)} meta={activeClusterId ? `cluster/${activeClusterId}` : '等待集群'} />
        <ServiceAccountMetric icon={ShieldCheck} label="权限模型" value="RBAC" meta="k8s.service-account" />
        <ServiceAccountMetric icon={KeyRound} label="敏感输出" value="none" meta="token hidden" />
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
        title="ServiceAccount"
        meta={isLoading ? '加载中' : `${data.length} 个账号 · 写操作受 RBAC 控制`}
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <button className="console-button" disabled={!currentTarget} onClick={() => setActiveAction('delete')}><Trash2 className="h-4 w-4" />删除账号</button>
            <button className="console-button console-button-primary" disabled={!activeClusterId || !namespace} onClick={() => setActiveAction('create')}><Plus className="h-4 w-4" />创建账号</button>
          </div>
        )}
      >
        {error ? (
          <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            ServiceAccount 读取失败：{errorMessage(error)}
          </div>
        ) : null}
        {permissionError ? (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            <ShieldAlert className="h-4 w-4" />
            权限不足：当前用户缺少 `k8s.service-account` 写权限，操作已被后端拒绝。
          </div>
        ) : null}
        {lastAuditId ? (
          <div className="mb-3 rounded-lg bg-primary-soft px-3 py-2 text-sm font-semibold text-primary">
            操作已落审计：<span className="font-mono">{lastAuditId}</span>
          </div>
        ) : null}

        <div className="overflow-auto">
          {isLoading ? (
            <div className="rounded-lg bg-white/45 px-4 py-8 text-center text-sm font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
              正在读取 ServiceAccount。
            </div>
          ) : null}
          {!canList ? (
            <div className="rounded-lg bg-white/45 px-4 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
              <div className="font-semibold text-on-surface">请先选择集群和命名空间</div>
              <p className="mt-2 text-sm text-muted">ServiceAccount 按 namespace 级 RBAC 读取，不做默认全命名空间扫描。</p>
            </div>
          ) : null}
          {canList && !isLoading && !error && data.length ? (
            <table className="console-table min-w-[820px] w-full">
              <thead>
                <tr>
                  <th>账号</th>
                  <th>集群</th>
                  <th>命名空间</th>
                  <th>UID</th>
                  <th>状态</th>
                  <th>来源</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr
                    key={item.uid || item.id}
                    className={`cursor-pointer bg-white/35 hover:bg-white/60 ${currentTarget?.uid === item.uid ? 'ring-1 ring-primary/25' : ''}`}
                    onClick={() => setSelected(item)}
                  >
                    <td>
                      <div className="font-semibold text-primary">{item.name}</div>
                      <div className="text-[11px] text-muted">{item.id}</div>
                    </td>
                    <td className="font-mono text-xs">{item.clusterId}</td>
                    <td className="font-mono text-xs">{item.namespace}</td>
                    <td className="font-mono text-[11px] text-muted">{item.uid}</td>
                    <td><StatusPill status={item.status} /></td>
                    <td className="text-xs text-muted">{item.source || 'startorch'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {canList && !isLoading && !error && !data.length ? (
            <div className="rounded-lg bg-white/45 px-4 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
              <div className="font-semibold text-on-surface">暂无 ServiceAccount</div>
              <p className="mt-2 text-sm text-muted">当前命名空间没有返回服务账号。</p>
            </div>
          ) : null}
        </div>
      </DataPanel>

      {activeAction === 'create' ? (
        <ServiceAccountActionDrawer title="创建 ServiceAccount" onClose={() => setActiveAction(null)}>
          <div className="text-sm font-semibold text-on-surface">写操作确认</div>
          <p className="text-xs text-muted">提交前确认 cluster/namespace/name，成功后返回审计 ID。</p>
          <label className="block text-xs font-semibold text-muted" htmlFor="service-account-name">Name</label>
          <input id="service-account-name" className="console-input w-full" value={name} onChange={(event) => setName(event.target.value)} />
          <div className="rounded-lg bg-surface px-3 py-3 text-xs text-muted">
            <div className="font-mono">cluster={activeClusterId || '-'}</div>
            <div className="font-mono">namespace={namespace || '-'}</div>
            <div className="font-mono">name={name || '-'}</div>
            <div className="mt-2">不会在页面、日志或响应中展示 token。</div>
          </div>
          <DrawerFooter>
            <button className="console-button" onClick={() => setActiveAction(null)}>取消</button>
            <button className="console-button console-button-primary" disabled={!activeClusterId || !namespace || !name.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}>创建</button>
          </DrawerFooter>
        </ServiceAccountActionDrawer>
      ) : null}

      {activeAction === 'delete' ? (
        <ServiceAccountActionDrawer title="删除 ServiceAccount" onClose={() => setActiveAction(null)}>
          <div className="text-sm font-semibold text-on-surface">删除确认摘要</div>
          <div className="rounded-lg bg-surface px-3 py-3 text-xs text-muted">
            <div className="font-mono">cluster={currentTarget?.clusterId ?? '-'}</div>
            <div className="font-mono">namespace={currentTarget?.namespace ?? '-'}</div>
            <div className="font-mono">name={currentTarget?.name ?? '-'}</div>
            <div className="font-mono">uid={currentTarget?.uid ?? '-'}</div>
          </div>
          <DrawerFooter>
            <button className="console-button" onClick={() => setActiveAction(null)}>取消</button>
            <button className="console-button console-button-danger" disabled={!currentTarget || deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>删除</button>
          </DrawerFooter>
        </ServiceAccountActionDrawer>
      ) : null}
    </div>
  );
}

function ServiceAccountActionDrawer({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-slate-900/28">
      <button className="absolute inset-0 cursor-default" aria-label={`关闭${title}`} onClick={onClose} />
      <aside className="console-drawer-panel relative flex h-full w-full max-w-[680px] flex-col border-l border-outline bg-white shadow-[0_20px_60px_rgba(24,52,96,0.24)]" role="dialog" aria-modal="true" aria-labelledby="service-account-action-title">
        <header className="flex items-start justify-between gap-4 border-b border-outline px-5 py-4">
          <h2 id="service-account-action-title" className="text-base font-semibold text-on-surface">{title}</h2>
          <button className="console-button h-8 w-8 p-0" aria-label={`关闭${title}`} onClick={onClose}><X className="h-4 w-4" /></button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </div>
  );
}

function DrawerFooter({ children }: { children: ReactNode }) {
  return <div className="mt-auto flex items-center justify-end gap-2 border-t border-outline pt-4">{children}</div>;
}

function ServiceAccountMetric({ icon: Icon, label, value, meta }: { icon: typeof UserRoundCheck; label: string; value: string; meta: string }) {
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

function StatusPill({ status }: { status: string }) {
  const active = status === 'active';
  return (
    <span className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold ${active ? 'bg-primary-soft text-primary' : 'bg-amber-100 text-warning'}`}>
      {active ? '运行中' : status || 'unknown'}
    </span>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : '请检查集群凭据、平台 RBAC 与 Kubernetes API 连通性。';
}
