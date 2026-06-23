import test from 'node:test';
import assert from 'node:assert/strict';
import { api } from './api.ts';

function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => ({ success: true, data, error: null, meta: {} }),
  };
}

async function captureRequest(callApi, responseData = { id: '507f1f77bcf86cd799439011', name: 'saved' }) {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => {
    requests.push({
      path,
      init,
      body: init.body ? JSON.parse(init.body) : undefined,
    });
    return jsonResponse(responseData);
  };

  try {
    await callApi();
    assert.equal(requests.length, 1);
    return requests[0];
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('接口失败时不回退到 mock 数据', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 503,
    headers: { get: () => null },
    json: async () => ({ success: false, data: null, error: { message: '服务不可用' }, meta: {} }),
  });

  try {
    await assert.rejects(() => api.getServices(), /服务不可用/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('接口失败且响应体为空时返回 HTTP 状态错误', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    headers: { get: () => null },
    json: async () => { throw new SyntaxError('Unexpected end of JSON input'); },
  });

  try {
    await assert.rejects(() => api.getCollectorGroups(), /请求失败: 500/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('保存 Collector Group Override 时传递增量 YAML', async () => {
  const request = await captureRequest(
    () => api.saveCollectorGroupOverride('507f1f77bcf86cd799439013', 'processors:\n  batch:\n'),
    {
      id: '507f1f77bcf86cd799439021',
      collector_group_id: '507f1f77bcf86cd799439013',
      override_yaml: 'processors:\n  batch:\n',
      config_hash: 'abc123',
      status: 'active',
    },
  );

  assert.equal(request.path, '/api/v1/collector-groups/507f1f77bcf86cd799439013/config/override');
  assert.equal(request.init.method, 'PUT');
  assert.equal(request.body.override_yaml, 'processors:\n  batch:\n');
});

test('服务接入保存时以字符串 collector_group_id 传递 MongoDB ID', async () => {
  const request = await captureRequest(
    () => api.upsertServiceOnboarding('507f1f77bcf86cd799439011', {
      mode: 'shared_gateway',
      collectorGroupId: '507f1f77bcf86cd799439013',
    }),
    {
      service: { id: '507f1f77bcf86cd799439011', name: 'test-svc', environment: 'prod' },
      onboarding: {
        id: '507f1f77bcf86cd799439014',
        service_id: '507f1f77bcf86cd799439011',
        mode: 'shared_gateway',
        collector_group_id: '507f1f77bcf86cd799439013',
        status: 'pending_verification',
      },
      generated_config: {},
      checklist: [],
      available_actions: ['check'],
    },
  );

  assert.equal(request.path, '/api/v1/services/507f1f77bcf86cd799439011/onboarding');
  assert.equal(request.body.collector_group_id, '507f1f77bcf86cd799439013');
  assert.equal('identity_type' in request.body, false);
});

test('获取服务接入工作台时调用 GET /services/:id/onboarding', async () => {
  const request = await captureRequest(
    () => api.getServiceOnboarding('507f1f77bcf86cd799439011'),
    {
      service: { id: '507f1f77bcf86cd799439011', name: 'test-svc', environment: 'prod' },
      onboarding: { id: '507f1f77bcf86cd799439014', service_id: '507f1f77bcf86cd799439011', status: 'not_started' },
      generated_config: {},
      checklist: [],
      available_actions: ['save'],
    },
  );

  assert.equal(request.path, '/api/v1/services/507f1f77bcf86cd799439011/onboarding');
  assert.equal(request.init.method, undefined);
});

test('执行服务接入检查时调用 POST /services/:id/onboarding/check', async () => {
  const request = await captureRequest(
    () => api.checkServiceOnboarding('507f1f77bcf86cd799439011'),
    {
      service: { id: '507f1f77bcf86cd799439011', name: 'test-svc' },
      onboarding: { id: '507f1f77bcf86cd799439014', service_id: '507f1f77bcf86cd799439011', status: 'verified' },
      generated_config: {},
      checklist: [
        { key: 'service_metadata', name: '服务元数据', status: 'passed', blocking: true, message: '' },
      ],
      last_check: { status: 'verified', message: '', checked_at: '2026-05-08T10:00:00Z' },
      available_actions: ['check'],
    },
  );

  assert.equal(request.path, '/api/v1/services/507f1f77bcf86cd799439011/onboarding/check');
  assert.equal(request.init.method, 'POST');
});

test('创建服务时传递必填字段并以字符串 ID 返回', async () => {
  const request = await captureRequest(
    () => api.createService({ name: 'order-svc', environment: 'prod' }),
    {
      id: '507f1f77bcf86cd799439020',
      name: 'order-svc',
      environment: 'prod',
      source: 'manual',
      sync_status: 'local',
      status: 'pending',
    },
  );

  assert.equal(request.path, '/api/v1/services');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.body.name, 'order-svc');
  assert.equal(request.body.environment, 'prod');
});

test('更新服务时使用 PATCH 方法', async () => {
  const request = await captureRequest(
    () => api.updateService('507f1f77bcf86cd799439020', { name: 'order-svc-v2' }),
    { id: '507f1f77bcf86cd799439020', name: 'order-svc-v2' },
  );

  assert.equal(request.path, '/api/v1/services/507f1f77bcf86cd799439020');
  assert.equal(request.init.method, 'PATCH');
});

test('删除服务时调用 DELETE /services/:id', async () => {
  const request = await captureRequest(
    () => api.deleteService('507f1f77bcf86cd799439020'),
    null,
  );

  assert.equal(request.path, '/api/v1/services/507f1f77bcf86cd799439020');
  assert.equal(request.init.method, 'DELETE');
});

test('getServices 支持查询参数', async () => {
  const request = await captureRequest(
    () => api.getServices({ environment: 'prod', status: 'active' }),
    [],
  );

  assert.ok(request.path.includes('environment=prod'));
  assert.ok(request.path.includes('status=active'));
});

test('列表接口返回 null 时按空列表处理', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse(null);

  try {
    assert.deepEqual(await api.getServices(), []);
    assert.deepEqual(await api.getAlertRules(), []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('获取 K8s Dashboard 时调用统一 K8sOps API', async () => {
  const request = await captureRequest(
    () => api.getK8sDashboard('prod'),
    {
      stats: { cluster_id: 'prod', health: 'unknown', namespaces: 12, workloads: 47, pods: { total: 128, ready: 109, warning: 7 } },
      signals: [{ key: 'api-server', label: 'API Server', status: 'unknown', source: 'startorch', checked_at: '2026-05-19T10:30:00Z' }],
      sync: { status: 'unknown', source: 'startorch', time_window: '最近 15 分钟', last_synced_at: '2026-05-19T10:30:00Z' },
    },
  );

  assert.equal(request.path, '/api/v1/k8sops/dashboard?cluster_id=prod');
  assert.equal(request.init.method, undefined);
});

test('校验 Collector Group 配置时调用 validate 接口', async () => {
  const request = await captureRequest(
    () => api.validateCollectorGroupConfig('507f1f77bcf86cd799439013'),
    {
      valid: true,
      rendered_yaml: 'receivers:\n  otlp:\n',
      config_hash: 'abc123',
      errors: [],
      warnings: [],
      source_breakdown: [],
    },
  );

  assert.equal(request.path, '/api/v1/collector-groups/507f1f77bcf86cd799439013/config/validate');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.body, undefined);
});

test('导入平台模板时调用 import-from-agent', async () => {
  const request = await captureRequest(
    () => api.importCollectorPlatformTemplate({
      name: 'base-prod',
      sourceAgentUid: 'agent-001',
      collectorGroupId: '507f1f77bcf86cd799439013',
    }),
    {
      id: '507f1f77bcf86cd799439041',
      name: 'base-prod',
      source_agent_uid: 'agent-001',
      collector_group_id: '507f1f77bcf86cd799439013',
      base_yaml: 'receivers:\n  otlp:\n',
      status: 'active',
    },
  );

  assert.equal(request.path, '/api/v1/collector-platform-templates/import-from-agent');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.body.source_agent_uid, 'agent-001');
  assert.equal(request.body.collector_group_id, '507f1f77bcf86cd799439013');
});

test('更新平台模板时调用 PUT /collector-platform-templates/:id', async () => {
  const request = await captureRequest(
    () => api.updateCollectorPlatformTemplate('507f1f77bcf86cd799439041', {
      name: 'base-prod-v2',
      baseYaml: 'receivers:\n  otlp:\n',
    }),
    {
      id: '507f1f77bcf86cd799439041',
      name: 'base-prod-v2',
      base_yaml: 'receivers:\n  otlp:\n',
      status: 'active',
      version: 2,
    },
  );

  assert.equal(request.path, '/api/v1/collector-platform-templates/507f1f77bcf86cd799439041');
  assert.equal(request.init.method, 'PUT');
  assert.equal(request.body.name, 'base-prod-v2');
  assert.equal(request.body.base_yaml, 'receivers:\n  otlp:\n');
});

test('Agent Detail 缺少 runtime 字段时 mapper 不应导致页面白屏', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse({
    instance_uid: 'agent-001',
    runtime: {},
    agent: {
      state: {},
      identifying_attributes: [],
      non_identifying_attributes: [],
    },
    services: [],
    onboardings: [],
    configuration: {
      config_sources: {
        service_enrichment_patches: [],
        service_pipeline_patches: [],
        source_breakdown: [],
        warnings: [],
        errors: [],
      },
    },
  });

  try {
    const detail = await api.getAgentDetail('agent-001');
    assert.equal(detail.instanceUid, 'agent-001');
    assert.equal(detail.runtime.instanceUid, '');
    assert.equal(detail.runtime.remoteConfigStatus, 'unset');
    assert.equal(detail.configuration.configSources?.sourceBreakdown.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Agent Detail runtime 映射采集域稳定运行身份字段', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse({
    instance_uid: 'opamp-uid-b',
    runtime: {
      id: 'runtime-1',
      instance_uid: 'opamp-uid-b',
      opamp_instance_uid: 'opamp-uid-b',
      runtime_identity: 'k8s:test03:group-001:node-01',
      collector_group_id: 'group-001',
      cluster_id: 'test03',
      namespace: 'novaobs-system',
      agent_namespace: 'novaobs-system',
      pod_uid: 'pod-uid-b',
      pod_name: 'novaobs-logs-agent-b',
      node_name: 'node-01',
      pod_ip: '10.0.0.12',
      ip: '10.0.0.99',
      remote_config_status: 'applied',
    },
    agent: {
      state: {},
      identifying_attributes: [],
      non_identifying_attributes: [],
    },
    services: [],
    onboardings: [],
    configuration: { config_sources: { service_enrichment_patches: [], service_pipeline_patches: [], source_breakdown: [], warnings: [], errors: [] } },
  });

  try {
    const detail = await api.getAgentDetail('opamp-uid-b');
    assert.equal(detail.runtime.runtimeIdentity, 'k8s:test03:group-001:node-01');
    assert.equal(detail.runtime.clusterId, 'test03');
    assert.equal(detail.runtime.agentNamespace, 'novaobs-system');
    assert.equal(detail.runtime.podUid, 'pod-uid-b');
    assert.equal(detail.runtime.podIp, '10.0.0.12');
    assert.equal(detail.runtime.opampInstanceUid, 'opamp-uid-b');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('获取 Collector 实例时保留 runtime_identity 与 OpAMP 实例 UID', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init });
    return jsonResponse([
      {
        id: 'runtime-1',
        instance_uid: 'opamp-uid-b',
        opamp_instance_uid: 'opamp-uid-b',
        runtime_identity: 'k8s:test03:group-001:node-01',
        collector_group_id: 'group-001',
        cluster_id: 'test03',
        namespace: 'novaobs-system',
        agent_namespace: 'novaobs-system',
        pod_uid: 'pod-uid-b',
        pod_name: 'novaobs-logs-agent-b',
        node_name: 'node-01',
        pod_ip: '10.0.0.12',
        remote_config_status: 'applied',
      },
    ]);
  };

  try {
    const instances = await api.getCollectorInstances('group-001');
    assert.equal(requests[0].path, '/api/v1/collector-groups/group-001/instances');
    assert.equal(instances[0].instanceUid, 'opamp-uid-b');
    assert.equal(instances[0].runtimeIdentity, 'k8s:test03:group-001:node-01');
    assert.equal(instances[0].clusterId, 'test03');
    assert.equal(instances[0].namespace, 'novaobs-system');
    assert.equal(instances[0].agentNamespace, 'novaobs-system');
    assert.equal(instances[0].podUid, 'pod-uid-b');
    assert.equal(instances[0].podIp, '10.0.0.12');
    assert.equal(instances[0].opampInstanceUid, 'opamp-uid-b');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('发布 Collector Group 配置时调用 config/publish', async () => {
  const request = await captureRequest(
    () => api.publishCollectorGroupConfig('507f1f77bcf86cd799439013'),
    {
      id: '507f1f77bcf86cd799439022',
      collector_group_id: '507f1f77bcf86cd799439013',
      config_hash: 'abc123',
      collector_yaml: 'receivers:\n  otlp:\n',
      status: 'pending',
    },
  );

  assert.equal(request.path, '/api/v1/collector-groups/507f1f77bcf86cd799439013/config/publish');
  assert.equal(request.init.method, 'POST');
});

test('创建 Collector Group 时使用 POST 方法', async () => {
  const request = await captureRequest(
    () => api.createCollectorGroup({ name: 'shared-gw-prod', mode: 'shared_gateway', environment: 'prod' }),
    { id: '507f1f77bcf86cd799439030', name: 'shared-gw-prod', mode: 'shared_gateway', environment: 'prod', status: 'draft' },
  );

  assert.equal(request.path, '/api/v1/collector-groups');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.body.name, 'shared-gw-prod');
  assert.equal(request.body.mode, 'shared_gateway');
});

test('更新 Collector Group 时使用 PATCH 方法', async () => {
  const request = await captureRequest(
    () => api.updateCollectorGroup('507f1f77bcf86cd799439030', { status: 'disabled' }),
    { id: '507f1f77bcf86cd799439030', name: 'shared-gw-prod', status: 'disabled' },
  );

  assert.equal(request.path, '/api/v1/collector-groups/507f1f77bcf86cd799439030');
  assert.equal(request.init.method, 'PATCH');
  assert.equal(request.body.status, 'disabled');
});

test('启用 Collector Group 时调用 activate 接口', async () => {
  const request = await captureRequest(
    () => api.activateCollectorGroup('507f1f77bcf86cd799439030'),
    { id: '507f1f77bcf86cd799439030', name: 'shared-gw-prod', status: 'active' },
  );

  assert.equal(request.path, '/api/v1/collector-groups/507f1f77bcf86cd799439030/activate');
  assert.equal(request.init.method, 'POST');
});

test('getCollectorGroups 支持查询参数', async () => {
  const request = await captureRequest(
    () => api.getCollectorGroups({ environment: 'prod', status: 'active' }),
    [],
  );

  assert.ok(request.path.includes('environment=prod'));
  assert.ok(request.path.includes('status=active'));
});

test('获取 Collector Group 详情时调用 GET /collector-groups/:id', async () => {
  const request = await captureRequest(
    () => api.getCollectorGroup('507f1f77bcf86cd799439030'),
    { id: '507f1f77bcf86cd799439030', name: 'shared-gw-prod' },
  );

  assert.equal(request.path, '/api/v1/collector-groups/507f1f77bcf86cd799439030');
});

test('解除实例绑定时使用 DELETE 方法', async () => {
  const request = await captureRequest(
    () => api.unassignInstanceGroup('inst-001'),
    {},
  );

  assert.equal(request.path, '/api/v1/opamp/instances/inst-001/group');
  assert.equal(request.init.method, 'DELETE');
});

test('删除离线实例时使用 DELETE 方法', async () => {
  const request = await captureRequest(
    () => api.deleteCollectorInstance('inst-001'),
    {},
  );

  assert.equal(request.path, '/api/v1/opamp/instances/inst-001');
  assert.equal(request.init.method, 'DELETE');
});

test('删除 Collector Group 时使用 DELETE 方法', async () => {
  const request = await captureRequest(
    () => api.deleteCollectorGroup('507f1f77bcf86cd799439030'),
    {},
  );

  assert.equal(request.path, '/api/v1/collector-groups/507f1f77bcf86cd799439030');
  assert.equal(request.init.method, 'DELETE');
});

test('获取服务绑定 Agent 时调用 GET /services/:id/agents', async () => {
  const request = await captureRequest(
    () => api.getServiceAgents('svc-001'),
    [{ instance_uid: 'agent-001', service_id: 'svc-001', runtime_status: 'online' }],
  );

  assert.equal(request.path, '/api/v1/services/svc-001/agents');
});

test('日志告警测试和启用使用结构化规则契约', async () => {
  const spec = {
    name: '支付失败', description: '',
    scope: { serviceId: 'svc-a', serviceName: 'payment', logRouteId: 'route-a', endpointId: 'vl-a', accountId: '1', projectId: '2' },
    query: { mode: 'contains', expression: 'payment failed' },
    trigger: { mode: 'window', aggregation: 'count', operator: 'gte', threshold: 3, window: '1m', evaluationInterval: '30s', evaluationDelay: '5s', pendingFor: '0s', keepFiringFor: '0s' },
    grouping: { fields: ['deployment.environment'], maxInstances: 100 },
    notification: { policyId: 'default-webhook', severity: 'warning', ownerTeam: 'pay', runbookUrl: '' },
  };
  const request = await captureRequest(
    () => api.createAlertRule(spec, 'test-token'),
    { rule: { id: 'rule-a', spec: { name: '支付失败' }, state: 'enabled', apply_status: 'pending' } },
  );

  assert.equal(request.path, '/api/v1/alerts/rules');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.body.test_token, 'test-token');
  assert.equal(request.body.spec.scope.service_id, 'svc-a');
  assert.equal(request.body.spec.trigger.evaluation_interval, '30s');
  assert.deepEqual(request.body.spec.grouping.fields, ['deployment.environment']);
  assert.equal('draft' in request.body, false);
});

test('日志告警实例和更新记录使用统一 alerts API', async () => {
  const instances = await captureRequest(() => api.getAlertInstances({ state: 'firing' }), []);
  assert.equal(instances.path, '/api/v1/alerts/instances?state=firing');
  const updates = await captureRequest(() => api.getAlertRuleUpdates('rule-a'), []);
  assert.equal(updates.path, '/api/v1/alerts/rules/rule-a/updates');
});

test('通知策略使用受管资源而不是规则中的自由文本配置', async () => {
  const list = await captureRequest(() => api.getNotificationPolicies('svc-a'), []);
  assert.equal(list.path, '/api/v1/alerts/notification-policies?service_id=svc-a');

  const created = await captureRequest(
    () => api.createNotificationPolicy({ name: '支付值班', alertmanagerReceiver: 'pay-oncall' }),
    { id: 'policy-a', name: '支付值班', alertmanager_receiver: 'pay-oncall', enabled: true },
  );
  assert.equal(created.path, '/api/v1/alerts/notification-policies');
  assert.equal(created.body.alertmanager_receiver, 'pay-oncall');
  assert.equal('url' in created.body, false);
  assert.equal('secret' in created.body, false);
});
