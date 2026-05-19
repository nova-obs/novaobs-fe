import test from 'node:test';
import assert from 'node:assert/strict';
import { graphStatItems, runningTargetPurposeItems, targetLocationSummary, targetPurposeLabel, targetTypeLabel } from './servicesViewModel.ts';

test('云原生目标显示 cluster/namespace/workload 位置', () => {
  assert.equal(targetTypeLabel('cloud_native_workload'), '云原生工作负载');
  assert.equal(targetLocationSummary({
    targetType: 'cloud_native_workload',
    identityAttributes: {
      'k8s.cluster.name': 'prod-1',
      'k8s.namespace.name': 'orders',
      'k8s.deployment.name': 'orders-api',
    },
  }), 'prod-1 / orders / orders-api');
});

test('主机进程目标不依赖 namespace', () => {
  assert.equal(targetTypeLabel('host_process'), 'VM / 物理机进程');
  assert.equal(targetLocationSummary({
    targetType: 'host_process',
    identityAttributes: {
      'host.name': 'vm-01',
      'process.executable.name': 'legacy-billing',
      'net.host.port': '8080',
    },
  }), 'vm-01 / legacy-billing / 8080');
});

test('设备目标显示设备和地址', () => {
  assert.equal(targetTypeLabel('physical_or_network_device'), '物理设备 / 网络设备');
  assert.equal(targetLocationSummary({
    targetType: 'physical_or_network_device',
    identityAttributes: {
      'device.name': 'edge-fw-01',
      'net.host.ip': '10.0.0.8',
      vendor: 'Acme',
    },
  }), 'edge-fw-01 / 10.0.0.8 / Acme');
});

test('不同运行目标说明它在观测闭环中的作用', () => {
  assert.equal(targetPurposeLabel('cloud_native_workload'), '用于 Kubernetes 拓扑、Pod 日志归属和工作负载级 Pipeline 下发');
  assert.equal(targetPurposeLabel('host_process'), '用于 VM / 物理机进程采集、主机日志归属和端口级排障');
  assert.equal(targetPurposeLabel('physical_or_network_device'), '用于网络设备、Syslog 来源和边缘节点告警定位');
});

test('服务目录解释运行目标的统一作用', () => {
  assert.deepEqual(runningTargetPurposeItems().map((item) => item.title), [
    '定位真实运行实体',
    '绑定采集与配置下发',
    '支撑排障和告警归因',
  ]);
});

test('关系统计只包含已落地关系类型', () => {
  const items = graphStatItems({
    targets: [{ id: 't1' }],
    agents: [{ instanceUid: 'a1' }, { instanceUid: 'a2' }],
    pipelines: { sourceBreakdown: [{ id: 'p1' }, { id: 'p2' }] },
    alertRules: [{ id: 'r1' }],
  });
  assert.deepEqual(items.map((item) => item.label), ['运行目标', 'Agent', 'Pipeline 片段', '告警规则']);
  assert.deepEqual(items.map((item) => item.value), [1, 2, 2, 1]);
});
