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

export function graphStatItems(graph: Pick<ServiceObservabilityGraph, 'targets' | 'agents' | 'pipelines' | 'alertRules'>) {
  return [
    { label: '运行目标', value: graph.targets.length },
    { label: 'Agent', value: graph.agents.length },
    { label: 'Pipeline 片段', value: graph.pipelines.sourceBreakdown.length },
    { label: '告警规则', value: graph.alertRules.length },
  ];
}

function compactJoin(values: Array<string | undefined>) {
  const text = values.map((value) => value?.trim()).filter(Boolean).join(' / ');
  return text || '未声明定位字段';
}
