import { Boxes } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DataPanel } from '../../components/DataPanel';
import { EmptyState } from '../../components/EmptyState';
import { useK8sOpsContext } from './context';

export function K8sClusterPage() {
  const { clusters, isLoadingClusters, clusterError } = useK8sOpsContext();

  return (
    <div className="space-y-4">
      <DataPanel
        title="可访问集群"
        help="这里只展示由有效 K8S Access Profile 或 Break Glass 授权的集群；集群登记和控制面凭据在平台管理中维护。"
      >
        {clusterError ? (
          <div className="rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm font-semibold text-danger">
            集群列表加载失败：{clusterError.message}
          </div>
        ) : isLoadingClusters ? (
          <div className="space-y-2">
            <div className="console-skeleton h-20" />
            <div className="console-skeleton h-20" />
          </div>
        ) : clusters.length === 0 ? (
          <div>
            <EmptyState title="暂无可访问集群" />
            <p className="-mt-4 pb-4 text-center text-xs text-muted">请联系平台管理员，将你的用户组绑定到 K8S Access Profile。</p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {clusters.map((cluster) => (
              <Link
                key={cluster.id}
                to={`/k8s/clusters/${encodeURIComponent(cluster.id)}`}
                className="group rounded-md border border-outline bg-white p-4 transition hover:border-primary/45 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-on-surface">{cluster.name || cluster.id}</div>
                    <div className="mt-1 font-mono text-[11px] text-muted">{cluster.id}</div>
                  </div>
                  <span className="rounded-md bg-primary/10 p-2 text-primary">
                    <Boxes className="h-4 w-4" />
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted">
                  <span>版本：{cluster.version || '待探测'}</span>
                  <span>区域：{cluster.region || '未设置'}</span>
                  <span>连接：{cluster.accessMode || 'direct'}</span>
                  <span>状态：{cluster.status || 'unknown'}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </DataPanel>
    </div>
  );
}
