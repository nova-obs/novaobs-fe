import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, CheckCircle, RefreshCw, XCircle } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { api } from '../../services/api';
import type { AgentDetail } from '../../services/types';
import { shortHash, sourceTypeLabel } from '../pipelines/pipelineConfig';

function runtimeStatusLabel(status: string) {
  const labels: Record<string, string> = { online: '在线', stale: '心跳超时', offline: '离线' };
  return labels[status] ?? status;
}

function runtimeStatusColor(status: string) {
  if (status === 'online') return 'text-primary';
  if (status === 'stale') return 'text-amber-500';
  return 'text-muted';
}

function formatTime(value: string) {
  return value ? value.replace('T', ' ').replace('Z', '') : '-';
}

function ageText(value: string) {
  if (!value) return '-';
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  return `${Math.round(seconds / 3600)}h ago`;
}

export function AgentDetailPage() {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();

  const { data: detail, isLoading, error, refetch } = useQuery({
    queryKey: ['agent-detail', uid],
    queryFn: () => api.getAgentDetail(uid!),
    enabled: !!uid,
    refetchInterval: 10000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 py-12 text-sm text-muted">
        <RefreshCw className="h-4 w-4 animate-spin" />加载 Agent 详情...
      </div>
    );
  }

  if (error) {
    return (
      <DataPanel title="加载失败" meta="Agent Detail">
        <div className="flex items-center gap-3 py-4">
          <XCircle className="h-5 w-5 text-red-400" />
          <p className="text-sm text-muted">{(error as Error).message || '无法加载 Agent 详情'}</p>
          <button className="rounded bg-primary px-3 py-1.5 text-xs font-semibold text-white" onClick={() => refetch()}>重试</button>
        </div>
      </DataPanel>
    );
  }

  if (!detail) return null;

  const { runtime, agent, services, onboardings, configuration } = detail;
  const service = services[0] ?? null;
  const inSync = configuration.inSync;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted">
            <button className="inline-flex items-center gap-1 hover:text-primary" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-3 w-3" />返回
            </button>
            <span>/</span>
            <Link className="hover:text-primary" to="/logs?tab=pipelines&section=config">Logs Pipeline</Link>
            <span>/</span>
            <span className="text-primary">Agent Detail</span>
          </div>
          <h1 className="truncate font-display text-2xl font-semibold text-on-surface">{detail.instanceUid}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            <span className={`font-semibold ${runtime.online ? 'text-primary' : 'text-muted'}`}>{runtime.online ? 'online' : 'offline'}</span>
            <span className={`font-semibold ${runtime.healthy ? 'text-primary' : 'text-amber-500'}`}>{runtime.healthy ? 'healthy' : 'unhealthy'}</span>
            <span className={`font-semibold ${runtimeStatusColor(runtime.runtimeStatus)}`}>{runtimeStatusLabel(runtime.runtimeStatus)}</span>
            <span className="text-muted">last seen: {ageText(runtime.lastSeenAt)}</span>
          </div>
        </div>
        <button className="rounded p-2 text-muted hover:bg-surface-low hover:text-on-surface" onClick={() => refetch()} title="刷新">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {!runtime.remoteConfigCapable ? (
        <Notice tone="amber" title="该 Agent 不支持 Remote Config" message="需要使用支持 AcceptsRemoteConfig 的 OpAMP Agent 或 Supervisor，才能接收平台下发的服务级配置。" />
      ) : null}
      {configuration.expectedConfigHash && inSync ? (
        <Notice tone="green" title="配置已对齐" message={`发布目标与 Agent effective config 一致，hash ${shortHash(configuration.effectiveConfigHash)}`} />
      ) : null}
      {configuration.expectedConfigHash && !inSync ? (
        <Notice tone="amber" title="配置存在差异" message={`target ${shortHash(configuration.expectedConfigHash)} / effective ${shortHash(configuration.effectiveConfigHash)}`} />
      ) : null}

      <div className="grid items-start gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <DataPanel title="运行态" meta={runtimeStatusLabel(runtime.runtimeStatus)}>
            <InfoGrid items={[
              ['服务', service ? service.displayName || service.name : runtime.serviceId || '-'],
              ['环境', service?.environment || '-'],
              ['Service ID', runtime.serviceId || '-'],
              ['Remote Config', runtime.remoteConfigStatus || 'unset'],
              ['支持下发', String(runtime.remoteConfigCapable)],
              ['版本', runtime.version || '-'],
              ['主机', runtime.hostname || '-'],
              ['Pod', runtime.podName || '-'],
              ['Node', runtime.nodeName || '-'],
              ['IP', runtime.ip || '-'],
              ['最后心跳', formatTime(runtime.lastSeenAt)],
              ['能力位', String(runtime.capabilities)],
            ]} />
            {runtime.lastError ? <p className="mt-3 rounded border border-red-500/30 bg-red-900/10 p-2 font-mono text-xs text-red-400">{runtime.lastError}</p> : null}
          </DataPanel>

          <DataPanel title="服务绑定" meta={`${services.length} 个服务 · ${onboardings.length} 条接入记录`}>
            {services.length === 0 ? <p className="py-3 text-sm text-muted">暂无服务绑定。</p> : (
              <div className="space-y-2">
                {services.map((item) => (
                  <div key={item.id} className="rounded border border-outline bg-surface-lowest p-3">
                    <div className="font-semibold text-primary">{item.displayName || item.name}</div>
                    <div className="mt-1 text-xs text-muted">{item.environment || '-'} · {item.cluster || '-'} · {item.namespace || '-'}</div>
                    <div className="mt-1 text-xs text-muted">owner: {item.ownerTeam || item.owner || '-'}</div>
                  </div>
                ))}
              </div>
            )}
          </DataPanel>

          <DataPanel title="属性" meta={`${agent.identifyingAttributes.length} identifying · ${agent.nonIdentifyingAttributes.length} other`}>
            <AttributeList title="Identifying" items={agent.identifyingAttributes} />
            <AttributeList title="Non-identifying" items={agent.nonIdentifyingAttributes} />
          </DataPanel>
        </div>

        <div className="space-y-4">
          <DataPanel title="配置状态" meta={configuration.applyStatus || runtime.remoteConfigStatus || 'unset'}>
            <div className="grid gap-2 md:grid-cols-3">
              <HashCard label="发布目标" value={configuration.expectedConfigHash} />
              <HashCard label="当前生效" value={configuration.effectiveConfigHash} />
              <HashCard label="最近下发" value={configuration.lastRemoteConfigHash} />
            </div>
            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              <ConfigBlock title="当前生效配置" body={configuration.effectiveConfig} />
              <ConfigBlock title="最近下发配置" body={configuration.lastRemoteConfig} />
            </div>
          </DataPanel>

          <DataPanel title="配置来源" meta={`${configuration.configSources?.sourceBreakdown.length ?? 0} 个来源`}>
            <SourceBreakdown detail={detail} />
          </DataPanel>
        </div>
      </div>
    </div>
  );
}

function InfoGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="grid grid-cols-2 gap-3 text-xs">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <div className="text-muted">{label}</div>
          <div className="mt-0.5 break-all font-mono text-on-surface">{value}</div>
        </div>
      ))}
    </div>
  );
}

function HashCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-outline bg-surface-lowest p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 break-all font-mono text-xs text-on-surface">{value || '-'}</div>
    </div>
  );
}

function ConfigBlock({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-muted">{title}</div>
      <pre className="max-h-80 overflow-auto rounded border border-outline bg-white p-3 font-mono text-[11px] text-on-surface whitespace-pre-wrap break-all">
        {body || '(empty)'}
      </pre>
    </div>
  );
}

function AttributeList({ title, items }: { title: string; items: Array<{ key: string; valueText: string }> }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-2 text-xs font-semibold text-on-surface">{title}</div>
      <div className="space-y-1 max-h-56 overflow-auto">
        {items.map((item, index) => (
          <div key={`${item.key}-${index}`} className="rounded border border-outline bg-surface-lowest p-2 text-xs">
            <div className="font-mono text-primary">{item.key}</div>
            <div className="mt-1 break-all font-mono text-on-surface">{item.valueText}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SourceBreakdown({ detail }: { detail: AgentDetail }) {
  const sources = detail.configuration.configSources;
  if (!sources || sources.sourceBreakdown.length === 0) {
    return <p className="py-3 text-sm text-muted">暂无服务级配置来源。</p>;
  }
  return (
    <div className="space-y-2">
      {sources.sourceBreakdown.map((source) => (
        <div key={`${source.type}-${source.id}`} className="rounded border border-outline bg-surface-lowest p-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-primary">{sourceTypeLabel(source.type)}</span>
            <span className="font-mono text-muted">{shortHash(source.hash)}</span>
          </div>
          <div className="mt-1 text-muted">{source.name || source.id} · {source.status || '-'}</div>
          {source.warnings.length > 0 ? <div className="mt-1 text-amber-500">{source.warnings.join('; ')}</div> : null}
        </div>
      ))}
    </div>
  );
}

function Notice({ tone, title, message }: { tone: 'amber' | 'red' | 'green'; title: string; message: string }) {
  const color = tone === 'red'
    ? 'border-red-500/30 bg-red-900/10 text-red-400'
    : tone === 'green'
      ? 'border-primary/25 bg-primary-soft text-primary'
      : 'border-amber-500/30 bg-amber-900/10 text-amber-500';
  const Icon = tone === 'red' ? XCircle : tone === 'green' ? CheckCircle : AlertTriangle;
  return (
    <div className={`mt-3 flex items-start gap-2 rounded border p-3 ${color}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs">{message}</p>
      </div>
    </div>
  );
}
