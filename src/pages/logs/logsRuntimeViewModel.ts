import type {
  CollectorEnrollmentCredential,
  CollectorInstallation,
} from '../../services/types';
import type {
  LogsCollectorRuntimeStatus,
} from './api';

export function buildRouteOptionLabel(input: {
  routeName: string;
  deploymentName: string;
  sourceType: string;
  endpointName: string;
}) {
  const source = input.sourceType === 'vm_file' ? 'VM' : 'K8S';
  return [input.routeName, input.deploymentName, source, input.endpointName]
    .filter(Boolean)
    .join(' · ');
}

export function buildLogsRuntimeURL(
  productId: string,
  serviceId: string,
  context: { deploymentId?: string; routeId?: string } = {},
) {
  const search = new URLSearchParams();
  if (context.deploymentId) search.set('deployment_id', context.deploymentId);
  if (context.routeId) search.set('route_id', context.routeId);
  const suffix = search.toString() ? `?${search.toString()}` : '';
  return `/products/${encodeURIComponent(productId)}/services/${encodeURIComponent(serviceId)}/logs/agents${suffix}`;
}

export function buildAgentDetailURL(
  instanceUid: string,
  returnTo: string,
  routeId = '',
) {
  const search = new URLSearchParams();
  search.set('return_to', returnTo);
  if (routeId) search.set('route_id', routeId);
  return `/agents/${encodeURIComponent(instanceUid)}?${search.toString()}`;
}

export function safeLogsReturnPath(value: string | null | undefined) {
  if (!value || value.startsWith('//')) return '/logs/agents';
  if (value === '/logs/agents') return value;
  return /^\/products\/[^/]+\/services\/[^/]+\/logs\/agents(?:[/?]|$)/.test(value)
    ? value
    : '/logs/agents';
}

export function summarizeK8sRuntimeStatus(status: LogsCollectorRuntimeStatus) {
  const labels: Record<string, string> = {
    ready: 'DaemonSet 已就绪',
    degraded: 'DaemonSet 部分就绪',
    pending_observation: '等待 DaemonSet 状态',
    stale: 'DaemonSet 状态已过期',
    unavailable: 'DaemonSet 状态不可用',
    not_deployed: '采集运行时未部署',
    unknown: 'DaemonSet 状态未知',
  };
  return {
    label: labels[status.status] ?? (status.status || 'DaemonSet 状态未知'),
    nodes: status.desiredNodes > 0 ? `${status.readyNodes}/${status.desiredNodes}` : '-',
    configStatus: status.configStatus,
    observedAt: status.observedAt,
    reason: status.ready ? '' : status.message,
  };
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
    installation.hostAssetId === hostAssetId
    && installation.agentRole === 'logs_agent'
    && installation.status !== 'revoked',
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
