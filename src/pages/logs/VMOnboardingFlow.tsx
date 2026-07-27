import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, RefreshCw, RotateCcw, Server } from 'lucide-react';
import { api } from '../../services/api';
import type { CollectorEnrollmentCredential, CollectorInstallation } from '../../services/types';
import {
  logsApi,
  type LogParseRule,
  type LogRouteInput,
  type LogRoutePreview,
  type LogRoutePublishResult,
  type LogRouteRuntimeTarget,
} from './api';
import { type ParserMode } from './LogsParseRuleDialog';
import { LogsEmptyState, LogsErrorLine } from './LogsPrimitives';
import { RouteEditor } from './LogsOnboardingPage';

const defaultParserRuleName = 'default-parser';
const defaultParserPattern = '^(?P<level>[A-Z]+)\\s+(?P<message>.*)$';

export function validateHostLogPath(path: string, allowedLogRoots: string[]): string {
  const value = path.trim();
  if (!value.startsWith('/')) return '日志路径必须是绝对路径';
  if (value.split('/').includes('..')) return '日志路径不能包含 ..';
  const allowed = allowedLogRoots.some((root) => {
    const normalizedRoot = root.trim().replace(/\/+$/, '');
    return normalizedRoot && (value === normalizedRoot || value.startsWith(`${normalizedRoot}/`));
  });
  return allowed ? '' : '日志路径必须位于部署目标允许的日志根目录内';
}

interface CollectorEnrollmentClient {
  getCollectorInstallations(): Promise<CollectorInstallation[]>;
  createCollectorInstallation(input: { hostAssetId: string; agentRole?: string }): Promise<CollectorInstallation>;
  issueCollectorEnrollmentToken(installationId: string): Promise<CollectorEnrollmentCredential>;
}

export async function issueHostEnrollmentToken(
  client: CollectorEnrollmentClient,
  hostAssetId: string,
): Promise<CollectorEnrollmentCredential> {
  const installations = await client.getCollectorInstallations();
  const existing = installations.find((installation) =>
    installation.hostAssetId === hostAssetId &&
    installation.agentRole === 'logs_agent' &&
    installation.status !== 'revoked',
  );
  if (existing?.status === 'active') {
    throw new Error('该主机日志 Agent 已完成注册；如需更换凭据，请执行轮换安装凭据');
  }
  const installation = existing ?? await client.createCollectorInstallation({
    hostAssetId,
    agentRole: 'logs_agent',
  });
  return client.issueCollectorEnrollmentToken(installation.installationId);
}

function buildParserRules(mode: ParserMode, name: string, pattern: string): LogParseRule[] {
  if (mode === 'none') return [];
  return [{ name: name || `${mode}-parser`, ruleType: mode, pattern: mode === 'regex' ? pattern : undefined, enabled: true }];
}

export function VMOnboardingFlow() {
  const queryClient = useQueryClient();
  const { productId = '', serviceId = '', id: editRouteId = '' } = useParams();
  const [deploymentId, setDeploymentId] = useState('');
  const [endpointId, setEndpointId] = useState('');
  const [logPath, setLogPath] = useState('');
  const [parserMode, setParserMode] = useState<ParserMode>('none');
  const [parserRuleName, setParserRuleName] = useState(defaultParserRuleName);
  const [parserPattern, setParserPattern] = useState(defaultParserPattern);
  const [parseDialogOpen, setParseDialogOpen] = useState(false);
  const [preview, setPreview] = useState<LogRoutePreview | null>(null);
  const [savedRouteId, setSavedRouteId] = useState(editRouteId);
  const [publishConfirmation, setPublishConfirmation] = useState<LogRoutePublishResult | null>(null);
  const [enrollment, setEnrollment] = useState<CollectorEnrollmentCredential | null>(null);

  const workspaceQuery = useQuery({
    queryKey: ['logs-onboarding-workspace', productId, serviceId],
    queryFn: () => logsApi.getWorkspace(productId, serviceId),
    enabled: Boolean(productId && serviceId),
  });
  const deploymentsQuery = useQuery({
    queryKey: ['service-deployments', productId, serviceId],
    queryFn: () => api.getServiceDeployments(productId, serviceId),
    enabled: Boolean(productId && serviceId),
  });
  const serviceQuery = useQuery({
    queryKey: ['service', productId, serviceId],
    queryFn: () => api.getService(productId, serviceId),
    enabled: Boolean(productId && serviceId),
  });
  const deployments = useMemo(
    () => (deploymentsQuery.data ?? []).filter((deployment) => deployment.kind === 'host_set' && deployment.status === 'active'),
    [deploymentsQuery.data],
  );
  const selectedDeployment = deployments.find((deployment) => deployment.id === deploymentId) ?? null;
  const endpoints = useMemo(
    () => (workspaceQuery.data?.endpoints ?? []).filter((endpoint) => endpoint.scopeType !== 'k8s_cluster'),
    [workspaceQuery.data?.endpoints],
  );
  const editRoute = workspaceQuery.data?.routes.find((item) => item.route.id === editRouteId) ?? null;

  useEffect(() => {
    if (editRoute?.route.serviceDeploymentId && deployments.some((deployment) => deployment.id === editRoute.route.serviceDeploymentId)) {
      setDeploymentId(editRoute.route.serviceDeploymentId);
      setEndpointId(editRoute.route.endpointId);
      setLogPath(editRoute.source?.pathPattern ?? '');
      const parser = editRoute.source?.parseRules.find((rule) => rule.enabled !== false);
      setParserMode(parser?.ruleType ?? 'none');
      setParserRuleName(parser?.name || defaultParserRuleName);
      setParserPattern(parser?.pattern || defaultParserPattern);
      return;
    }
    setDeploymentId((current) => deployments.some((deployment) => deployment.id === current) ? current : deployments[0]?.id ?? '');
  }, [deployments, editRoute]);

  useEffect(() => {
    setEndpointId((current) => endpoints.some((endpoint) => endpoint.id === current) ? current : endpoints[0]?.id ?? '');
  }, [deploymentId, endpoints]);

  useEffect(() => {
    setPreview(null);
    setPublishConfirmation(null);
  }, [deploymentId, endpointId, logPath, parserMode, parserRuleName, parserPattern]);

  const pathError = selectedDeployment ? validateHostLogPath(logPath, selectedDeployment.allowedLogRoots) : '';
  const parseValid = parserMode !== 'regex' || parserPattern.includes('?P<');
  const buildInput = (): LogRouteInput => ({
    routeId: savedRouteId || undefined,
    name: serviceQuery.data?.name,
    serviceId,
    serviceDeploymentId: deploymentId,
    sourceType: 'vm_file',
    endpointId,
    vm: {
      pathPattern: logPath.trim(),
      parseRules: buildParserRules(parserMode, parserRuleName, parserPattern),
    },
  });
  const canPreview = Boolean(selectedDeployment && endpointId && logPath.trim() && !pathError && parseValid);

  const previewMutation = useMutation({
    mutationFn: () => logsApi.previewRoute(buildInput()),
    onSuccess: setPreview,
  });
  const saveMutation = useMutation({
    mutationFn: () => savedRouteId
      ? logsApi.updateRoute(savedRouteId, buildInput())
      : logsApi.createRoute(buildInput()),
    onSuccess: async (result) => {
      setSavedRouteId(result.route.id);
      setPublishConfirmation(null);
      await queryClient.invalidateQueries({ queryKey: ['logs-onboarding-workspace'] });
    },
  });
  const publishMutation = useMutation({
    mutationFn: () => logsApi.publishRoute(savedRouteId, publishConfirmation?.requiresConfirmation ? {
      previewId: publishConfirmation.previewId,
      confirmationToken: publishConfirmation.confirmationToken,
    } : undefined),
    onSuccess: (result) => {
      setPublishConfirmation(result.requiresConfirmation ? result : null);
      void queryClient.invalidateQueries({ queryKey: ['logs-route-runtime', savedRouteId] });
      void queryClient.invalidateQueries({ queryKey: ['logs-route-rollouts', savedRouteId] });
    },
  });
  const runtimeQuery = useQuery({
    queryKey: ['logs-route-runtime', savedRouteId],
    queryFn: () => logsApi.getRouteRuntimeStatus(savedRouteId),
    enabled: Boolean(savedRouteId),
    refetchInterval: 10000,
  });
  const rolloutsQuery = useQuery({
    queryKey: ['logs-route-rollouts', savedRouteId],
    queryFn: () => logsApi.getRouteRollouts(savedRouteId),
    enabled: Boolean(savedRouteId),
  });
  const rollbackMutation = useMutation({
    mutationFn: (sourceRolloutId: string) => logsApi.rollbackRoute(savedRouteId, sourceRolloutId),
    onSuccess: () => {
      setPublishConfirmation(null);
      void queryClient.invalidateQueries({ queryKey: ['logs-route-runtime', savedRouteId] });
      void queryClient.invalidateQueries({ queryKey: ['logs-route-rollouts', savedRouteId] });
      void queryClient.invalidateQueries({ queryKey: ['logs-onboarding-workspace'] });
    },
  });
  const retryMutation = useMutation({
    mutationFn: (runtimeTargetId: string) => logsApi.retryRouteTarget(savedRouteId, runtimeTargetId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['logs-route-runtime', savedRouteId] });
      void queryClient.invalidateQueries({ queryKey: ['logs-route-rollouts', savedRouteId] });
    },
  });
  const createEnrollmentMutation = useMutation({
    mutationFn: (target: LogRouteRuntimeTarget) => issueHostEnrollmentToken(api, target.targetId),
    onSuccess: (credential) => {
      setEnrollment(credential);
      void runtimeQuery.refetch();
    },
  });

  const error = workspaceQuery.error ?? deploymentsQuery.error ?? serviceQuery.error;
  if (error) return <div className="p-3"><LogsErrorLine message={(error as Error).message} /></div>;

  return (
    <div className="space-y-3">
      <RouteEditor
        kind="host_set"
        deployments={deployments}
        selectedDeployment={selectedDeployment}
        deploymentId={deploymentId}
        onDeploymentChange={setDeploymentId}
        endpointId={endpointId}
        onEndpointChange={setEndpointId}
        endpoints={endpoints}
        parserMode={parserMode}
        parserRuleName={parserRuleName}
        parserPattern={parserPattern}
        onParserModeChange={setParserMode}
        onParserRuleNameChange={setParserRuleName}
        onParserPatternChange={setParserPattern}
        parseDialogOpen={parseDialogOpen}
        onParseDialogOpenChange={setParseDialogOpen}
        preview={preview}
        canPreview={canPreview}
        previewMutation={previewMutation}
        saveMutation={saveMutation}
        savedRouteId={savedRouteId}
        publishMutation={publishMutation}
        publishConfirmation={publishConfirmation}
        extraConfig={(
          <label className="block text-xs font-semibold">
            日志路径 *
            <input
              className={`console-input mt-1.5 w-full font-mono ${pathError && logPath ? 'border-danger' : ''}`}
              value={logPath}
              onChange={(event) => setLogPath(event.target.value)}
              placeholder={selectedDeployment?.allowedLogRoots[0] ? `${selectedDeployment.allowedLogRoots[0]}/*.log` : '/data/logs/*.log'}
            />
            {pathError && logPath ? <span className="mt-1 block font-normal text-danger">{pathError}</span> : null}
          </label>
        )}
      />

      {savedRouteId ? (
        <section className="rounded-md border border-outline bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-outline px-3 py-2.5">
            <div>
              <h2 className="text-sm font-semibold">主机覆盖与安装</h2>
              <p className="mt-1 text-xs text-muted">每台主机只安装一个 OpAMP Supervisor，由它托管本机日志 Collector。</p>
            </div>
            <button className="console-icon-button" aria-label="刷新主机覆盖" title="刷新" onClick={() => runtimeQuery.refetch()}>
              <RefreshCw className={`h-3.5 w-3.5 ${runtimeQuery.isFetching ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {runtimeQuery.error ? <div className="p-3"><LogsErrorLine message={(runtimeQuery.error as Error).message} /></div> : runtimeQuery.isLoading ? (
            <div className="console-skeleton m-3 h-28" />
          ) : !runtimeQuery.data ? <LogsEmptyState title="尚无运行目标" /> : (
            <>
              {runtimeQuery.data.expected === 0 ? (
                <div className="console-notice console-notice-danger m-3">部署目标没有预期主机，发布会被阻断。</div>
              ) : null}
              <div className="overflow-x-auto">
                <table className="console-table min-w-[860px] w-full">
                  <thead><tr><th>主机</th><th>安装</th><th>连接</th><th>进程</th><th>配置</th><th>数据</th><th className="text-right">操作</th></tr></thead>
                  <tbody>{runtimeQuery.data.targets.map((target) => (
                    <tr key={target.targetId}>
                      <td><div className="font-semibold">{target.targetName || target.targetId}</div><div className="mt-1 font-mono text-[11px] text-muted">{target.targetId}</div></td>
                      <td>{target.installationId ? '已注册' : '未安装'}</td>
                      <td><RuntimeState value={target.connectionStatus} /></td>
                      <td><RuntimeState value={target.processStatus} /></td>
                      <td><RuntimeState value={target.configStatus} /></td>
                      <td><RuntimeState value={target.dataStatus} /></td>
                      <td className="text-right">
                        {!target.installationId ? (
                          <button className="console-button" disabled={createEnrollmentMutation.isPending} onClick={() => createEnrollmentMutation.mutate(target)}>签发安装令牌</button>
                        ) : (
                          <div className="flex justify-end gap-2">
                            {['failed', 'drift'].includes(target.configStatus) ? (
                              <button className="console-button" disabled={retryMutation.isPending} onClick={() => retryMutation.mutate(target.targetId)}>重试</button>
                            ) : null}
                            {target.instanceUid ? <Link className="text-xs font-semibold text-primary hover:underline" to={`/agents/${encodeURIComponent(target.instanceUid)}`}>诊断</Link> : null}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </>
          )}
        </section>
      ) : null}

      {savedRouteId ? (
        <section className="rounded-md border border-outline bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-outline px-3 py-2.5">
            <div>
              <h2 className="text-sm font-semibold">发布历史</h2>
              <p className="mt-1 text-xs text-muted">回滚会复用历史产物创建新 generation，不会修改旧发布记录。</p>
            </div>
            <button className="console-icon-button" aria-label="刷新发布历史" title="刷新" onClick={() => rolloutsQuery.refetch()}>
              <RefreshCw className={`h-3.5 w-3.5 ${rolloutsQuery.isFetching ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {rolloutsQuery.error ? <div className="p-3"><LogsErrorLine message={(rolloutsQuery.error as Error).message} /></div> : rolloutsQuery.isLoading ? (
            <div className="console-skeleton m-3 h-24" />
          ) : !rolloutsQuery.data?.length ? <LogsEmptyState title="尚无发布记录" /> : (
            <div className="overflow-x-auto">
              <table className="console-table min-w-[760px] w-full">
                <thead><tr><th>Generation</th><th>状态</th><th>目标收敛</th><th>发布时间</th><th>来源</th><th className="text-right">操作</th></tr></thead>
                <tbody>{rolloutsQuery.data.map((rollout, index) => (
                  <tr key={rollout.rolloutId}>
                    <td><div className="font-semibold">#{rollout.generation}</div><div className="mt-1 max-w-48 truncate font-mono text-[11px] text-muted">{rollout.rolloutId}</div></td>
                    <td><RuntimeState value={rollout.status} /></td>
                    <td>{rollout.convergedTargets} / {rollout.expectedTargets}</td>
                    <td>{rollout.createdAt ? new Date(rollout.createdAt).toLocaleString() : '-'}</td>
                    <td>{rollout.rollbackOf ? `回滚自 #${rollout.rollbackOf.slice(-6)}` : '发布'}</td>
                    <td className="text-right">
                      {index === 0 ? <span className="text-xs text-muted">当前期望</span> : (
                        <button
                          className="console-button"
                          disabled={rollbackMutation.isPending}
                          onClick={() => rollbackMutation.mutate(rollout.rolloutId)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />回滚到此版本
                        </button>
                      )}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {createEnrollmentMutation.error ? <LogsErrorLine message={(createEnrollmentMutation.error as Error).message} /> : null}
      {rollbackMutation.error ? <LogsErrorLine message={(rollbackMutation.error as Error).message} /> : null}
      {enrollment ? (
        <section className="rounded-md border border-primary/30 bg-primary-soft p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-primary">一次性安装令牌</div>
              <p className="mt-1 text-xs text-muted">令牌只展示一次，请在有效期内写入 Supervisor 安装流程；不要保存到脚本仓库或日志。</p>
            </div>
            <button className="console-icon-button" aria-label="复制安装令牌" title="复制" onClick={() => navigator.clipboard?.writeText(enrollment.token)}><Copy className="h-4 w-4" /></button>
          </div>
          <pre className="mt-3 overflow-auto rounded border border-outline bg-white p-3 font-mono text-xs">{enrollment.token}</pre>
          <div className="mt-2 text-[11px] text-muted">installation_id: {enrollment.installation.installationId}</div>
        </section>
      ) : null}
    </div>
  );
}

function RuntimeState({ value }: { value: string }) {
  const tone = ['online', 'healthy', 'applied', 'flowing'].includes(value)
    ? 'text-emerald-700'
    : ['failed', 'unhealthy', 'drift', 'stale'].includes(value)
      ? 'text-danger'
      : 'text-muted';
  return <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${tone}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{runtimeLabel(value)}</span>;
}

function runtimeLabel(value: string) {
  const labels: Record<string, string> = {
    online: '在线', offline: '离线', revoked: '已吊销',
    healthy: '健康', unhealthy: '异常', unknown: '未知',
    pending: '待下发', applying: '应用中', applied: '已应用', failed: '失败', drift: '配置漂移',
    not_installed: '未安装',
    blocked: '已阻塞', degraded: '部分异常', converged: '已收敛',
    flowing: '有数据', stale: '数据中断', no_data: '暂无数据',
  };
  return (labels[value] ?? value) || '-';
}
