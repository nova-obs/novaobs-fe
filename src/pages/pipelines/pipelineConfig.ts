import type { CollectorConfigAgentStatus, CollectorGroup } from '../../services/types';

const configStatusText: Record<string, string> = {
  none: '未发布',
  draft: '草稿',
  pending: '待应用',
  applying: '下发中',
  applied: '已生效',
  partial_failed: '部分失败',
  failed: '失败',
};

export function configStatusLabel(status: string) {
  return configStatusText[status] ?? status;
}

export function shortHash(hash: string) {
  return hash ? hash.slice(0, 8) : '-';
}

export function summarizeCollectorGroupConfig(group: Pick<CollectorGroup, 'name' | 'configVersion' | 'lastPublishStatus' | 'desiredConfigHash'>) {
  return `${group.name} · v${group.configVersion || 0} · ${configStatusLabel(group.lastPublishStatus)} · ${shortHash(group.desiredConfigHash)}`;
}

export function describeApplyMatrix(agents: Pick<CollectorConfigAgentStatus, 'remoteConfigCapable' | 'inSync'>[]) {
  const total = agents.length;
  const capable = agents.filter((agent) => agent.remoteConfigCapable).length;
  const inSync = agents.filter((agent) => agent.inSync).length;
  return {
    total,
    capable,
    inSync,
    label: `${inSync}/${total} in sync · ${capable} remote-config capable`,
  };
}

export function configStatusColor(status: string) {
  if (status === 'applied') return 'text-emerald-400';
  if (status === 'failed' || status === 'partial_failed') return 'text-red-400';
  if (status === 'pending' || status === 'applying' || status === 'draft') return 'text-amber-400';
  return 'text-muted';
}

export function sourceTypeLabel(type: string) {
  const labels: Record<string, string> = {
    platform_template: '平台模板',
    group_override: '采集组覆盖',
    service_enrichment: '服务属性补齐',
    service_pipeline_patch: '业务解析规则',
  };
  return labels[type] ?? type;
}
