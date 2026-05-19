import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Plus, ShieldAlert, ShieldCheck, Trash2, UserRoundCheck } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { k8sApi, type K8sServiceAccount } from './api';

const DEFAULT_CLUSTER = 'prod';
const DEFAULT_NAMESPACE = 'orders';

export function K8sServiceAccountPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('orders-reader');
  const [selected, setSelected] = useState<K8sServiceAccount | null>(null);
  const [lastAuditId, setLastAuditId] = useState('');

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['k8s-service-accounts', DEFAULT_CLUSTER, DEFAULT_NAMESPACE],
    queryFn: () => k8sApi.listServiceAccounts(DEFAULT_CLUSTER, DEFAULT_NAMESPACE),
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: () => k8sApi.createServiceAccount({ clusterId: DEFAULT_CLUSTER, namespace: DEFAULT_NAMESPACE, name }),
    onSuccess: (result) => {
      setLastAuditId(result.auditId);
      setSelected(result.item ?? null);
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
      queryClient.invalidateQueries({ queryKey: ['k8s-service-accounts'] });
    },
  });

  const permissionError = useMemo(() => {
    const message = createMutation.error?.message || deleteMutation.error?.message || '';
    return message.includes('无权') || message.includes('permission_denied') ? message : '';
  }, [createMutation.error, deleteMutation.error]);

  const currentTarget = selected ?? data[0];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr_0.9fr]">
        <ServiceAccountMetric icon={UserRoundCheck} label="ServiceAccount" value={String(data.length)} meta="cluster/prod namespace/orders" />
        <ServiceAccountMetric icon={ShieldCheck} label="权限模型" value="RBAC" meta="k8s.service-account" />
        <ServiceAccountMetric icon={KeyRound} label="敏感输出" value="none" meta="token hidden" />
      </div>

      <DataPanel title="ServiceAccount" meta={isLoading ? '加载中' : `${data.length} 个账号 · 写操作受 RBAC 控制`}>
        {error ? (
          <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            ServiceAccount API 暂未连接，等待后端 `/api/v1/k8s/service-accounts`。
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

        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="overflow-auto">
            {isLoading ? (
              <div className="rounded-lg bg-white/45 px-4 py-8 text-center text-sm font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
                正在读取 ServiceAccount。
              </div>
            ) : null}
            {!isLoading && !error && data.length ? (
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
            {!isLoading && !error && !data.length ? (
              <div className="rounded-lg bg-white/45 px-4 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
                <div className="font-semibold text-on-surface">暂无 ServiceAccount</div>
                <p className="mt-2 text-sm text-muted">当前命名空间没有返回服务账号。</p>
              </div>
            ) : null}
          </div>

          <aside className="console-panel px-4 py-3">
            <div className="text-sm font-semibold text-on-surface">写操作确认</div>
            <p className="mt-1 text-xs text-muted">提交前确认 cluster/namespace/name，成功后返回审计 ID。</p>
            <label className="mt-4 block text-xs font-semibold text-muted" htmlFor="service-account-name">Name</label>
            <input
              id="service-account-name"
              className="console-input mt-2 w-full"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <div className="mt-4 rounded-lg bg-white/45 px-3 py-3 text-xs text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
              <div className="font-mono">cluster={DEFAULT_CLUSTER}</div>
              <div className="font-mono">namespace={DEFAULT_NAMESPACE}</div>
              <div className="mt-2">不会在页面、日志或响应中展示 token。</div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!name.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                <Plus className="h-4 w-4" />
                创建
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
