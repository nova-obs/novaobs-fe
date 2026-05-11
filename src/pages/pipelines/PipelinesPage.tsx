import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, Play, RefreshCw, ShieldCheck } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { api } from '../../services/api';
import type { CollectorConfigVersion, CollectorGroup, ServiceEnrichmentPatch, ServicePipelinePatch } from '../../services/types';
import {
  configStatusColor,
  configStatusLabel,
  describeApplyMatrix,
  shortHash,
  summarizeCollectorGroupConfig,
} from './pipelineConfig';

function formatTime(value: string) {
  return value ? value.replace('T', ' ').replace('Z', '') : '-';
}

function groupMeta(group: CollectorGroup | null) {
  if (!group) return '请选择 Collector Group';
  return summarizeCollectorGroupConfig(group);
}

export function PipelinesPage({ embedded }: { embedded?: boolean }) {
  const queryClient = useQueryClient();
  const { data: groups = [], isLoading: groupsLoading, error: groupsError } = useQuery({
    queryKey: ['collector-groups'],
    queryFn: () => api.getCollectorGroups(),
  });
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? groups[0] ?? null,
    [groups, selectedGroupId],
  );

  useEffect(() => {
    if (!selectedGroupId && groups[0]?.id) {
      setSelectedGroupId(groups[0].id);
    }
  }, [groups, selectedGroupId]);

  const groupId = selectedGroup?.id ?? '';
  const { data: sources, error: sourcesError, refetch: refetchSources } = useQuery({
    queryKey: ['collector-group-config-sources', groupId],
    queryFn: () => api.getCollectorGroupConfigSources(groupId),
    enabled: !!groupId,
    retry: false,
  });
  const { data: versions = [] } = useQuery({
    queryKey: ['collector-config-versions', groupId],
    queryFn: () => api.getCollectorGroupConfigVersions(groupId),
    enabled: !!groupId,
  });
  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ['collector-group-config-status', groupId],
    queryFn: () => api.getCollectorGroupConfigStatus(groupId),
    enabled: !!groupId,
    refetchInterval: 5000,
  });

  const validateMutation = useMutation({
    mutationFn: () => api.validateCollectorGroupConfig(groupId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['collector-group-config-sources', groupId] });
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => api.publishCollectorGroupConfig(groupId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['collector-groups'] });
      await queryClient.invalidateQueries({ queryKey: ['collector-config-versions', groupId] });
      await queryClient.invalidateQueries({ queryKey: ['collector-group-config-status', groupId] });
      await queryClient.invalidateQueries({ queryKey: ['collector-group-config-sources', groupId] });
    },
  });

  const activateGroupMutation = useMutation({
    mutationFn: () => api.activateCollectorGroup(groupId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['collector-groups'] });
      await queryClient.invalidateQueries({ queryKey: ['collector-group-config-status', groupId] });
    },
  });

  const applySummary = describeApplyMatrix(status?.agents ?? []);
  const latestVersion = status?.latestVersion ?? versions.find((version) => version.status !== 'draft') ?? null;
  const validation = validateMutation.data;
  const renderedYaml = validation?.renderedYaml || sources?.renderedYaml || '';
  const warnings = validation?.warnings ?? sources?.warnings ?? [];
  const errors = validation?.errors ?? sources?.errors ?? [];
  const groupReadyToActivate = !!selectedGroup &&
    selectedGroup.status !== 'active' &&
    (selectedGroup.onlineInstances ?? 0) > 0 &&
    !sourcesError &&
    errors.length === 0 &&
    !!renderedYaml.trim();

  return (
    <div className="space-y-6">
      {!embedded ? (
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted">
            <span>Logs</span>
            <span>/</span>
            <span className="text-primary">Pipelines</span>
          </div>
          <h1 className="font-display text-2xl font-semibold text-on-surface">Pipeline 配置</h1>
          <p className="mt-1 text-sm text-muted">展示服务接入生成的属性补齐和业务解析规则，并完成校验、发布和应用状态跟踪。</p>
        </div>
      ) : null}

      {groupsError ? (
        <DataPanel title="加载失败" meta="collector groups">
          <p className="text-sm text-red-400">{(groupsError as Error).message}</p>
        </DataPanel>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_360px]">
        <DataPanel title="采集组" meta={groupsLoading ? '加载中...' : `${groups.length} 个采集组`}>
          {groups.length === 0 ? (
            <p className="py-6 text-sm text-muted">暂无 Collector Group。请先创建 Group 并绑定 Agent。</p>
          ) : (
            <div className="space-y-2">
              {groups.map((group) => (
                <button
                  key={group.id}
                  className={`w-full rounded border px-3 py-3 text-left ${
                    group.id === selectedGroup?.id ? 'border-primary bg-primary-soft' : 'border-outline bg-white hover:bg-surface-low'
                  }`}
                  onClick={() => setSelectedGroupId(group.id)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-on-surface">{group.name}</span>
                    <span className={`text-[11px] font-semibold ${configStatusColor(group.lastPublishStatus)}`}>
                      {configStatusLabel(group.lastPublishStatus)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted">{group.environment || '-'} · {group.mode}</div>
                  <div className="mt-1 font-mono text-[11px] text-muted">{shortHash(group.desiredConfigHash)}</div>
                </button>
              ))}
            </div>
          )}
        </DataPanel>

        <div className="space-y-4">
          <DataPanel title="规则集合" meta={groupMeta(selectedGroup)}>
            {!selectedGroup ? (
              <p className="py-6 text-sm text-muted">请选择 Collector Group。</p>
            ) : (
              <div className="space-y-4">
                {sourcesError ? (
                  <Notice tone="amber" title="配置来源尚未完整" message={(sourcesError as Error).message} />
                ) : null}
                {selectedGroup.status !== 'active' ? (
                  <Notice
                    tone={groupReadyToActivate ? 'green' : 'amber'}
                    title="启用条件"
                    message={groupReadyToActivate ? '在线 Agent 和规则校验已满足，可以启用 Group。' : '启用前需要至少一个 Agent 在线，并通过服务规则集合校验。'}
                  />
                ) : null}

                <SourceSection
                  index="1"
                  title="服务属性补齐"
                  meta={`${sources?.serviceEnrichmentPatches.length ?? 0} 个规则`}
                >
                  <PatchList patches={sources?.serviceEnrichmentPatches ?? []} empty="暂无服务属性补齐规则。服务接入保存 Agent/Group 后会自动生成。" />
                </SourceSection>

                <SourceSection index="2" title="业务解析规则" meta={`${sources?.servicePipelinePatches.length ?? 0} 个规则`}>
                  <BusinessPatchList patches={sources?.servicePipelinePatches ?? []} />
                </SourceSection>

                <SourceSection index="3" title="发布配置预览" meta={renderedYaml ? `${renderedYaml.length} 字符 · ${shortHash(validation?.configHash || sources?.configHash || '')}` : '空'}>
                  {warnings.length > 0 ? <Notice tone="amber" title="Warnings" message={warnings.join('; ')} /> : null}
                  {errors.length > 0 ? <Notice tone="red" title="Errors" message={errors.join('; ')} /> : null}
                  <YamlBlock body={renderedYaml || '(empty)'} tall />
                </SourceSection>

                <div className="flex flex-wrap items-center gap-2">
                  <button className="rounded border border-primary bg-white px-3 py-2 text-sm font-semibold text-primary disabled:opacity-60" disabled={!selectedGroup || validateMutation.isPending} onClick={() => validateMutation.mutate()}>
                    <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />校验
                  </button>
                  <button className="rounded bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={!selectedGroup || publishMutation.isPending || !renderedYaml.trim()} onClick={() => publishMutation.mutate()}>
                    <Play className="mr-1 inline h-3.5 w-3.5" />发布
                  </button>
                  {selectedGroup.status !== 'active' ? (
                    <button className="rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={!groupReadyToActivate || activateGroupMutation.isPending} onClick={() => activateGroupMutation.mutate()}>
                      <CheckCircle className="mr-1 inline h-3.5 w-3.5" />启用 Group
                    </button>
                  ) : null}
                  <button className="rounded p-2 text-muted hover:bg-surface-low hover:text-on-surface" onClick={() => { refetchSources(); refetchStatus(); }}>
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>

                {(validateMutation.error || publishMutation.error || activateGroupMutation.error) ? (
                  <Notice tone="red" title="操作失败" message={((validateMutation.error || publishMutation.error || activateGroupMutation.error) as Error).message} />
                ) : null}
              </div>
            )}
          </DataPanel>
        </div>

        <div className="space-y-4">
          <DataPanel title="应用矩阵" meta={applySummary.label}>
            {!selectedGroup ? (
              <p className="py-4 text-sm text-muted">请选择 Collector Group。</p>
            ) : status?.agents.length ? (
              <div className="space-y-2 max-h-[520px] overflow-auto">
                {status.agents.map((agent) => (
                  <Link key={agent.instanceUid} to={`/collectors/agents/${agent.instanceUid}`} className="block rounded border border-outline bg-surface-lowest p-3 hover:border-primary">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-mono text-xs text-primary">{agent.instanceUid}</div>
                        <div className="mt-1 text-[11px] text-muted">
                          {agent.runtimeStatus} · {agent.remoteConfigStatus || 'unset'} · {agent.remoteConfigCapable ? 'remote config' : 'no remote config'}
                        </div>
                      </div>
                      <span className={`shrink-0 text-xs font-semibold ${agent.inSync ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {agent.inSync ? 'in sync' : 'out of sync'}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[10px] text-muted">
                      <div>last: {shortHash(agent.lastConfigHash)}</div>
                      <div>effective: {shortHash(agent.effectiveConfigHash)}</div>
                    </div>
                    {agent.lastError ? <div className="mt-2 text-xs text-red-400">{agent.lastError}</div> : null}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="py-4 text-sm text-muted">暂无 Agent 归属到该 Group。请先在 Collectors 中绑定 Agent。</p>
            )}
          </DataPanel>

          <DataPanel title="最新版本" meta={latestVersion ? `v${latestVersion.version}` : '无'}>
            {latestVersion ? <VersionSummary version={latestVersion} /> : <p className="py-4 text-sm text-muted">暂无已发布配置版本。</p>}
          </DataPanel>
        </div>
      </div>
    </div>
  );
}

function SourceSection({ index, title, meta, children }: { index: string; title: string; meta: string; children: ReactNode }) {
  return (
    <div className="rounded border border-outline bg-surface-lowest p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-primary-soft text-xs font-bold text-primary">{index}</span>
          <span className="text-sm font-semibold text-on-surface">{title}</span>
        </div>
        <span className="text-xs text-muted">{meta}</span>
      </div>
      {children}
    </div>
  );
}

function PatchList({ patches, empty }: { patches: ServiceEnrichmentPatch[]; empty: string }) {
  if (patches.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <div className="space-y-2">
      {patches.map((patch) => (
        <details key={patch.id || patch.serviceId} className="rounded border border-outline bg-white p-2">
          <summary className="cursor-pointer text-sm font-semibold text-primary">
            {patch.serviceId} · {patch.status || 'generated'} · {shortHash(patch.configHash)}
          </summary>
          {patch.warnings.length > 0 ? <p className="mt-2 text-xs text-amber-500">{patch.warnings.join('; ')}</p> : null}
          <YamlBlock body={patch.patchYaml || '(empty)'} />
        </details>
      ))}
    </div>
  );
}

function BusinessPatchList({ patches }: { patches: ServicePipelinePatch[] }) {
  if (patches.length === 0) return <p className="text-sm text-muted">暂无业务增量 patch。parse mode 为 none 时不会生成业务解析配置。</p>;
  return (
    <div className="space-y-2">
      {patches.map((patch) => (
        <details key={patch.id || patch.serviceId} className="rounded border border-outline bg-white p-2">
          <summary className="cursor-pointer text-sm font-semibold text-primary">
            {patch.serviceId} · {patch.enabled ? 'enabled' : 'disabled'} · {patch.status} · {shortHash(patch.configHash)}
          </summary>
          <YamlBlock body={patch.patchYaml || '(empty)'} />
        </details>
      ))}
    </div>
  );
}

function YamlBlock({ body, tall }: { body: string; tall?: boolean }) {
  return (
    <pre className={`${tall ? 'max-h-96' : 'max-h-64'} overflow-auto rounded border border-outline bg-white p-3 font-mono text-[11px] text-on-surface whitespace-pre-wrap break-all`}>
      {body}
    </pre>
  );
}

function Notice({ tone, title, message }: { tone: 'amber' | 'red' | 'green'; title: string; message: string }) {
  const color = tone === 'red'
    ? 'border-red-500/30 bg-red-900/10 text-red-400'
    : tone === 'green'
      ? 'border-emerald-500/30 bg-emerald-900/10 text-emerald-500'
      : 'border-amber-500/30 bg-amber-900/10 text-amber-500';
  const Icon = tone === 'red' ? AlertTriangle : CheckCircle;
  return (
    <div className={`flex items-start gap-2 rounded border p-3 ${color}`}>
      <Icon className="mt-0.5 h-4 w-4" />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs">{message}</p>
      </div>
    </div>
  );
}

function VersionSummary({ version }: { version: CollectorConfigVersion }) {
  return (
    <div className="rounded border border-outline bg-surface-lowest p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-xs text-primary">v{version.version}</span>
        <span className={`text-xs font-semibold ${configStatusColor(version.status)}`}>{configStatusLabel(version.status)}</span>
      </div>
      <div className="mt-1 font-mono text-[10px] text-muted">{version.configHash || '-'}</div>
      <div className="mt-2 text-xs text-muted">
        <div>created: {formatTime(version.createdAt)}</div>
        {version.appliedAt ? <div>applied: {formatTime(version.appliedAt)}</div> : null}
        {version.message ? <div>message: {version.message}</div> : null}
      </div>
    </div>
  );
}
