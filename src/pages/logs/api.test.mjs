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
      endpoints: [{ id: 'vl-001', name: 'vl-prod', sink_type: 'vl', stream_name: '', write_url: 'http://vl/insert', vmui_url: 'http://vl/select/vmui', scope_type: 'k8s_cluster', cluster_id: 'test03' }],
      routes: [],
    },
  );

  assert.equal(request.path, '/api/v1/logs/onboarding/workspace');
  assert.equal(request.init.method, undefined);
  assert.equal(result.services[0].id, 'svc-001');
  assert.equal(result.clusters[0].readOnly, true);
  assert.equal(result.endpoints[0].vmuiURL, 'http://vl/select/vmui');
  assert.equal(result.endpoints[0].sinkType, 'vl');
  assert.equal(result.endpoints[0].scopeType, 'k8s_cluster');
  assert.equal(result.endpoints[0].clusterId, 'test03');
});

test('获取 Logs 接入工作台时保留已登记路由草稿配置', async () => {
  const { result } = await captureRequest(
    () => logsApi.getWorkspace(),
    {
      services: [{ id: 'svc-001', name: 'order-api', environment: 'prod', identity_type: 'k8s_workload' }],
      collector_groups: [],
      clusters: [],
      endpoints: [{ id: 'sink-001', name: 'vl-prod', sink_type: 'vl', write_url: 'http://vl/insert' }],
      routes: [{
        route: {
          id: 'route-001',
          service_id: 'svc-001',
          source_id: 'source-001',
          source_type: 'k8s_stdout',
          endpoint_id: 'sink-001',
          collector_config_hash: 'collector-hash-001',
          status: 'ready',
        },
        source: {
          id: 'source-001',
          source_type: 'k8s_stdout',
          cluster_id: 'test03',
          namespace: 'logplatform',
          agent_namespace: 'novaobs-system',
          workload_kind: 'Deployment',
          workload_name: 'order-api',
          parse_rules: [{ name: 'json-parser', rule_type: 'json', enabled: true }],
          collector_config_hash: 'collector-hash-001',
          deployment_manifest_hash: 'manifest-hash-001',
        },
        endpoint: { id: 'sink-001', name: 'vl-prod', sink_type: 'vl', write_url: 'http://vl/insert' },
      }],
    },
  );

  assert.equal(result.routes[0].source?.clusterId, 'test03');
  assert.equal(result.routes[0].source?.agentNamespace, 'novaobs-system');
  assert.equal(result.routes[0].source?.collectorYAML, '');
  assert.equal(result.routes[0].route.collectorConfigHash, 'collector-hash-001');
  assert.equal(result.routes[0].source?.deploymentManifestHash, 'manifest-hash-001');
  assert.equal(result.routes[0].source?.parseRules[0].ruleType, 'json');
  assert.equal(result.routes[0].endpoint?.sinkType, 'vl');
});

test('创建 Logs 下游端点时传递端点类型和 stream 名称', async () => {
  const { request, result } = await captureRequest(
    () => logsApi.createEndpoint({
      name: 'kafka-prod',
      sinkType: 'kafka',
      streamName: 'novaobs-logs',
      writeURL: 'kafka-0:9092,kafka-1:9092',
      scopeType: 'vm',
    }),
    {
      id: 'sink-001',
      name: 'kafka-prod',
      sink_type: 'kafka',
      stream_name: 'novaobs-logs',
      write_url: 'kafka-0:9092,kafka-1:9092',
      scope_type: 'vm',
    },
  );

  assert.equal(request.path, '/api/v1/logs/endpoints');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.body.sink_type, 'kafka');
  assert.equal(request.body.stream_name, 'novaobs-logs');
  assert.equal(request.body.write_url, 'kafka-0:9092,kafka-1:9092');
  assert.equal(result.sinkType, 'kafka');
  assert.equal(result.streamName, 'novaobs-logs');
});

test('更新 Logs 下游端点时使用 PATCH 并保留端点 ID', async () => {
  const { request, result } = await captureRequest(
    () => logsApi.updateEndpoint('sink-001', {
      name: 'vl-prod-fixed',
      sinkType: 'vl',
      writeURL: 'http://vl:9428/insert/opentelemetry/v1/logs',
      queryURL: 'http://vl:9428/select/logsql/query',
      vmuiURL: 'http://vl:9428/select/vmui',
      scopeType: 'k8s_cluster',
      clusterId: 'test03',
    }),
    {
      id: 'sink-001',
      name: 'vl-prod-fixed',
      sink_type: 'vl',
      write_url: 'http://vl:9428/insert/opentelemetry/v1/logs',
      scope_type: 'k8s_cluster',
      cluster_id: 'test03',
    },
  );

  assert.equal(request.path, '/api/v1/logs/endpoints/sink-001');
  assert.equal(request.init.method, 'PATCH');
  assert.equal(request.body.name, 'vl-prod-fixed');
  assert.equal(request.body.write_url, 'http://vl:9428/insert/opentelemetry/v1/logs');
  assert.equal(request.body.scope_type, 'k8s_cluster');
  assert.equal(result.id, 'sink-001');
  assert.equal(result.name, 'vl-prod-fixed');
});

test('Logs 接入来源只按 K8s 和 VM 展示', () => {
  assert.equal(logSourceLabel('k8s_stdout'), 'K8s');
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
      routeId: 'route-001',
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
      },
      vm: {
        hostGroup: 'legacy-vms',
        pathPattern: '/data/logs/*.log',
        collectorYAML: 'legacy collector yaml',
      },
    }),
    {
      source: { id: 'src-001', source_type: 'k8s_stdout', cluster_id: 'test03', namespace: 'logplatform' },
      endpoint: { id: 'vl-001', name: 'vl-prod' },
      agent_yaml: 'apiVersion: apps/v1\nkind: DaemonSet\n',
      collector_config_hash: 'collector-abc123',
      deployment_manifest_hash: 'manifest-abc123',
      mode: 'preview',
      publish_blocked: false,
      warnings: [],
    },
  );

  assert.equal(request.path, '/api/v1/logs/routes/preview');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.body.service_id, 'svc-001');
  assert.equal(request.body.route_id, 'route-001');
  assert.equal(request.body.source_type, 'k8s_stdout');
  assert.equal(request.body.agent_group_id, 'ag-001');
  assert.equal(request.body.endpoint_id, '');
  assert.equal(request.body.k8s.cluster_id, 'test03');
  assert.deepEqual(request.body.k8s.workload_selector, { app: 'api' });
  assert.equal(request.body.k8s.runtime_log_paths, undefined);
  assert.equal(request.body.k8s.parse_rules[0].rule_type, 'regex');
  assert.equal(request.body.k8s.collector_yaml, undefined);
  assert.equal(request.body.vm.collector_yaml, undefined);
  assert.equal(request.body.vm.host_group, undefined);
  assert.equal(result.collectorConfigHash, 'collector-abc123');
  assert.equal(result.deploymentManifestHash, 'manifest-abc123');
});

test('更新 Logs route 时使用 PATCH 并保留 route_id', async () => {
  const { request, result } = await captureRequest(
    () => logsApi.updateRoute('route-001', {
      routeId: 'route-001',
      serviceId: 'svc-001',
      sourceType: 'k8s_stdout',
      agentGroupId: 'ag-001',
      endpointId: 'sink-001',
      k8s: {
        clusterId: 'test03',
        namespace: 'logplatform',
        agentNamespace: 'novaobs-system',
        workloadKind: 'Deployment',
        workloadName: 'api',
      },
    }),
    {
      route: { id: 'route-001', service_id: 'svc-001', source_type: 'k8s_stdout', endpoint_id: 'sink-001', status: 'ready' },
      source: { id: 'source-001', source_type: 'k8s_stdout', cluster_id: 'test03', namespace: 'logplatform' },
      endpoint: { id: 'sink-001', name: 'vl-prod', sink_type: 'vl' },
    },
  );

  assert.equal(request.path, '/api/v1/logs/routes/route-001');
  assert.equal(request.init.method, 'PATCH');
  assert.equal(request.body.route_id, 'route-001');
  assert.equal(request.body.k8s.collector_yaml, undefined);
  assert.equal(result.route.id, 'route-001');
  assert.equal(result.source?.collectorYAML, '');
});

test('查看 Logs route 采集配置 hash 对应完整 collector_yaml', async () => {
  const { request, result } = await captureRequest(
    () => logsApi.getRouteCollectorConfig('route-001'),
    {
      route_id: 'route-001',
      collector_config_hash: 'collector-hash-001',
      deployment_manifest_hash: 'manifest-hash-001',
      source_type: 'k8s_stdout',
      collector_yaml: 'receivers:\n  file_log/logplatform-prometheus:\nservice:\n  pipelines:\n    logs/logplatform-prometheus:\n',
    },
  );

  assert.equal(request.path, '/api/v1/logs/routes/route-001/collector-config');
  assert.equal(request.init.method, undefined);
  assert.equal(result.routeId, 'route-001');
  assert.equal(result.collectorConfigHash, 'collector-hash-001');
  assert.equal(result.deploymentManifestHash, 'manifest-hash-001');
  assert.equal(result.sourceType, 'k8s_stdout');
  assert.equal(result.collectorYAML.includes('file_log/logplatform-prometheus'), true);
  assert.equal(result.collectorYAML.includes('kind: DaemonSet'), false);
});

test('VM Logs route payload 不携带 K8s 残留配置', async () => {
  const { request } = await captureRequest(
    () => logsApi.previewRoute({
      serviceId: 'svc-vm',
      sourceType: 'vm_file',
      agentGroupId: '',
      endpointId: 'sink-vm',
      k8s: {
        clusterId: 'test03',
        namespace: 'logplatform',
      },
      vm: {
        hostGroup: 'billing-vms',
        pathPattern: '/data/logs/*.log',
        collectorYAML: 'receivers:\n  file_log/vm:\n',
      },
    }),
    {
      source: { id: 'src-vm', source_type: 'vm_file', host_group: 'billing-vms' },
      endpoint: { id: 'sink-vm', name: 'vl-vm' },
      agent_yaml: '',
      collector_config_hash: 'vm123',
      mode: 'preview',
      publish_blocked: false,
      warnings: [],
    },
  );

  assert.equal(request.body.source_type, 'vm_file');
  assert.equal(request.body.vm.collector_yaml, 'receivers:\n  file_log/vm:\n');
  assert.equal(request.body.vm.host_group, 'billing-vms');
  assert.equal(request.body.k8s.collector_yaml, undefined);
  assert.equal(request.body.k8s.cluster_id, undefined);
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
      resources: [
        { cluster_id: 'test03', api_version: 'v1', kind: 'Namespace', name: 'novaobs-system' },
        { cluster_id: 'test03', namespace: 'novaobs-system', api_version: 'apps/v1', kind: 'DaemonSet', name: 'novaobs-logs-agent' },
      ],
      diffs: [
        { cluster_id: 'test03', api_version: 'v1', kind: 'Namespace', name: 'novaobs-system', operation: 'apply', after_hash: 'hash-ns' },
        { cluster_id: 'test03', namespace: 'novaobs-system', api_version: 'apps/v1', kind: 'DaemonSet', name: 'novaobs-logs-agent', operation: 'apply', after_hash: 'hash-ds' },
      ],
      warnings: [],
      plan: {
        id: 'plan-001',
        route_id: 'route-001',
        agent_group_id: 'ag-001',
        source_type: 'k8s_stdout',
        collector_config_hash: 'collector-abc123',
        deployment_manifest_hash: 'manifest-abc123',
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
  assert.equal(result.plan?.collectorConfigHash, 'collector-abc123');
  assert.equal(result.plan?.deploymentManifestHash, 'manifest-abc123');
  assert.equal(result.resources[0].kind, 'Namespace');
  assert.equal(result.resources[1].namespace, 'novaobs-system');
  assert.equal(result.diffs[1].operation, 'apply');
  assert.equal(result.diffs[1].afterHash, 'hash-ds');
});
