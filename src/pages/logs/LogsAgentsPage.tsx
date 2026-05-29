import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, ServerCog, XCircle } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { api } from '../../services/api';
import { logSourceLabel, logsApi } from './api';

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

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <DataPanel title="AgentGroup" meta={workspaceLoading ? '加载中...' : `${groups.length} groups`}>
        {workspaceError ? <ErrorLine message={(workspaceError as Error).message} /> : null}
        {groups.length === 0 ? <Empty label="暂无 AgentGroup" /> : (
          <div className="space-y-2">
            {groups.map((group) => (
              <button
                key={group.id}
                className={`w-full rounded border px-3 py-3 text-left ${group.id === activeGroupId ? 'border-primary bg-primary-soft text-primary' : 'border-outline bg-white text-on-surface hover:bg-surface-low'}`}
                onClick={() => setSelectedGroupId(group.id)}
              >
                <div className="font-semibold">{group.displayName || group.name}</div>
                <div className="mt-1 text-xs text-muted">{group.environment || '-'} · {group.cluster || '-'} · {group.namespace || '-'}</div>
                <div className="mt-2 font-mono text-[11px] text-muted">{group.status} · online {group.onlineInstances}</div>
              </button>
            ))}
          </div>
        )}
      </DataPanel>

      <div className="space-y-4">
        {selectedRoute ? (
          <DataPanel title="接入路由" meta={selectedRoute.route.id}>
            <div className="grid gap-3 md:grid-cols-4">
              <Info label="来源" value={logSourceLabel(selectedRoute.route.sourceType)} />
              <Info label="范围" value={selectedRoute.source?.sourceType === 'vm_file' ? selectedRoute.source.pathPattern : `${selectedRoute.source?.clusterId}/${selectedRoute.source?.namespace}/${selectedRoute.source?.workloadName}`} />
              <Info label="端点" value={selectedRoute.endpoint?.name ?? '-'} />
              <Info label="发布" value={selectedRoute.route.lastPublishStatus || selectedRoute.route.status} />
            </div>
          </DataPanel>
        ) : null}

        <DataPanel title="实例状态" meta={instancesLoading ? '加载中...' : `${instances.length} instances`}>
          <div className="mb-3 flex justify-end">
            <button className="rounded p-2 text-muted hover:bg-surface-low hover:text-on-surface" onClick={() => refetch()} title="刷新">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          {instancesError ? <ErrorLine message={(instancesError as Error).message} /> : null}
          {!activeGroupId ? <Empty label="请选择 AgentGroup" /> : instances.length === 0 ? <Empty label="暂无实例心跳" /> : (
            <div className="overflow-auto">
              <table className="console-table min-w-[900px] w-full">
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
                      <td>{item.runtimeStatus} · {item.healthy ? 'healthy' : 'unhealthy'}</td>
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
        </DataPanel>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-outline bg-surface-lowest px-3 py-2">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="mt-1 break-all font-mono text-xs text-on-surface">{value || '-'}</div>
    </div>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded border border-red-500/30 bg-red-50 px-3 py-2 text-sm text-red-600">
      <XCircle className="h-4 w-4" />{message}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-muted">
      <ServerCog className="h-4 w-4" />{label}
    </div>
  );
}
