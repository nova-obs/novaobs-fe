import test from 'node:test';
import assert from 'node:assert/strict';
import { logSourceLabel, logsApi } from './api.ts';

function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => ({ success: true, data, error: null, meta: {} }),
  };
}

async function captureRequest(callApi, responseData = {}) {
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
    const result = await callApi();
    assert.equal(requests.length, 1);
    return { request: requests[0], result };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('获取 Logs 接入工作台时调用统一 onboarding workspace 接口', async () => {
  const { request, result } = await captureRequest(
    () => logsApi.getWorkspace(),
    {
      services: [{ id: 'svc-001', name: 'order-api', environment: 'prod' }],
      collector_groups: [{ id: 'ag-001', name: 'prod-ds', mode: 'daemonset', online_instances: 2 }],
      clusters: [{ id: 'test03', name: 'test03', version: 'v1.28.3', access_mode: 'direct/ro', read_only: true }],
      endpoints: [{ id: 'vl-001', name: 'vl-prod', write_url: 'http://vl/insert', vmui_url: 'http://vl/select/vmui', scope_type: 'k8s_cluster', cluster_id: 'test03' }],
      routes: [],
    },
  );

  assert.equal(request.path, '/api/v1/logs/onboarding/workspace');
  assert.equal(request.init.method, undefined);
  assert.equal(result.services[0].id, 'svc-001');
  assert.equal(result.clusters[0].readOnly, true);
  assert.equal(result.endpoints[0].vmuiURL, 'http://vl/select/vmui');
  assert.equal(result.endpoints[0].scopeType, 'k8s_cluster');
  assert.equal(result.endpoints[0].clusterId, 'test03');
});

test('Logs 接入来源只按 K8s 和 VM 展示', () => {
  assert.equal(logSourceLabel('k8s_stdout'), 'K8s');
  assert.equal(logSourceLabel('k8s_hostpath'), 'K8s');
  assert.equal(logSourceLabel('vm_file'), 'VM');
});

test('同步 K8s namespace 服务时使用专用 logs onboarding 接口', async () => {
  const { request, result } = await captureRequest(
    () => logsApi.syncK8sServices({
      clusterId: 'test03',
      namespace: 'logplatform',
      environment: 'prod',
      ownerTeam: 'sre',
      workloadKind: 'Deployment',
    }),
    {
      total: 1,
      services: [{
        created: true,
        target_id: 'target-001',
        service: { id: 'svc-001', name: 'utrace-api', identity_type: 'k8s_workload', service_type: 'k8s业务', source: 'k8s', sync_status: 'synced' },
        workload: { kind: 'Deployment', name: 'utrace-api', namespace: 'logplatform' },
      }],
    },
  );

  assert.equal(request.path, '/api/v1/logs/onboarding/k8s/sync-services');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.body.cluster_id, 'test03');
  assert.equal(request.body.namespace, 'logplatform');
  assert.equal(result.services[0].service.serviceType, 'k8s业务');
  assert.equal(result.services[0].created, true);
});

test('预览 Logs route 时使用 snake_case body 并传递解析策略', async () => {
  const { request, result } = await captureRequest(
    () => logsApi.previewRoute({
      serviceId: 'svc-001',
      sourceType: 'k8s_stdout',
      agentGroupId: 'ag-001',
      endpointId: '',
      k8s: {
        clusterId: 'test03',
        namespace: 'logplatform',
        agentNamespace: 'novaobs-system',
        workloadKind: 'Deployment',
        workloadName: 'api',
        workloadSelector: { app: 'api' },
        parseRules: [{ name: 'text', ruleType: 'regex', pattern: '^(?P<level>[A-Z]+) (?P<message>.*)$' }],
        collectorYAML: 'receivers:\n  filelog/custom:\n',
      },
    }),
    {
      source: { id: 'src-001', source_type: 'k8s_stdout', cluster_id: 'test03', namespace: 'logplatform' },
      endpoint: { id: 'vl-001', name: 'vl-prod' },
      agent_yaml: 'apiVersion: apps/v1\nkind: DaemonSet\n',
      config_hash: 'abc123',
      mode: 'preview',
      publish_blocked: false,
      warnings: [],
    },
  );

  assert.equal(request.path, '/api/v1/logs/routes/preview');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.body.service_id, 'svc-001');
  assert.equal(request.body.source_type, 'k8s_stdout');
  assert.equal(request.body.agent_group_id, 'ag-001');
  assert.equal(request.body.endpoint_id, '');
  assert.equal(request.body.k8s.cluster_id, 'test03');
  assert.deepEqual(request.body.k8s.workload_selector, { app: 'api' });
  assert.equal(request.body.k8s.parse_rules[0].rule_type, 'regex');
  assert.equal(request.body.k8s.collector_yaml, 'receivers:\n  filelog/custom:\n');
  assert.equal(result.configHash, 'abc123');
});

test('预览 Logs 解析规则时调用 parse-preview 接口并映射字段', async () => {
  const { request, result } = await captureRequest(
    () => logsApi.previewParseRules('WARN payment timeout', [
      { name: 'text', ruleType: 'regex', pattern: '^(?P<level>[A-Z]+) (?P<message>.*)$', enabled: true },
    ]),
    {
      status: 'ok',
      fields: { level: 'WARN', message: 'payment timeout' },
      warnings: [],
      errors: [],
    },
  );

  assert.equal(request.path, '/api/v1/logs/parse-preview');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.body.sample, 'WARN payment timeout');
  assert.equal(request.body.parse_rules[0].rule_type, 'regex');
  assert.equal(result.status, 'ok');
  assert.equal(result.fields.level, 'WARN');
});

test('发布 Logs route 时传递 preview confirmation token', async () => {
  const { request, result } = await captureRequest(
    () => logsApi.publishRoute('route-001', { previewId: 'preview-001', confirmationToken: 'token-001' }),
    {
      status: 'published',
      message: '已发布',
      requires_confirmation: false,
      audit_id: 'audit-001',
      warnings: [],
      plan: {
        id: 'plan-001',
        route_id: 'route-001',
        agent_group_id: 'ag-001',
        source_type: 'k8s_stdout',
        config_hash: 'abc123',
        rendered_yaml: 'apiVersion: apps/v1\n',
        status: 'published',
        audit_id: 'audit-001',
      },
    },
  );

  assert.equal(request.path, '/api/v1/logs/routes/route-001/publish');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.body.preview_id, 'preview-001');
  assert.equal(request.body.confirmation_token, 'token-001');
  assert.equal(result.auditId, 'audit-001');
  assert.equal(result.plan?.sourceType, 'k8s_stdout');
});
