import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAgentDetailURL,
  buildLogsRuntimeURL,
  buildRouteOptionLabel,
  summarizeK8sRuntimeStatus,
  safeLogsReturnPath,
} from './logsRuntimeViewModel.ts';

test('路由选择项包含部署名称以区分同一服务的多个部署', () => {
  assert.equal(buildRouteOptionLabel({
    routeName: '订单服务',
    sourceType: 'vm_file',
    endpointName: '生产 VictoriaLogs',
    deploymentName: '华东生产主机',
  }), '订单服务 · 华东生产主机 · VM · 生产 VictoriaLogs');
});

test('日志运行深链同时保留 deployment 和 route 上下文', () => {
  assert.equal(
    buildLogsRuntimeURL('product-1', 'service-1', {
      deploymentId: 'deployment-1',
      routeId: 'route-1',
    }),
    '/products/product-1/services/service-1/logs/agents?deployment_id=deployment-1&route_id=route-1',
  );
});

test('Agent 详情链接携带稳定的平台内返回地址', () => {
  const runtimeURL = '/products/product-1/services/service-1/logs/agents?deployment_id=deployment-1&route_id=route-1';
  const url = new URL(buildAgentDetailURL('instance-1', runtimeURL), 'http://novaapm.test');
  assert.equal(url.pathname, '/agents/instance-1');
  assert.equal(url.searchParams.get('return_to'), runtimeURL);
});

test('Agent 返回地址只接受 NovaAPM 站内绝对路径', () => {
  assert.equal(safeLogsReturnPath('/products/p/services/s/logs/agents?route_id=r'), '/products/p/services/s/logs/agents?route_id=r');
  assert.equal(safeLogsReturnPath('https://evil.example/path'), '/logs/agents');
  assert.equal(safeLogsReturnPath('//evil.example/path'), '/logs/agents');
  assert.equal(safeLogsReturnPath('/platform/settings'), '/logs/agents');
});

test('K8S runtime 使用共享 DaemonSet 快照，不伪造 VM 连接和进程状态', () => {
  const runtime = summarizeK8sRuntimeStatus({
    clusterId: 'cluster-1',
    namespace: 'novaapm-system',
    ready: false,
    status: 'degraded',
    message: 'DaemonSet 2/3 ready',
    runtime: { id: 'runtime-1' },
    desiredNodes: 3,
    updatedNodes: 2,
    readyNodes: 2,
    availableNodes: 2,
    configStatus: 'pending',
    observedAt: '2026-07-28T08:00:00Z',
    resources: [],
  });
  assert.equal(runtime.label, 'DaemonSet 部分就绪');
  assert.equal(runtime.nodes, '2/3');
  assert.equal(runtime.configStatus, 'pending');
  assert.equal(runtime.observedAt, '2026-07-28T08:00:00Z');
  assert.equal('connectionStatus' in runtime, false);
  assert.equal('processStatus' in runtime, false);
});
