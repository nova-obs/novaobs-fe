import { useQuery } from '@tanstack/react-query';
import { Database, Network, ShieldCheck } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { k8sApi } from './api';

export function K8sClusterPage() {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['k8s-clusters'],
    queryFn: () => k8sApi.listClusters(),
    retry: false,
  });
  const useFallback = isLoading || Boolean(error);
  const displayClusters = useFallback ? fallbackClusters : data;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <ClusterMetric icon={Network} label="连接集群" value={String(displayClusters.length)} meta="startorch baseline" />
        <ClusterMetric icon={Database} label="区域" value="cn-shanghai" meta="primary region" />
        <ClusterMetric icon={ShieldCheck} label="权限域" value="global" meta="NovaObs RBAC" />
      </div>

      <DataPanel title="集群列表" meta={isLoading ? '加载中' : `${displayClusters.length} 个集群 · 最近 15 分钟`}>
        {error ? (
          <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            集群 API 暂未连接，等待后端 `/api/v1/k8s/clusters`。
          </div>
        ) : null}
        <div className="overflow-auto">
          {displayClusters.length ? (
            <table className="console-table min-w-[760px] w-full">
              <thead>
                <tr>
                  <th>集群</th>
                  <th>版本</th>
                  <th>区域</th>
                  <th>状态</th>
                  <th>来源</th>
                </tr>
              </thead>
              <tbody>
                {displayClusters.map((cluster) => (
                  <tr key={cluster.id} className="bg-white/35 hover:bg-white/60">
                    <td>
                      <div className="font-semibold text-primary">{cluster.name}</div>
                      <div className="text-[11px] text-muted">{cluster.description || cluster.id}</div>
                    </td>
                    <td className="font-mono text-xs">{cluster.version || '-'}</td>
                    <td className="font-mono text-xs">{cluster.region || '-'}</td>
                    <td><StatusPill status={cluster.status} /></td>
                    <td className="text-xs text-muted">startorch</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="rounded-lg bg-white/45 px-4 py-8 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">
              <div className="font-semibold text-on-surface">暂无集群</div>
              <p className="mt-2 text-sm text-muted">后端已联通，但当前筛选条件下没有返回 Kubernetes 集群。</p>
            </div>
          )}
        </div>
      </DataPanel>
    </div>
  );
}

const fallbackClusters = [
  {
    id: 'prod',
    name: 'prod-core',
    version: 'v1.29.4',
    region: 'cn-shanghai',
    description: '生产核心集群，等待 API 联通',
    status: 'unknown',
  },
];

function ClusterMetric({ icon: Icon, label, value, meta }: { icon: typeof Network; label: string; value: string; meta: string }) {
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
