import { useQuery } from '@tanstack/react-query';
import { Folder, Layers3, ShieldCheck } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { k8sApi } from './api';

const fallbackNamespaces = [
  {
    id: 'orders',
    clusterId: 'prod',
    name: 'orders',
    status: 'unknown',
    owner: 'orders-team',
    phase: 'Active',
    updatedAt: '',
  },
];

export function K8sNamespacePage() {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['k8s-namespaces', 'prod'],
    queryFn: () => k8sApi.listNamespaces('prod'),
    retry: false,
  });
  const useFallback = isLoading || Boolean(error);
  const namespaces = useFallback ? fallbackNamespaces : data;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <NamespaceMetric icon={Folder} label="命名空间" value={String(namespaces.length)} meta="cluster/prod" />
        <NamespaceMetric icon={Layers3} label="资源域" value="tenant" meta="service ownership" />
        <NamespaceMetric icon={ShieldCheck} label="权限范围" value="namespace" meta="NovaObs RBAC" />
      </div>

      <DataPanel title="命名空间列表" meta={`${namespaces.length} 个命名空间 · 最近 15 分钟`}>
        {error ? (
          <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            命名空间 API 暂未连接，等待后端 `/api/v1/k8s/namespaces`。
          </div>
        ) : null}
        {namespaces.length ? (
          <div className="overflow-auto">
            <table className="console-table min-w-[760px] w-full">
              <thead>
                <tr>
                  <th>命名空间</th>
                  <th>集群</th>
                  <th>Phase</th>
                  <th>Owner</th>
                  <th>状态</th>
                  <th>来源</th>
                </tr>
              </thead>
              <tbody>
                {namespaces.map((item) => (
                  <tr key={`${item.clusterId}-${item.name}`} className="bg-white/35 hover:bg-white/60">
                    <td>
                      <div className="font-semibold text-primary">{item.name}</div>
                      <div className="text-[11px] text-muted">{item.id}</div>
                    </td>
                    <td className="font-mono text-xs">{item.clusterId}</td>
                    <td className="font-mono text-xs">{item.phase || '-'}</td>
                    <td className="text-xs text-muted">{item.owner || '-'}</td>
                    <td><StatusPill status={item.status} /></td>
                    <td className="text-xs text-muted">startorch</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg bg-white/45 px-4 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
            <div className="font-semibold text-on-surface">暂无命名空间</div>
            <p className="mt-2 text-sm text-muted">后端已联通，但当前集群没有返回 Kubernetes 命名空间。</p>
          </div>
        )}
      </DataPanel>
    </div>
  );
}

function NamespaceMetric({ icon: Icon, label, value, meta }: { icon: typeof Folder; label: string; value: string; meta: string }) {
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
