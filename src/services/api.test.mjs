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

test('getServices 支持查询参数', async () => {
  const request = await captureRequest(
    () => api.getServices({ environment: 'prod', status: 'active' }),
    [],
  );

  assert.ok(request.path.includes('environment=prod'));
  assert.ok(request.path.includes('status=active'));
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

test('生成服务属性补齐时可传递 collector group', async () => {
  const request = await captureRequest(
    () => api.regenerateServiceEnrichmentPatch('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439013'),
    {
      id: '507f1f77bcf86cd799439051',
      service_id: '507f1f77bcf86cd799439011',
      collector_group_id: '507f1f77bcf86cd799439013',
      patch_yaml: 'processors:\n  transform/enrich:\n',
      warnings: [],
      status: 'generated',
    },
  );

  assert.equal(request.path, '/api/v1/services/507f1f77bcf86cd799439011/enrichment-patch/regenerate');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.body.collector_group_id, '507f1f77bcf86cd799439013');
});


test('预览解析规则时调用 parser-rule/preview', async () => {
  const request = await captureRequest(
    () => api.previewServiceParserRule('507f1f77bcf86cd799439011', {
      parseMode: 'regex',
      regexPattern: 'order_id=(?P<order_id>[\\w-]+)',
      attributeMappings: { order_id: 'order.id' },
      resourceMappings: { namespace: 'k8s.namespace.name' },
      sampleLog: 'order_id=A-1',
    }),
    {
      valid: true,
      parse_mode: 'regex',
      sample_log: 'order_id=A-1',
      parsed_fields: { order_id: 'A-1' },
      mapped_attributes: { 'order.id': 'A-1' },
      mapped_resources: {},
      unmapped_fields: [],
      warnings: [],
      errors: [],
    },
  );

  assert.equal(request.path, '/api/v1/services/507f1f77bcf86cd799439011/parser-rule/preview');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.body.parse_mode, 'regex');
  assert.equal(request.body.regex_pattern, 'order_id=(?P<order_id>[\\w-]+)');
  assert.deepEqual(request.body.attribute_mappings, { order_id: 'order.id' });
  assert.deepEqual(request.body.resource_mappings, { namespace: 'k8s.namespace.name' });
});

test('生成服务业务 Patch 时调用 generate-patch', async () => {
  const request = await captureRequest(
    () => api.generateServicePipelinePatch('507f1f77bcf86cd799439011'),
    {
      id: '507f1f77bcf86cd799439061',
      service_id: '507f1f77bcf86cd799439011',
      collector_group_id: '507f1f77bcf86cd799439013',
      patch_yaml: 'processors:\n  transform/parser:\n',
      status: 'active',
    },
  );

  assert.equal(request.path, '/api/v1/services/507f1f77bcf86cd799439011/parser-rule/generate-patch');
  assert.equal(request.init.method, 'POST');
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

test('保存服务公共处理片段时调用 pipeline/base', async () => {
  const request = await captureRequest(
    () => api.saveServicePipelineBase('svc-001', ''),
    { id: 'service-base:svc-001', base_yaml: '' },
  );

  assert.equal(request.path, '/api/v1/services/svc-001/pipeline/base');
  assert.equal(request.init.method, 'PUT');
  assert.equal(request.body.base_yaml, '');
});

test('保存服务级解析规则时不再传递 collector_group_id', async () => {
  const request = await captureRequest(
    () => api.saveServicePipelineParserRule('svc-001', { parseMode: 'json', parseFrom: 'body', enabled: true }),
    { id: 'rule-001', service_id: 'svc-001', parse_mode: 'json', enabled: true },
  );

  assert.equal(request.path, '/api/v1/services/svc-001/pipeline/parser-rule');
  assert.equal(request.init.method, 'PUT');
  assert.equal('collector_group_id' in request.body, false);
});

test('发布服务级 Pipeline 时调用服务发布接口并映射下发数量', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse({
    service_id: 'svc-001',
    config_hash: 'abc123',
    rendered_yaml: 'service:\n',
    agent_count: 2,
    active_delivery_count: 1,
    queued_delivery_count: 1,
    skipped_agents: [],
  });

  try {
    const result = await api.publishServicePipeline('svc-001');
    assert.equal(result.serviceId, 'svc-001');
    assert.equal(result.activeDeliveryCount, 1);
    assert.equal(result.queuedDeliveryCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
