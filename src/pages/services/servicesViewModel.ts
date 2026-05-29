import type { ServiceObservabilityGraph, ServiceTarget, ServiceTargetType } from '../../services/types';

export function targetTypeLabel(type: ServiceTargetType | string) {
  switch (type) {
    case 'cloud_native_workload':
      return '云原生工作负载';
    case 'host_process':
      return 'VM / 物理机进程';
    case 'physical_or_network_device':
      return '物理设备 / 网络设备';
    default:
      return '运行目标';
  }
}

export function targetPurposeLabel(type: ServiceTargetType | string) {
  switch (type) {
    case 'cloud_native_workload':
      return '用于 Kubernetes 拓扑、Pod 日志归属和工作负载级日志接入';
    case 'host_process':
      return '用于 VM / 物理机进程采集、主机日志归属和端口级排障';
    case 'physical_or_network_device':
      return '用于网络设备、Syslog 来源和边缘节点告警定位';
    default:
      return '用于把服务映射到真实运行实体，支撑采集、配置和告警归因';
  }
}

export function runningTargetPurposeItems() {
  return [
    {
      title: '定位真实运行实体',
      description: '把服务从 CMDB 条目落到 Pod、进程、主机或网络设备，避免只看服务名却不知道日志来自哪里。',
    },
    {
      title: '绑定采集与配置下发',
      description: '为 Agent、Collector Group 和日志路由提供匹配字段，决定哪些采集规则应该作用到这个服务。',
    },
    {
      title: '支撑排障和告警归因',
      description: '把日志、告警、配置 hash 和负责人串起来，帮助快速判断是服务、主机、设备还是下发配置问题。',
    },
  ];
}

export function targetLocationSummary(target: Pick<ServiceTarget, 'targetType' | 'identityAttributes'>) {
  const attrs = target.identityAttributes ?? {};
  if (target.targetType === 'cloud_native_workload') {
    return compactJoin([attrs['k8s.cluster.name'], attrs['k8s.namespace.name'], attrs['k8s.deployment.name'] || attrs['k8s.workload.name']]);
  }
  if (target.targetType === 'host_process') {
    return compactJoin([attrs['host.name'] || attrs['host.id'], attrs['process.executable.name'] || attrs['process.command'], attrs['net.host.port']]);
  }
  if (target.targetType === 'physical_or_network_device') {
    return compactJoin([attrs['device.name'] || attrs['device.id'], attrs['net.host.ip'] || attrs['host.ip'], attrs.vendor]);
  }
  return compactJoin(Object.values(attrs).slice(0, 3));
}

export function graphStatItems(graph: Pick<ServiceObservabilityGraph, 'targets' | 'agents' | 'logRoutes' | 'alertRules'>) {
  return [
    { label: '运行目标', value: graph.targets.length },
    { label: 'Agent', value: graph.agents.length },
    { label: '日志路由', value: graph.logRoutes.total },
    { label: '告警规则', value: graph.alertRules.length },
  ];
}

function compactJoin(values: Array<string | undefined>) {
  const text = values.map((value) => value?.trim()).filter(Boolean).join(' / ');
  return text || '未声明定位字段';
}
