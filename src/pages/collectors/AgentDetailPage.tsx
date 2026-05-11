import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { api } from '../../services/api';
import type { CollectorInstance } from '../../services/types';

function runtimeStatusLabel(s: string) {
  const m: Record<string, string> = { online: '在线', stale: '心跳超时', offline: '离线' };
  return m[s] ?? s;
}
function runtimeStatusColor(s: string) {
  if (s === 'online') return 'text-emerald-400';
  if (s === 'stale') return 'text-amber-400';
  return 'text-muted';
}

function modeLabel(mode: string) {
  return mode === 'shared_gateway' ? '共享 Gateway' : '独立 Collector';
}

function configAge(lastSeenAt: string): string {
  if (!lastSeenAt) return '-';
  const age = (Date.now() - new Date(lastSeenAt).getTime()) / 1000;
  if (age < 60) return `${Math.round(age)}s ago`;
  if (age < 3600) return `${Math.round(age / 60)}m ago`;
  return `${Math.round(age / 3600)}h ago`;
}

function shortHash(hash: string): string {
  return hash ? `${hash.slice(0, 16)}...` : '-';
}

export function AgentDetailPage() {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [additionalYaml, setAdditionalYaml] = useState('');

  const { data: detail, isLoading, error, refetch } = useQuery({
    queryKey: ['agent-detail', uid],
    queryFn: () => api.getAgentDetail(uid!),
    enabled: !!uid,
    refetchInterval: 10000,
  });

  useEffect(() => {
    setAdditionalYaml(detail?.configuration.additionalConfig?.yamlPatch ?? '');
  }, [detail?.configuration.additionalConfig?.id, detail?.configuration.additionalConfig?.yamlPatch]);

  const saveAdditionalMutation = useMutation({
    mutationFn: (send: boolean) => api.saveAgentAdditionalConfig(detail?.instanceUid ?? uid ?? '', additionalYaml, send),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['agent-detail', uid] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 py-12 text-sm text-muted">
        <RefreshCw className="h-4 w-4 animate-spin" />
        加载 Agent 详情...
      </div>
    );
  }

  if (error) {
    return (
      <DataPanel title="加载失败" meta="error">
        <div className="flex items-center gap-3 py-4">
          <XCircle className="h-5 w-5 text-red-400" />
          <p className="text-sm text-muted">{(error as Error).message || '无法加载 Agent 详情'}</p>
          <button className="rounded bg-primary px-3 py-1.5 text-xs font-semibold text-white" onClick={() => refetch()}>重试</button>
        </div>
      </DataPanel>
    );
  }

  if (!detail) return null;

  const { runtime, agent, collectorGroup, services, onboardings, configuration } = detail;
  const configHashesMatch = configuration.inSync;
  const remoteConfigApplied = runtime.remoteConfigStatus === 'applied';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted">
            <button className="flex items-center gap-1 hover:text-primary" onClick={() => navigate('/collectors')}>
              <ArrowLeft className="h-3 w-3" />采集组
            </button>
            <span>/</span>
            <span className="text-primary">Agent 详情</span>
          </div>
          <h1 className="font-display text-2xl font-semibold text-on-surface font-mono">{detail.instanceUid}</h1>
          <div className="mt-2 flex items-center gap-3">
            <span className={`text-xs font-semibold ${runtime.online ? 'text-emerald-400' : 'text-muted'}`}>
              {runtime.online ? 'online' : 'offline'}
            </span>
            <span className={`text-xs font-semibold ${runtime.healthy ? 'text-emerald-400' : 'text-muted'}`}>
              {runtime.healthy ? 'healthy' : 'unhealthy'}
            </span>
            <span className={`text-xs font-semibold ${runtimeStatusColor(runtime.runtimeStatus)}`}>
              {runtimeStatusLabel(runtime.runtimeStatus)}
              {runtime.lastSeenAgeSeconds < Infinity ? ` (${runtime.lastSeenAgeSeconds}s)` : ''}
            </span>
            <span className="text-xs text-muted">
              last seen: {runtime.lastSeenAt ? configAge(runtime.lastSeenAt) : '-'}
            </span>
          </div>
        </div>
        <button className="rounded p-1 text-muted hover:bg-surface-low hover:text-on-surface" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Remote Config Capable Warning */}
      {!runtime.remoteConfigCapable && (
        <div className="flex items-start gap-3 rounded border border-amber-500/30 bg-amber-900/10 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-400">该 Agent 不支持 Remote Config</p>
            <p className="mt-1 text-xs text-muted">
              需要使用 OpAMP Supervisor 或支持 AcceptsRemoteConfig 的 Agent 才能接收平台下发的 Pipeline 配置。
            </p>
          </div>
        </div>
      )}

      {/* Config Hash Mismatch Warning */}
      {remoteConfigApplied && !configHashesMatch && (
        <div className="flex items-start gap-3 rounded border border-amber-500/30 bg-amber-900/10 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-400">运行配置与目标配置不一致</p>
            <p className="mt-1 text-xs text-muted">
              effective: {shortHash(configuration.effectiveConfigHash)} vs expected: {shortHash(configuration.expectedConfigHash)}
            </p>
          </div>
        </div>
      )}

      {remoteConfigApplied && configHashesMatch && (
        <div className="flex items-start gap-3 rounded border border-emerald-500/30 bg-emerald-900/10 p-4">
          <CheckCircle className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-400">已应用</p>
            <p className="mt-1 text-xs text-muted">
              运行配置与目标配置一致 · hash: {shortHash(configuration.effectiveConfigHash)}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Left Column */}
        <div className="space-y-4">
          {/* Agent Panel */}
          <DataPanel title="Agent" meta={runtime.instanceUid.slice(0, 16) + '…'}>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted">实例 UID</span>
                <div className="font-mono text-on-surface mt-0.5 break-all">{runtime.instanceUid}</div>
              </div>
              <div>
                <span className="text-muted">采集组</span>
                <div className="text-on-surface mt-0.5">{runtime.collectorGroupId || '未分配'}</div>
              </div>
              <div>
                <span className="text-muted">Online</span>
                <div className={`font-semibold mt-0.5 ${runtime.online ? 'text-emerald-400' : 'text-muted'}`}>
                  {String(runtime.online)}
                </div>
              </div>
              <div>
                <span className="text-muted">Healthy</span>
                <div className={`font-semibold mt-0.5 ${runtime.healthy ? 'text-emerald-400' : 'text-muted'}`}>
                  {String(runtime.healthy)}
                </div>
              </div>
              <div>
                <span className="text-muted">支持 Remote Config</span>
                <div className={`font-semibold mt-0.5 ${runtime.remoteConfigCapable ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {String(runtime.remoteConfigCapable)}
                </div>
              </div>
              <div>
                <span className="text-muted">Remote Config 状态</span>
                <div className={`font-semibold mt-0.5 ${runtime.remoteConfigStatus === 'applied' ? 'text-emerald-400' : runtime.remoteConfigStatus === 'failed' ? 'text-red-400' : 'text-muted'}`}>
                  {runtime.remoteConfigStatus || 'unset'}
                </div>
              </div>
              <div>
                <span className="text-muted">主机名</span>
                <div className="text-on-surface mt-0.5">{runtime.hostname || '-'}</div>
              </div>
              <div>
                <span className="text-muted">版本</span>
                <div className="font-mono text-on-surface mt-0.5">{runtime.version || '-'}</div>
              </div>
              <div>
                <span className="text-muted">能力位</span>
                <div className="font-mono text-on-surface mt-0.5">{runtime.capabilities}</div>
              </div>
              <div>
                <span className="text-muted">最后心跳</span>
                <div className="text-on-surface mt-0.5">{runtime.lastSeenAt ? runtime.lastSeenAt.replace('T', ' ').replace('Z', '') : '-'}</div>
              </div>
              {runtime.lastError ? (
                <div className="col-span-2">
                  <span className="text-muted">最近错误</span>
                  <div className="text-red-400 mt-0.5 font-mono break-all">{runtime.lastError}</div>
                </div>
              ) : null}
            </div>
          </DataPanel>

          {/* Attributes Panel */}
          <DataPanel title="属性" meta={`${agent.identifyingAttributes.length} 个标识属性 · ${agent.nonIdentifyingAttributes.length} 个非标识属性`}>
            {agent.identifyingAttributes.length > 0 && (
              <div className="mb-4">
                <div className="text-xs font-semibold text-on-surface mb-2">标识属性</div>
                <div className="overflow-auto">
                  <table className="console-table w-full">
                    <thead>
                      <tr>
                        <th>Key</th>
                        <th>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agent.identifyingAttributes.map((attr, i) => (
                        <tr key={`ident-${i}`} className="bg-surface-lowest">
                          <td className="font-mono text-xs text-primary">{attr.key}</td>
                          <td className="font-mono text-xs text-on-surface break-all">{attr.valueText}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {agent.nonIdentifyingAttributes.length > 0 ? (
              <div>
                <div className="text-xs font-semibold text-on-surface mb-2">非标识属性</div>
                <div className="overflow-auto">
                  <table className="console-table w-full">
                    <thead>
                      <tr>
                        <th>Key</th>
                        <th>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agent.nonIdentifyingAttributes.map((attr, i) => (
                        <tr key={`nonident-${i}`} className="bg-surface-lowest">
                          <td className="font-mono text-xs text-primary">{attr.key}</td>
                          <td className="font-mono text-xs text-on-surface break-all">{attr.valueText}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
            {agent.identifyingAttributes.length === 0 && agent.nonIdentifyingAttributes.length === 0 && (
              <p className="py-3 text-sm text-muted">暂无属性数据。</p>
            )}
          </DataPanel>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Configuration Panel */}
          <DataPanel title="配置对比" meta={configuration.applyStatus || runtime.remoteConfigStatus || 'configuration'}>
            {/* Hash Summary */}
            <div className="mb-4 grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded border border-outline bg-surface-lowest p-2">
                <span className="text-muted">期望渲染 hash</span>
                <div className="font-mono text-on-surface mt-0.5 break-all">{configuration.expectedConfigHash || '-'}</div>
              </div>
              <div className="rounded border border-outline bg-surface-lowest p-2">
                <span className="text-muted">实际生效 hash</span>
                <div className="font-mono text-on-surface mt-0.5 break-all">{configuration.effectiveConfigHash || '-'}</div>
              </div>
              <div className="rounded border border-outline bg-surface-lowest p-2">
                <span className="text-muted">最近下发 hash</span>
                <div className="font-mono text-on-surface mt-0.5 break-all">{configuration.lastRemoteConfigHash || '-'}</div>
              </div>
              <div className="rounded border border-outline bg-surface-lowest p-2">
                <span className="text-muted">状态</span>
                <div className={`font-semibold mt-0.5 ${configHashesMatch ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {configHashesMatch ? '一致' : '不一致'}
                </div>
              </div>
            </div>

            {/* Side-by-side config */}
            <div className="grid gap-3">
              <div>
                <div className="text-xs font-semibold text-on-surface mb-2">期望渲染配置</div>
                <pre className="max-h-72 overflow-auto rounded border border-outline bg-surface-lowest p-3 font-mono text-[11px] text-on-surface whitespace-pre-wrap break-all">
                  {configuration.expectedRenderedConfig || '(empty)'}
                </pre>
              </div>
              <div>
                <div className="text-xs font-semibold text-on-surface mb-2">当前生效配置</div>
                <pre className="max-h-80 overflow-auto rounded border border-outline bg-surface-lowest p-3 font-mono text-[11px] text-on-surface whitespace-pre-wrap break-all">
                  {configuration.effectiveConfig || '(empty)'}
                </pre>
              </div>
              <div>
                <div className="text-xs font-semibold text-on-surface mb-2">最近下发配置</div>
                <pre className={`max-h-80 overflow-auto rounded border p-3 font-mono text-[11px] whitespace-pre-wrap break-all ${
                  configHashesMatch ? 'border-emerald-500/30 bg-emerald-900/5 text-on-surface' : 'border-amber-500/30 bg-amber-900/5 text-on-surface'
                }`}>
                  {configuration.lastRemoteConfig || '(empty)'}
                </pre>
              </div>
            </div>
          </DataPanel>

          <DataPanel title="附加配置" meta={configuration.additionalConfig ? `v${configuration.additionalConfig.version} · ${configuration.additionalConfig.status || 'draft'}` : '实例覆盖层'}>
            <div className="mb-3 rounded border border-amber-500/30 bg-amber-900/10 p-3 text-xs text-amber-600">
              这部分会以 OpAMP config map 的空 key 下发，作为实例级覆盖层最后合并。对象按 YAML 路径深度覆盖；数组不会智能追加，需要写完整目标数组，例如 receivers/processors/exporters 列表。
            </div>
            <textarea
              className="min-h-56 w-full rounded border border-outline bg-white p-3 font-mono text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              value={additionalYaml}
              onChange={(event) => setAdditionalYaml(event.target.value)}
              placeholder={'exporters:\n  otlp:\n    endpoint: otel-gateway:4317\n\nservice:\n  pipelines:\n    logs:\n      processors: [memory_limiter, batch]'}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="rounded border border-primary px-3 py-2 text-sm font-semibold text-primary disabled:opacity-60" disabled={saveAdditionalMutation.isPending} onClick={() => saveAdditionalMutation.mutate(false)}>
                保存覆盖层
              </button>
              <button className="rounded bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={!runtime.remoteConfigCapable || saveAdditionalMutation.isPending} onClick={() => saveAdditionalMutation.mutate(true)}>
                保存并发送到 Agent
              </button>
            </div>
            {configuration.additionalConfig?.lastRemoteConfigHash ? (
              <p className="mt-2 font-mono text-[11px] text-muted">last additional remote hash: {shortHash(configuration.additionalConfig.lastRemoteConfigHash)}</p>
            ) : null}
            {saveAdditionalMutation.error ? (
              <div className="mt-3 rounded border border-red-500/30 bg-red-900/10 p-3 text-xs text-red-400">{(saveAdditionalMutation.error as Error).message}</div>
            ) : null}
          </DataPanel>

          <DataPanel title="配置来源" meta={configuration.configSources ? `${configuration.configSources.sourceBreakdown.length} 个来源` : '空'}>
            {configuration.configSources ? (
              <div className="space-y-3">
                <div className="grid gap-2 text-[11px] md:grid-cols-2">
                  <SourceCard label="平台模板" value={configuration.configSources.platformTemplate?.name ?? '未导入'} status={configuration.configSources.platformTemplate?.status ?? '-'} />
                  <SourceCard label="采集组覆盖" value={configuration.configSources.groupOverride ? '已配置' : '未配置'} status={configuration.configSources.groupOverride?.updatedAt ? '已更新' : '-'} />
                  <SourceCard label="服务属性补齐" value={`${configuration.configSources.serviceEnrichmentPatches.length} 个补丁`} status="service" />
                  <SourceCard label="业务增强补丁" value={`${configuration.configSources.servicePipelinePatches.length} 个补丁`} status="service" />
                </div>
                {configuration.configSources.warnings.length > 0 ? (
                  <div className="rounded border border-amber-500/30 bg-amber-900/10 p-3 text-xs text-amber-500">
                    {configuration.configSources.warnings.join('; ')}
                  </div>
                ) : null}
                <div className="space-y-2">
                  {configuration.configSources.sourceBreakdown.map((source, index) => (
                    <div key={`${source.type}-${source.id}-${index}`} className="rounded border border-outline bg-surface-lowest p-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-primary">{source.name || source.type}</span>
                        <span className="font-mono text-muted">{shortHash(source.hash)}</span>
                      </div>
                      <div className="mt-1 flex gap-3 text-[11px] text-muted">
                        <span>{source.type}</span>
                        <span>{source.status}</span>
                      </div>
                      {source.warnings.length > 0 ? <div className="mt-1 text-[11px] text-amber-500">{source.warnings.join('; ')}</div> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="py-3 text-sm text-muted">暂无配置来源。请先在 Logs / Pipelines / Config 中导入平台模板，并在服务接入中绑定接入目标。</p>
            )}
          </DataPanel>

          {/* Platform Bindings Panel */}
          <DataPanel title="平台绑定" meta="采集组 · 服务 · 接入状态">
            {/* Collector Group */}
            <div className="mb-4">
              <div className="text-xs font-semibold text-on-surface mb-2">采集组</div>
              {collectorGroup ? (
                <div className="rounded border border-outline bg-surface-lowest p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-primary">{collectorGroup.name}</span>
                    <span className="text-xs text-muted">{modeLabel(collectorGroup.mode)}</span>
                  </div>
                  <div className="mt-1 flex gap-3 text-[11px] text-muted">
                    <span>{collectorGroup.environment}</span>
                    {collectorGroup.cluster ? <span>{collectorGroup.cluster}</span> : null}
                    <span>status: {collectorGroup.status}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted">未绑定采集组</p>
              )}
            </div>

            {/* Services */}
            {services.length > 0 && (
              <div className="mb-4">
                <div className="text-xs font-semibold text-on-surface mb-2">服务 ({services.length})</div>
                <div className="space-y-1 max-h-40 overflow-auto">
                  {services.map((svc) => (
                    <div key={svc.id} className="rounded border border-outline bg-surface-lowest p-2 text-xs">
                      <span className="font-semibold text-primary">{svc.name}</span>
                      <span className="ml-2 text-muted">{svc.environment}</span>
                      {svc.cluster ? <span className="ml-2 text-muted">{svc.cluster}</span> : null}
                      <span className={`ml-2 ${svc.status === 'active' ? 'text-emerald-400' : 'text-muted'}`}>{svc.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Onboardings */}
            {onboardings.length > 0 && (
              <div className="mb-4">
                <div className="text-xs font-semibold text-on-surface mb-2">接入记录 ({onboardings.length})</div>
                <div className="space-y-1 max-h-40 overflow-auto">
                  {onboardings.map((onb) => (
                    <div key={onb.id} className="rounded border border-outline bg-surface-lowest p-2 text-xs">
                      <span className="font-mono text-primary">{onb.id.slice(0, 12)}…</span>
                      <span className="ml-2 text-muted">service: {onb.serviceId.slice(0, 12)}…</span>
                      <span className="ml-2 text-muted">{onb.mode}</span>
                      <span className={`ml-2 font-semibold ${onb.status === 'verified' ? 'text-emerald-400' : onb.status === 'failed' ? 'text-red-400' : 'text-muted'}`}>{onb.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!collectorGroup && services.length === 0 && onboardings.length === 0 && (
              <p className="py-3 text-sm text-muted">暂无平台绑定数据。</p>
            )}
          </DataPanel>
        </div>
      </div>
    </div>
  );
}

function SourceCard({ label, value, status }: { label: string; value: string; status: string }) {
  return (
    <div className="rounded border border-outline bg-surface-lowest p-2">
      <span className="text-muted">{label}</span>
      <div className="mt-0.5 font-semibold text-on-surface">{value}</div>
      <div className="mt-0.5 font-mono text-muted">{status}</div>
    </div>
  );
}
