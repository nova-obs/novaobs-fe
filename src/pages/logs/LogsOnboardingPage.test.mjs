import test from 'node:test';
import assert from 'node:assert/strict';
import { renderK8sRouteFragmentDraft } from './LogsOnboardingPage.tsx';
import { issueHostEnrollmentToken, validateHostLogPath } from './VMOnboardingFlow.tsx';
import { isCollectingRoute, routeLifecycle } from './ServicePickerPanel.tsx';

const baseInput = {
  namespace: 'logplatform',
  workloadName: 'payment-api',
	serviceId: 'svc-payment',
  serviceName: 'payment-api',
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

test('VM 日志路径必须位于部署目标允许根目录内', () => {
  assert.equal(validateHostLogPath('/data/logs/orders/*.log', ['/data/logs']), '');
  assert.equal(validateHostLogPath('/data/logs2/orders.log', ['/data/logs']), '日志路径必须位于部署目标允许的日志根目录内');
  assert.equal(validateHostLogPath('../orders.log', ['/data/logs']), '日志路径必须是绝对路径');
  assert.equal(validateHostLogPath('/data/logs/../secret', ['/data/logs']), '日志路径不能包含 ..');
});

test('注册令牌过期后复用同一条待注册 Installation 重新签发', async () => {
  const calls = [];
  const client = {
    getCollectorInstallations: async () => [{
      installationId: 'installation-pending',
      hostAssetId: 'host-1',
      agentRole: 'logs_agent',
      status: 'pending',
    }],
    createCollectorInstallation: async () => {
      calls.push('create');
      throw new Error('不应创建第二条 Installation');
    },
    issueCollectorEnrollmentToken: async (installationId) => {
      calls.push(`issue:${installationId}`);
      return { installation: { installationId }, token: 'stub-token' };
    },
  };

  const result = await issueHostEnrollmentToken(client, 'host-1');

  assert.equal(result.token, 'stub-token');
  assert.deepEqual(calls, ['issue:installation-pending']);
});

test('主机尚无 Installation 时先创建再签发注册令牌', async () => {
  const calls = [];
  const client = {
    getCollectorInstallations: async () => [],
    createCollectorInstallation: async ({ hostAssetId, agentRole }) => {
      calls.push(`create:${hostAssetId}:${agentRole}`);
      return { installationId: 'installation-new' };
    },
    issueCollectorEnrollmentToken: async (installationId) => {
      calls.push(`issue:${installationId}`);
      return { installation: { installationId }, token: 'new-token' };
    },
  };

  const result = await issueHostEnrollmentToken(client, 'host-1');

  assert.equal(result.token, 'new-token');
  assert.deepEqual(calls, ['create:host-1:logs_agent', 'issue:installation-new']);
});

test('已经完成注册的日志 Agent 不允许重新走 Enrollment 流程', async () => {
  const client = {
    getCollectorInstallations: async () => [{
      installationId: 'installation-active',
      hostAssetId: 'host-1',
      agentRole: 'logs_agent',
      status: 'active',
    }],
    createCollectorInstallation: async () => {
      throw new Error('不应创建第二条 Installation');
    },
    issueCollectorEnrollmentToken: async () => {
      throw new Error('不应签发 Enrollment Token');
    },
  };

  await assert.rejects(
    issueHostEnrollmentToken(client, 'host-1'),
    /已完成注册.*轮换安装凭据/,
  );
});

test('VM 已应用状态按平台发布结果解释为采集中', () => {
  const route = {
    route: {
      sourceType: 'vm_file',
      status: 'active',
      lastPublishStatus: 'applied',
      lastPublishMessage: '旧状态',
      collectorConfigHash: 'hash-001',
    },
    source: { sourceType: 'vm_file', pathPattern: '/data/logs/*.log' },
  };

  assert.equal(routeLifecycle(route).label, '已发布');
  assert.equal(isCollectingRoute(route), true);
});

test('历史 K8s 已应用状态仍按采集中处理', () => {
  const route = {
    route: { sourceType: 'k8s_stdout', status: 'ready_for_agent_sync', lastPublishStatus: '', collectorConfigHash: 'hash-001' },
  };
  assert.equal(routeLifecycle(route).label, '已发布');
  assert.equal(isCollectingRoute(route), true);
});

test('逐目标发布汇总状态不会退化成未发布', () => {
  const degraded = {
    route: {
      sourceType: 'vm_file',
      status: 'awaiting_nodes',
      lastPublishStatus: 'degraded',
      lastPublishMessage: '部分预期主机异常或尚未安装',
      collectorConfigHash: 'hash-002',
    },
  };
  const blocked = {
    route: {
      sourceType: 'vm_file',
      status: 'awaiting_nodes',
      lastPublishStatus: 'blocked',
      lastPublishMessage: '没有预期主机',
      collectorConfigHash: 'hash-003',
    },
  };

  assert.equal(routeLifecycle(degraded).label, '部分异常');
  assert.equal(routeLifecycle(blocked).label, '已阻塞');
});
