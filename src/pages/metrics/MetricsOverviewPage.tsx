import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { RefreshCw, ScanSearch } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { EmptyState } from '../../components/EmptyState';
import { api } from '../../services/api';
import { metricsApi, type MetricsHealthStatus } from './api';

const healthLabels: Record<MetricsHealthStatus, string> = { healthy: '正常', degraded: '降级', failed: '失败', unknown: '未验证' };
const healthClasses: Record<MetricsHealthStatus, string> = { healthy: 'text-success', degraded: 'text-warning', failed: 'text-danger', unknown: 'text-muted' };

export function MetricsOverviewPage() {
  const queryClient = useQueryClient();
  const productsQuery = useQuery({ queryKey: ['products'], queryFn: api.getProducts, retry: false });
  const overviewQuery = useQuery({ queryKey: ['metrics-overview'], queryFn: metricsApi.listOverview, retry: false, refetchInterval: 30_000 });
  const verifyMutation = useMutation({ mutationFn: metricsApi.verifyIntegration, onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['metrics-overview'] }) });
  const names = new Map((productsQuery.data ?? []).map((item) => [item.id, item.name]));
  const items = overviewQuery.data ?? [];
  const error = productsQuery.error || overviewQuery.error;
  const loading = productsQuery.isLoading || overviewQuery.isLoading;
  const refresh = () => void Promise.all([productsQuery.refetch(), overviewQuery.refetch()]);

  return <div className="console-workbench min-h-0 overflow-auto"><DataPanel title="监控总览" help="健康状态来自显式验证快照，依次区分配置、目标连通、数据新鲜度和来源信号覆盖；缺失信号不会显示为 0。" action={<button type="button" className="console-icon-button" aria-label="刷新监控总览" title="刷新监控总览" onClick={refresh}><RefreshCw className={`h-3.5 w-3.5 ${productsQuery.isFetching || overviewQuery.isFetching ? 'animate-spin' : ''}`} /></button>}>
    {loading ? <Skeleton /> : error ? <EmptyState title="监控总览加载失败" action={<button type="button" className="console-button" onClick={refresh}>重试</button>} /> : items.length === 0 ? <EmptyState title="尚无已接入指标的产品" action={<Link className="console-button console-button-primary" to="/metrics/integrations">接入产品指标</Link>} /> : <div className="overflow-hidden rounded-md border border-outline bg-white"><table className="console-table w-full min-w-[1120px] table-fixed"><colgroup><col className="w-[18%]" /><col className="w-[13%]" /><col className="w-[10%]" /><col className="w-[11%]" /><col className="w-[11%]" /><col className="w-[12%]" /><col className="w-[15%]" /><col className="w-[10%]" /></colgroup><thead><tr><th>产品</th><th>写入目标</th><th>配置</th><th>目标连通</th><th>数据新鲜度</th><th>来源覆盖</th><th>USE / 对象健康</th><th className="text-right">操作</th></tr></thead><tbody>{items.map((item) => {
      const snapshot = item.latestSnapshot;
      const sourceStatus = aggregateSourceStatus(snapshot?.sources.map((source) => source.status) ?? []);
      return <tr key={item.integration.id}><td><div className="font-semibold">{names.get(item.integration.productId) || item.integration.productId}</div><div className="font-mono text-[11px] text-muted">{item.integration.productId}</div>{snapshot ? <div className="mt-1 text-[11px] text-muted">验证于 {new Date(snapshot.createdAt).toLocaleString()}</div> : null}</td><td className="font-mono text-[11px] text-muted">{item.integration.destinationRef}</td><td><Health status={snapshot?.configuration.status ?? 'unknown'} message={snapshot?.configuration.message} /></td><td><Health status={snapshot?.destination.status ?? 'unknown'} message={snapshot?.destination.message} /></td><td><Health status={snapshot?.dataFlow.status ?? 'unknown'} message={snapshot?.dataFlow.message} /></td><td><Health status={sourceStatus} message={snapshot ? snapshot.sources.map((source) => source.message).join('；') : `${item.sourceAccesses.length} 个来源待验证`} /></td><td>{snapshot?.signals.length ? <div className="space-y-1">{snapshot.signals.map((signal) => <div key={signal.key} className={`flex justify-between gap-2 text-[11px] ${healthClasses[signal.status]}`}><span>{signal.label}</span><span className="font-mono">{signal.unit === 'ratio' ? `${(signal.value * 100).toFixed(1)}%` : signal.value.toFixed(0)}</span></div>)}</div> : <span className="text-xs text-muted">未验证</span>}</td><td className="text-right"><button type="button" className="console-button h-7 px-2" disabled={verifyMutation.isPending} onClick={() => verifyMutation.mutate(item.integration.id)}><ScanSearch className="h-3.5 w-3.5" />验证</button></td></tr>;
    })}</tbody></table></div>}
    {verifyMutation.error ? <div className="mt-3 console-notice console-notice-danger">{verifyMutation.error instanceof Error ? verifyMutation.error.message : '验证失败'}</div> : null}
  </DataPanel></div>;
}

function Health({ status, message }: { status: MetricsHealthStatus; message?: string }) {
  return <span className={`inline-flex items-center gap-1 text-xs font-semibold ${healthClasses[status]}`} title={message || healthLabels[status]}><span className="h-1.5 w-1.5 rounded-full bg-current" />{healthLabels[status]}</span>;
}

function aggregateSourceStatus(statuses: MetricsHealthStatus[]): MetricsHealthStatus {
  if (statuses.length === 0) return 'unknown';
  if (statuses.includes('failed')) return 'failed';
  if (statuses.includes('degraded')) return 'degraded';
  if (statuses.every((status) => status === 'healthy')) return 'healthy';
  return 'unknown';
}

function Skeleton() { return <div className="space-y-2"><div className="h-10 rounded bg-surface" /><div className="h-10 rounded bg-surface" /></div>; }
