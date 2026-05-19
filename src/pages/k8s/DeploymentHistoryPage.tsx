import { useQuery } from '@tanstack/react-query';
import { GitBranch, History, RotateCcw } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { k8sApi } from './api';

export function K8sDeploymentHistoryPage() {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['k8s-deployment-history', 'prod'],
    queryFn: () => k8sApi.listDeploymentHistory('prod'),
    retry: false,
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <HistoryMetric icon={History} label="部署记录" value={String(data.length)} meta="cluster/prod" />
        <HistoryMetric icon={GitBranch} label="版本维度" value="revision" meta="rollout trace" />
        <HistoryMetric icon={RotateCcw} label="回滚依据" value="read-only" meta="audit first" />
      </div>

      <DataPanel title="部署历史" meta={isLoading ? '加载中' : `${data.length} 条记录 · 最近 15 分钟`}>
        {error ? <Warning text="部署历史 API 暂未连接，等待后端 `/api/v1/k8s/deployment-history`。" /> : null}
        {isLoading ? <Loading text="正在读取部署历史。" /> : null}
        {!isLoading && !error && data.length ? (
          <div className="overflow-auto">
            <table className="console-table min-w-[880px] w-full">
              <thead>
                <tr>
                  <th>Workload</th>
                  <th>集群</th>
                  <th>命名空间</th>
                  <th>动作</th>
                  <th>版本</th>
                  <th>执行人</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item.id} className="bg-white/35 hover:bg-white/60">
                    <td className="font-semibold text-primary">{item.workload}</td>
                    <td className="font-mono text-xs">{item.clusterId}</td>
                    <td className="font-mono text-xs">{item.namespace}</td>
                    <td className="font-mono text-xs">{item.action}</td>
                    <td className="font-mono text-xs">{item.revision || '-'}</td>
                    <td className="text-xs text-muted">{item.actor || '-'}</td>
                    <td><StatusPill status={item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {!isLoading && !error && !data.length ? <Empty text="暂无部署历史" /> : null}
      </DataPanel>
    </div>
  );
}

function HistoryMetric({ icon: Icon, label, value, meta }: { icon: typeof History; label: string; value: string; meta: string }) {
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

function Warning({ text }: { text: string }) {
  return <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">{text}</div>;
}

function Loading({ text }: { text: string }) {
  return <div className="rounded-lg bg-white/45 px-4 py-8 text-center text-sm font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">{text}</div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg bg-white/45 px-4 py-8 text-center font-semibold text-on-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">{text}</div>;
}

function StatusPill({ status }: { status: string }) {
  const warning = status === 'warning';
  return <span className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold ${warning ? 'bg-amber-100 text-warning' : 'bg-primary-soft text-primary'}`}>{warning ? '警告' : status || 'unknown'}</span>;
}
