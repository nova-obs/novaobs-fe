import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, CheckCircle, RefreshCw, XCircle } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { api } from '../../services/api';
import type { AgentAttribute, AgentDetail } from '../../services/types';

export function AgentDetailPage() {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['agent-detail', uid],
    queryFn: () => api.getAgentDetail(uid!),
    enabled: Boolean(uid),
    refetchInterval: 10000,
  });

  if (query.isLoading) return <div className="console-skeleton h-72" />;
  if (query.error) {
    return (
      <DataPanel title="Agent 详情加载失败">
        <div className="flex items-center gap-3 py-4"><XCircle className="h-5 w-5 text-danger" /><p className="text-sm text-muted">{(query.error as Error).message}</p><button className="console-button console-button-primary" onClick={() => query.refetch()}>重试</button></div>
      </DataPanel>
    );
  }
  if (!query.data) return null;

  const detail = query.data;
  const { runtime, agent, configuration } = detail;
  const connectionStatus = runtime.connectionStatus || (runtime.online ? 'online' : 'offline');
  const processStatus = connectionStatus !== 'online' ? 'unknown' : runtime.processStatus || (runtime.healthy ? 'healthy' : 'unhealthy');
  const configStatus = runtime.configStatus || configuration.applyStatus || runtime.remoteConfigStatus || 'pending';
  const dataStatus = runtime.dataStatus || 'unknown';

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="min-w-0">
          <button className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-primary" onClick={() => navigate(-1)}><ArrowLeft className="h-3.5 w-3.5" />返回采集运行</button>
          <h1 className="page-title truncate">{runtime.hostname || runtime.nodeName || runtime.runtimeIdentity || detail.instanceUid}</h1>
          <p className="page-description font-mono">{runtime.installationId || detail.instanceUid}</p>
        </div>
        <button className="console-icon-button" aria-label="刷新 Agent 详情" title="刷新" onClick={() => query.refetch()}><RefreshCw className={`h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} /></button>
      </div>

      <div className="grid overflow-hidden rounded-md border border-outline bg-white sm:grid-cols-2 xl:grid-cols-4">
        <AxisSummary label="连接状态" value={connectionStatus} description={runtime.lastSeenAt ? `最后心跳 ${formatTime(runtime.lastSeenAt)}` : '尚未收到心跳'} />
        <AxisSummary label="进程状态" value={processStatus} description={connectionStatus === 'online' ? runtime.lastError || 'Collector 进程状态' : '离线时进程状态为未知'} />
        <AxisSummary label="配置状态" value={configStatus} description={configuration.inSync ? '生效配置与期望一致' : configuration.expectedConfigHash ? '尚未收敛到期望配置' : '尚无期望配置'} />
        <AxisSummary label="数据状态" value={dataStatus} description={runtime.lastLogAt ? `最后日志 ${formatTime(runtime.lastLogAt)}` : '尚无日志流入时间'} />
      </div>

      {!runtime.remoteConfigCapable ? <Notice tone="warning" title="Remote Config 不可用" message="该 Agent 未声明远程配置能力，平台不能向它下发采集配置。" /> : null}
      {connectionStatus === 'online' && configuration.expectedConfigHash && !configuration.inSync ? <Notice tone="warning" title="配置尚未收敛" message="Agent 当前生效 hash 与发布目标不一致，请检查应用状态和最近错误。" /> : null}

      <div className="grid gap-3 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-3">
          <DataPanel title="安装与运行身份">
            <InfoGrid items={[
              ['Installation ID', runtime.installationId || '-'],
              ['Host Asset ID', runtime.hostAssetId || '-'],
              ['Agent Role', runtime.agentRole || '-'],
              ['Instance UID', detail.instanceUid],
              ['Runtime Identity', runtime.runtimeIdentity || '-'],
              ['版本', runtime.version || '-'],
              ['主机', runtime.hostname || '-'],
              ['Node', runtime.nodeName || '-'],
              ['Pod', runtime.podName || '-'],
              ['Cluster / Namespace', [runtime.clusterId, runtime.namespace].filter(Boolean).join(' / ') || '-'],
            ]} />
          </DataPanel>
        </div>

        <div className="space-y-3">
          <DataPanel title="配置收敛">
            <InfoGrid items={[
              ['期望 Hash', configuration.expectedConfigHash || '-'],
              ['生效 Hash', configuration.effectiveConfigHash || '-'],
              ['最近下发 Hash', configuration.lastRemoteConfigHash || '-'],
              ['应用状态', configuration.applyStatus || configStatus],
            ]} />
            {runtime.lastError ? <div className="console-notice console-notice-danger mt-3 font-mono text-xs">{runtime.lastError}</div> : null}
          </DataPanel>

          <details className="rounded-md border border-outline bg-white">
            <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-on-surface">高级诊断</summary>
            <div className="space-y-4 border-t border-outline p-3">
              <p className="text-xs text-muted">以下内容用于排障，已对常见凭据字段脱敏；业务页面不以这些原始信息判断运行结果。</p>
              <DiagnosticConfig title="当前生效配置" body={redactConfig(configuration.effectiveConfig)} />
              <DiagnosticConfig title="最近下发配置" body={redactConfig(configuration.lastRemoteConfig)} />
              <AttributeTable title="Identifying Attributes" items={agent.identifyingAttributes} />
              <AttributeTable title="Non-identifying Attributes" items={agent.nonIdentifyingAttributes} />
              <SourceBreakdown detail={detail} />
              <div className="font-mono text-[11px] text-muted">capabilities: {runtime.capabilities} · opamp_instance_uid: {runtime.opampInstanceUid || runtime.instanceUid}</div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

function AxisSummary({ label, value, description }: { label: string; value: string; description: string }) {
  const tone = axisTone(value);
  return (
    <div className="border-b border-outline p-3 sm:border-r xl:border-b-0 last:border-r-0">
      <div className="text-[11px] font-semibold text-muted">{label}</div>
      <div className={`mt-1 inline-flex items-center gap-1.5 text-sm font-semibold ${tone}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{axisLabel(value)}</div>
      <div className="mt-1 text-xs text-muted">{description}</div>
    </div>
  );
}

function InfoGrid({ items }: { items: Array<[string, string]> }) {
  return <div className="grid grid-cols-2 gap-3 text-xs">{items.map(([label, value]) => <div key={label} className="min-w-0"><div className="text-muted">{label}</div><div className="mt-1 break-all font-mono text-on-surface">{value}</div></div>)}</div>;
}

function DiagnosticConfig({ title, body }: { title: string; body: string }) {
  return <section><h3 className="mb-1 text-xs font-semibold">{title}</h3><pre className="max-h-72 overflow-auto rounded border border-outline bg-surface p-3 font-mono text-[11px] leading-5 whitespace-pre-wrap">{body || '(empty)'}</pre></section>;
}

function AttributeTable({ title, items }: { title: string; items: AgentAttribute[] }) {
  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold">{title}</h3>
      {items.length === 0 ? <div className="text-xs text-muted">无属性</div> : <div className="max-h-64 overflow-auto rounded border border-outline"><table className="console-table w-full"><tbody>{items.map((item, index) => <tr key={`${item.key}-${index}`}><td className="font-mono text-xs text-primary">{item.key}</td><td className="break-all font-mono text-xs">{redactValue(item.key, item.valueText)}</td></tr>)}</tbody></table></div>}
    </section>
  );
}

function SourceBreakdown({ detail }: { detail: AgentDetail }) {
  const sources = detail.configuration.configSources?.sourceBreakdown ?? [];
  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold">配置来源</h3>
      {sources.length === 0 ? <div className="text-xs text-muted">无配置来源</div> : <div className="divide-y divide-outline rounded border border-outline">{sources.map((source) => <div key={`${source.type}-${source.id}`} className="p-2 text-xs"><div className="font-semibold">{source.name || source.id}</div><div className="mt-1 font-mono text-muted">{source.type} · {source.status || '-'}</div>{source.warnings.length ? <div className="mt-1 text-warning">{source.warnings.join('；')}</div> : null}</div>)}</div>}
    </section>
  );
}

function Notice({ tone, title, message }: { tone: 'warning' | 'danger' | 'success'; title: string; message: string }) {
  const Icon = tone === 'danger' ? XCircle : tone === 'success' ? CheckCircle : AlertTriangle;
  const className = tone === 'danger' ? 'console-notice-danger' : tone === 'success' ? 'console-notice-success' : 'console-notice-warning';
  return <div className={`console-notice ${className}`}><Icon className="mt-0.5 h-4 w-4 shrink-0" /><div><div className="text-sm font-semibold">{title}</div><div className="mt-1 text-xs">{message}</div></div></div>;
}

function axisTone(value: string) {
  if (['online', 'healthy', 'applied', 'flowing'].includes(value)) return 'text-emerald-700';
  if (['unhealthy', 'failed', 'drift', 'stale'].includes(value)) return 'text-danger';
  if (['applying'].includes(value)) return 'text-primary';
  return 'text-muted';
}

function axisLabel(value: string) {
  const labels: Record<string, string> = {
    online: '在线', offline: '离线', revoked: '已吊销',
    healthy: '健康', unhealthy: '异常', unknown: '未知',
    pending: '待下发', applying: '应用中', applied: '已应用', failed: '失败', drift: '配置漂移',
    flowing: '有数据', stale: '数据中断', no_data: '暂无数据',
  };
  return (labels[value] ?? value) || '-';
}

function redactValue(key: string, value: string) {
  return /(token|secret|password|authorization|api[_-]?key|credential)/i.test(key) ? '******' : value;
}

function redactConfig(value: string) {
  return value
    .split('\n')
    .map((line) => /(token|secret|password|authorization|api[_-]?key|credential)\s*:/i.test(line) ? `${line.split(':')[0]}: ******` : line)
    .join('\n');
}

function formatTime(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}
