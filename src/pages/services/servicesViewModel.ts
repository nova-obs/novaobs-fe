import type { ServiceObservabilityGraph } from '../../services/types';

export function graphStatItems(graph: Pick<ServiceObservabilityGraph, 'agents' | 'logRoutes' | 'alertRules'>) {
  return [
    { label: 'Agent', value: graph.agents.length },
    { label: '日志路由', value: graph.logRoutes.total },
    { label: '告警规则', value: graph.alertRules.length },
  ];
}
