import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVMEndpointDraft, renderK8sRouteFragmentDraft } from './LogsOnboardingPage.tsx';
import { isCollectingRoute, routeLifecycle } from './ServicePickerPanel.tsx';

const baseInput = {
  namespace: 'logplatform',
  workloadName: 'payment-api',
	serviceId: 'svc-payment',
  serviceName: 'payment-api',
  environmentId: 'prod',
  endpointWriteURL: 'http://vl.prod:9428/insert/opentelemetry/v1/logs',
  accountId: '',
  projectId: '',
  parseRules: [],
};

test('业务 Collector 示例为 VictoriaLogs 租户生成 AccountID 和 ProjectID 请求头', () => {
  const yaml = renderK8sRouteFragmentDraft({
    ...baseInput,
    accountId: '9527',
    projectId: '9528',
  });

  assert.match(yaml, /logs_endpoint: "http:\/\/vl\.prod:9428\/insert\/opentelemetry\/v1\/logs"\n    headers:\n      AccountID: "9527"\n      ProjectID: "9528"/);
});

test('业务 Collector 示例未配置 VictoriaLogs 租户时不生成租户请求头', () => {
  const yaml = renderK8sRouteFragmentDraft(baseInput);

  assert.equal(yaml.includes('AccountID:'), false);
  assert.equal(yaml.includes('ProjectID:'), false);
});

test('业务 Collector 使用 service.name 区分同一产品内服务并保留不可变服务 ID', () => {
	const yaml = renderK8sRouteFragmentDraft(baseInput);

	assert.match(yaml, /key: service\.name\n        value: "payment-api"/);
	assert.match(yaml, /key: novaapm\.service_id\n        value: "svc-payment"/);
});

test('VM 节点批量录入支持名称加地址或仅地址', () => {
  assert.deepEqual(parseVMEndpointDraft('vm-a,10.0.0.8:13133\n10.0.0.9:13133'), {
    items: [
      { name: 'vm-a', address: '10.0.0.8:13133' },
      { name: '10.0.0.9:13133', address: '10.0.0.9:13133' },
    ],
    error: '',
  });
});

test('VM 节点批量录入就地报告错误行', () => {
  assert.deepEqual(parseVMEndpointDraft('vm-a,10.0.0.8'), {
    items: [],
    error: '第 1 行地址格式错误，请填写 host:port',
  });
  assert.equal(parseVMEndpointDraft('').error, '请至少填写一个 VM 节点地址');
});

test('历史 VM 自动下发状态统一解释为手工接入且不算采集中', () => {
  const route = {
    route: {
      sourceType: 'vm_file',
      status: 'awaiting_nodes',
      lastPublishStatus: 'ready_for_agent_sync',
      lastPublishMessage: '旧状态',
      collectorConfigHash: 'hash-001',
    },
    source: { sourceType: 'vm_file', pathPattern: '/data/logs/*.log' },
  };

  assert.deepEqual(routeLifecycle(route), {
    label: '手工接入',
    tone: 'muted',
    detail: '通过安装材料和节点回填完成接入',
  });
  assert.equal(isCollectingRoute(route), false);
});

test('历史 K8s 已应用状态仍按采集中处理', () => {
  const route = {
    route: { sourceType: 'k8s_stdout', status: 'ready_for_agent_sync', lastPublishStatus: '', collectorConfigHash: 'hash-001' },
  };
  assert.equal(routeLifecycle(route).label, '已发布');
  assert.equal(isCollectingRoute(route), true);
});
