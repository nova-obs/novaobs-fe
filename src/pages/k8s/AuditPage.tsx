import { useQuery } from '@tanstack/react-query';
import { FileClock, Fingerprint, ShieldCheck } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { k8sApi } from './api';

export function K8sAuditPage() {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['k8s-audit-events', 'prod'],
    queryFn: () => k8sApi.listAuditEvents('prod'),
    retry: false,
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <AuditMetric icon={FileClock} label="审计事件" value={String(data.length)} meta="cluster/prod" />
        <AuditMetric icon={Fingerprint} label="Trace" value="trace_id" meta="request lineage" />
        <AuditMetric icon={ShieldCheck} label="权限上下文" value="RBAC" meta="NovaObs policy" />
      </div>

      <DataPanel title="操作审计" meta={isLoading ? '加载中' : `${data.length} 条事件 · 最近 15 分钟`}>
        {error ? (
          <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
            操作审计 API 暂未连接，等待后端 `/api/v1/k8s/audit-events`。
          </div>
        ) : null}
        {isLoading ? (
          <div className="rounded-lg bg-white/45 px-4 py-8 text-center text-sm font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">正在读取操作审计。</div>
        ) : null}
        {!isLoading && !error && data.length ? (
          <div className="overflow-auto">
            <table className="console-table min-w-[880px] w-full">
              <thead>
                <tr>
                  <th>资源</th>
                  <th>集群</th>
                  <th>命名空间</th>
                  <th>动作</th>
                  <th>Actor</th>
                  <th>Trace</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item.id} className="bg-white/35 hover:bg-white/60">
                    <td>
                      <div className="font-semibold text-primary">{item.resourceName}</div>
                      <div className="text-[11px] text-muted">{item.resourceKind}</div>
                    </td>
                    <td className="font-mono text-xs">{item.clusterId}</td>
                    <td className="font-mono text-xs">{item.namespace}</td>
                    <td className="font-mono text-xs">{item.action}</td>
                    <td className="text-xs text-muted">{item.actor || '-'}</td>
                    <td className="font-mono text-[11px] text-muted">{item.traceId || '-'}</td>
                    <td><StatusPill status={item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {!isLoading && !error && !data.length ? (
          <div className="rounded-lg bg-white/45 px-4 py-8 text-center font-semibold text-on-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]">暂无操作审计</div>
        ) : null}
      </DataPanel>
    </div>
  );
}

function AuditMetric({ icon: Icon, label, value, meta }: { icon: typeof FileClock; label: string; value: string; meta: string }) {
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
  const warning = status === 'warning';
  return <span className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold ${warning ? 'bg-amber-100 text-warning' : 'bg-primary-soft text-primary'}`}>{warning ? '警告' : status || 'unknown'}</span>;
}
