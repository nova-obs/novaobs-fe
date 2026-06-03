import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, ShieldCheck, WifiOff, XCircle } from 'lucide-react';
import { api } from '../../services/api';
import { logSourceLabel, logsApi } from './api';
import { LogsEmptyState, LogsInfoCell, LogsSection, LogsToolbarButton } from './LogsPrimitives';

export function LogsAgentsPage() {
  const [params] = useSearchParams();
  const [selectedGroupId, setSelectedGroupId] = useState(params.get('agent_group_id') ?? '');
  const { data: workspace, isLoading: workspaceLoading, error: workspaceError } = useQuery({
    queryKey: ['logs-onboarding-workspace'],
    queryFn: logsApi.getWorkspace,
  });

  const groups = workspace?.collectorGroups ?? [];
  const activeGroupId = selectedGroupId || groups[0]?.id || '';
  const { data: instances = [], isLoading: instancesLoading, error: instancesError, refetch } = useQuery({
    queryKey: ['logs-agent-instances', activeGroupId],
    queryFn: () => api.getCollectorInstances(activeGroupId),
    enabled: Boolean(activeGroupId),
    refetchInterval: 10000,
  });
  const selectedRouteId = params.get('route_id') ?? '';
  const selectedRoute = useMemo(() => (workspace?.routes ?? []).find((item) => item.route.id === selectedRouteId) ?? null, [selectedRouteId, workspace]);
  const activeGroup = groups.find((group) => group.id === activeGroupId) ?? null;
  const onlineCount = instances.filter((item) => item.healthy).length;

  const activeDomainMode = agentGroupModeLabel(activeGroup);
  const activeDomainScope = activeGroup?.cluster
    ? `${activeGroup.cluster} / ${activeGroup.namespace || '-'}`
    : activeGroup?.environment || '-';

  return (
    <div className="logs-agents-workbench grid min-h-[720px] gap-3 xl:grid-cols-[300px_minmax(0,1fr)_300px]">
      <LogsSection title="采集域" meta={workspaceLoading ? 'loading' : `${groups.length} domains`} bodyClassName="p-0">
        {workspaceError ? <ErrorLine message={(workspaceError as Error).message} /> : null}
        {groups.length === 0 ? <LogsEmptyState title="采集域为空" /> : (
          <div className="max-h-[720px] overflow-y-auto">
            {groups.map((group) => {
              const active = group.id === activeGroupId;
              const mode = agentGroupModeLabel(group);
              const scope = group.cluster ? `${group.cluster} / ${group.namespace || '-'}` : group.environment || '-';
              return (
                <button
                  key={group.id}
                  className={`w-full border-b border-outline/60 px-3 py-2.5 text-left transition-colors ${
                    active ? 'bg-primary-soft/70 text-primary shadow-[inset_3px_0_0_#0d5bd7]' : 'bg-white/46 text-on-surface hover:bg-surface-low/70'
                  }`}
                  onClick={() => setSelectedGroupId(group.id)}
                >
                  <div className="truncate text-sm font-semibold">{group.displayName || group.name}</div>
                  <div className="mt-1 truncate font-mono text-[11px] text-muted">{mode} · {scope}</div>
                  <div className="mt-1 truncate font-mono text-[11px] text-muted">{group.status || '-'} · online {group.onlineInstances}</div>
                </button>
              );
            })}
          </div>
        )}
      </LogsSection>

      <LogsSection
        title="实例状态"
        meta={instancesLoading ? 'loading' : `${instances.length} instances · ${onlineCount} healthy`}
        bodyClassName="p-0"
        action={<LogsToolbarButton onClick={() => refetch()} disabled={!activeGroupId}><RefreshCw className="h-3.5 w-3.5" />刷新</LogsToolbarButton>}
      >
        {instancesError ? <ErrorLine message={(instancesError as Error).message} /> : null}
        {!activeGroupId ? <LogsEmptyState title="未选择采集域" /> : instances.length === 0 ? <LogsEmptyState title="实例心跳为空" /> : (
          <div className="overflow-auto">
            <table className="console-table min-w-[960px] w-full">
              <thead>
                <tr>
                  <th>Instance UID</th>
                  <th>运行态</th>
                  <th>Remote Config</th>
                  <th>Hash</th>
                  <th>节点</th>
                  <th>最后心跳</th>
                </tr>
              </thead>
              <tbody>
                {instances.map((item) => (
                  <tr key={item.instanceUid}>
                    <td><Link className="font-mono text-primary hover:underline" to={`/agents/${item.instanceUid}`}>{item.instanceUid}</Link></td>
                    <td>
                      <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-semibold ${item.healthy ? 'border-primary/20 bg-primary-soft text-primary' : 'border-amber-500/30 bg-amber-50 text-amber-700'}`}>
                        {item.healthy ? <ShieldCheck className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                        {item.runtimeStatus || '-'}
                      </span>
                    </td>
                    <td>{item.remoteConfigStatus}</td>
                    <td className="font-mono text-xs">{item.effectiveConfigHash || item.lastConfigHash || '-'}</td>
                    <td className="font-mono text-xs">{item.nodeName || item.hostname || item.ip || '-'}</td>
                    <td className="font-mono text-xs">{item.lastSeenAt || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </LogsSection>

      <LogsSection title="上下文" meta={activeGroup?.id || 'agent context'} bodyClassName="p-0">
        <LogsInfoCell label="采集域" value={activeGroup?.displayName || activeGroup?.name || '-'} tone="primary" />
        <LogsInfoCell label="状态来源" value={activeGroup ? activeDomainMode : '-'} />
        <LogsInfoCell label="Mode" value={activeGroup?.mode || '-'} />
        <LogsInfoCell label="Scope" value={activeGroup ? activeDomainScope : '-'} />
        <LogsInfoCell label="Online" value={String(activeGroup?.onlineInstances ?? '-')} />
        {selectedRoute ? (
          <>
            <LogsInfoCell label="接入路由" value={selectedRoute.route.id} />
            <LogsInfoCell label="来源" value={logSourceLabel(selectedRoute.route.sourceType)} />
            <LogsInfoCell label="端点" value={selectedRoute.endpoint?.name ?? '-'} />
            <LogsInfoCell label="发布" value={selectedRoute.route.lastPublishStatus || selectedRoute.route.status} />
          </>
        ) : (
          <div className="border-t border-outline/70 p-3 text-xs leading-5 text-muted">route context empty</div>
        )}
      </LogsSection>
    </div>
  );
}

function agentGroupModeLabel(group: { mode?: string; cluster?: string } | null) {
  if (!group) return '-';
  if (group.mode === 'dedicated_collector') return 'K8s 主动探测';
  if (group.mode === 'shared_gateway') return 'VM 回连上报';
  return group.cluster ? 'K8s 主动探测' : 'VM 回连上报';
}

function ErrorLine({ message }: { message: string }) {
  return (
    <div className="m-3 flex items-center gap-2 rounded border border-red-500/30 bg-red-50 px-3 py-2 text-sm text-red-600">
      <XCircle className="h-4 w-4" />{message}
    </div>
  );
}
