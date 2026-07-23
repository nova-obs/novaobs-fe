import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVictoriaLogsVMUIURL, defaultLogsCollectorNamespace, logSourceLabel, logsApi, normalizeLogsCollectorNamespace } from './api.ts';

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
	() => logsApi.getWorkspace('product-001', 'svc-001'),
    {
      services: [{ id: 'svc-001', name: 'order-api' }],
      collector_groups: [{ id: 'ag-001', name: 'prod-ds', mode: 'daemonset', online_instances: 2 }],
      clusters: [{ id: 'test03', name: 'test03', version: 'v1.28.3', access_mode: 'direct/ro', read_only: true }],
      endpoints: [{ id: 'vl-001', name: 'vl-prod', sink_type: 'vl', stream_name: '', write_url: 'http://vl/insert', vmui_url: 'http://vl/select/vmui', account_id: '9527', project_id: '9527', scope_type: 'k8s_cluster', cluster_id: 'test03' }],
      routes: [],
      targets: [{
        target: { id: 'target-001', name: 'orders 自建 VL', service_id: 'svc-001', endpoint_id: 'vl-001', source_kind: 'external_vlogs', base_filter: '"stream":"orders"', status: 'verified' },
        service: { id: 'svc-001', name: 'order-api' },
        endpoint: { id: 'vl-001', name: 'vl-prod', sink_type: 'vl', query_url: 'http://vl/select/logsql/query', vmui_url: 'http://vl/select/vmui', account_id: '9527', project_id: '9527' },
      }],
    },
  );

	assert.equal(request.path, '/api/v1/products/product-001/services/svc-001/logs/workspace');
  assert.equal(request.init.method, undefined);
  assert.equal(result.services[0].id, 'svc-001');
  assert.equal(result.clusters[0].readOnly, true);
  assert.equal(result.endpoints[0].vmuiURL, 'http://vl/select/vmui');
  assert.equal(result.endpoints[0].sinkType, 'vl');
  assert.equal(result.endpoints[0].scopeType, 'k8s_cluster');
  assert.equal(result.endpoints[0].clusterId, 'test03');
  assert.equal(result.endpoints[0].accountId, '9527');
  assert.equal(result.endpoints[0].projectId, '9527');
  assert.equal(result.targets[0].target.baseFilter, '"stream":"orders"');
  assert.equal(result.targets[0].endpoint.accountId, '9527');
});

test('登记服务外部 VictoriaLogs 日志链路时调用内部 targets 接口', async () => {
  const { request, result } = await captureRequest(
    () => logsApi.createTarget({ name: 'orders 自建 VL', serviceId: 'svc-001', endpointId: 'vl-001', baseFilter: '"stream":"orders"', accountId: '1001', projectId: '2001' }),
    { target: { id: 'target-001', name: 'orders 自建 VL', service_id: 'svc-001', endpoint_id: 'vl-001', source_kind: 'external_vlogs', base_filter: '"stream":"orders"', account_id: '1001', project_id: '2001', status: 'pending_verification' } },
  );

  assert.equal(request.path, '/api/v1/logs/targets');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.body.service_id, 'svc-001');
  assert.equal(request.body.endpoint_id, 'vl-001');
  assert.equal(request.body.source_kind, 'external_vlogs');
  assert.equal(request.body.base_filter, '"stream":"orders"');
  assert.equal(request.body.account_id, '1001');
  assert.equal(request.body.project_id, '2001');
  assert.equal(result.target.id, 'target-001');
  assert.equal(result.target.accountId, '1001');
  assert.equal(result.target.projectId, '2001');
});

test('VictoriaLogs VMUI 地址固定到产品租户和服务过滤条件', () => {
  assert.equal(
    buildVictoriaLogsVMUIURL({
      vmuiURL: 'http://vl:9428/select/vmui/#/?query=error',
      sinkType: 'vl',
      accountId: '9527',
      projectId: '9527',
	}, '"service.name":="orders-api"'),
	'http://vl:9428/select/vmui/#/?query=%22service.name%22%3A%3D%22orders-api%22+AND+%28error%29&accountID=9527&projectID=9527',
  );
  assert.equal(
    buildVictoriaLogsVMUIURL({
      vmuiURL: 'http://vmauth:8427/customer/logs/select/vmui/',
      sinkType: 'vl',
      accountId: '9527',
      projectId: '9527',
	}, '"service.name":="orders-api"'),
	'http://vmauth:8427/customer/logs/select/vmui/#/?query=%22service.name%22%3A%3D%22orders-api%22&accountID=9527&projectID=9527',
  );
});

test('获取 Logs 接入工作台时保留已登记路由草稿配置', async () => {
  const { result } = await captureRequest(
	() => logsApi.getWorkspace('product-001', 'svc-001'),
    {
      services: [{ id: 'svc-001', name: 'order-api', identity_type: 'k8s_workload' }],
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
          agent_namespace: 'novaapm-system',
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
  assert.equal(result.routes[0].source?.agentNamespace, 'novaapm-system');
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
      streamName: 'novaapm-logs',
      writeURL: 'kafka-0:9092,kafka-1:9092',
      scopeType: 'vm',
      status: 'disabled',
    }),
    {
      id: 'sink-001',
      name: 'kafka-prod',
      sink_type: 'kafka',
      stream_name: 'novaapm-logs',
      write_url: 'kafka-0:9092,kafka-1:9092',
      scope_type: 'vm',
    },
  );

  assert.equal(request.path, '/api/v1/logs/endpoints');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.body.sink_type, 'kafka');
  assert.equal(request.body.stream_name, 'novaapm-logs');
  assert.equal(request.body.write_url, 'kafka-0:9092,kafka-1:9092');
  assert.equal(request.body.status, 'disabled');
  assert.equal(result.sinkType, 'kafka');
  assert.equal(result.streamName, 'novaapm-logs');
});

test('创建 OTel 下游端点时传递 OTLP HTTP 写入地址', async () => {
  const { request, result } = await captureRequest(
    () => logsApi.createEndpoint({
      name: 'otel-prod',
      sinkType: 'otel',
      writeURL: 'http://otel-gateway:4318/v1/logs',
      scopeType: 'vm',
    }),
    {
      id: 'sink-otel',
      name: 'otel-prod',
      sink_type: 'otel',
      write_url: 'http://otel-gateway:4318/v1/logs',
      scope_type: 'vm',
    },
  );

  assert.equal(request.body.sink_type, 'otel');
  assert.equal(request.body.write_url, 'http://otel-gateway:4318/v1/logs');
  assert.equal(result.sinkType, 'otel');
});

test('创建 VictoriaLogs 端点时不传递产品租户和凭据', async () => {
  const { request, result } = await captureRequest(
    () => logsApi.createEndpoint({
      name: 'vl-tenant-9527',
      sinkType: 'vl',
      writeURL: 'http://vl:9428/insert/opentelemetry/v1/logs',
      queryURL: 'http://vl:9428/select/logsql/query',
      vmuiURL: 'http://vl:9428/select/vmui/',
      accountId: '9527',
      projectId: '9527',
      secretRef: 'secret://logs/vl-prod',
    }),
    { id: 'vl-9527', name: 'vl-tenant-9527', sink_type: 'vl' },
  );

  assert.equal('account_id' in request.body, false);
  assert.equal('project_id' in request.body, false);
  assert.equal('secret_ref' in request.body, false);
  assert.equal('alertmanager_url' in request.body, false);
  assert.equal(result.accountId, '');
  assert.equal(result.projectId, '');
});

test('日志下游端点列表返回 null 时按空列表处理', async () => {
  const { request, result } = await captureRequest(
    () => logsApi.listEndpoints(),
    null,
  );

  assert.equal(request.path, '/api/v1/logs/endpoints');
  assert.deepEqual(result, []);
});

test('查询 logs_collector 运行时状态时映射真实集群资源状态', async () => {
  const { request, result } = await captureRequest(
    () => logsApi.getLogsCollectorRuntimeStatus({ clusterId: 'test03', namespace: 'novaapm-system' }),
    {
      cluster_id: 'test03',
      namespace: 'novaapm-system',
      ready: false,
      status: 'missing_resources',
      message: 'logs_collector 基础组件缺失：DaemonSet/novaapm-system/novaapm-logs-agent。请到 K8s / 观测接入重新部署。',
      resources: [
        { cluster_id: 'test03', namespace: 'novaapm-system', api_version: 'apps/v1', kind: 'DaemonSet', name: 'novaapm-logs-agent', required: true, exists: false },
      ],
      missing_resources: [
        { cluster_id: 'test03', namespace: 'novaapm-system', api_version: 'apps/v1', kind: 'DaemonSet', name: 'novaapm-logs-agent', required: true, exists: false },
      ],
    },
  );

  assert.equal(request.path, '/api/v1/observability/runtimes/logs-collector/status?cluster_id=test03&namespace=novaapm-system');
  assert.equal(result.ready, false);
  assert.equal(result.status, 'missing_resources');
  assert.equal(result.missingResources[0].kind, 'DaemonSet');
  assert.equal(result.missingResources[0].exists, false);
});

test('logs_collector 运行时状态查询会迁移旧默认 namespace', async () => {
  const legacyNamespace = 'novaobs-system';
  const { request, result } = await captureRequest(
    () => logsApi.getLogsCollectorRuntimeStatus({ clusterId: 'test03', namespace: legacyNamespace }),
    {
      cluster_id: 'test03',
      namespace: legacyNamespace,
      ready: false,
      status: 'missing_resources',
      message: 'logs_collector 基础组件缺失：DaemonSet/novaapm-system/novaapm-logs-agent。请到 K8s / 观测接入重新部署。',
      resources: [
        { cluster_id: 'test03', namespace: legacyNamespace, api_version: 'apps/v1', kind: 'DaemonSet', name: 'novaapm-logs-agent', required: true, exists: false },
      ],
      missing_resources: [
        { cluster_id: 'test03', namespace: legacyNamespace, api_version: 'apps/v1', kind: 'DaemonSet', name: 'novaapm-logs-agent', required: true, exists: false },
      ],
    },
  );

  assert.equal(normalizeLogsCollectorNamespace(legacyNamespace), defaultLogsCollectorNamespace);
  assert.equal(request.path, '/api/v1/observability/runtimes/logs-collector/status?cluster_id=test03&namespace=novaapm-system');
  assert.equal(result.namespace, defaultLogsCollectorNamespace);
  assert.equal(result.missingResources[0].namespace, defaultLogsCollectorNamespace);
});

test('发布端点 vmalert Runtime 时使用端点级接口和确认 token', async () => {
  const { request, result } = await captureRequest(
    () => logsApi.publishEndpointVmalertRuntime('vl-9527', {
      deployClusterId: 'test03',
      namespace: 'novaapm-system',
      alertIngestURL: 'http://novaapm-api:8080',
      previewId: 'preview-1',
      confirmationToken: 'confirm-1',
    }),
    {
      runtime_id: 'vmalert-logs:vl-9527',
      endpoint_id: 'vl-9527',
      deploy_cluster_id: 'test03',
      namespace: 'novaapm-system',
      datasource_url: 'http://victorialogs:9428',
      alert_ingest_url: 'http://novaapm-api:8080',
      artifact_hash: 'artifact-hash',
      manifest_hash: 'manifest-hash',
      manifest_yaml: 'apiVersion: apps/v1\nkind: Deployment\n',
      status: 'applied',
      message: 'applied',
      requires_confirmation: false,
      preview_id: 'preview-1',
      audit_id: 'audit-1',
      applied_rules: 2,
      resources: [{ cluster_id: 'test03', namespace: 'novaapm-system', api_version: 'apps/v1', kind: 'Deployment', name: 'novaapm-vmalert-vl' }],
      diffs: [],
      warnings: [],
    },
  );

  assert.equal(request.path, '/api/v1/logs/endpoints/vl-9527/vmalert-runtime/publish');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.body.deploy_cluster_id, 'test03');
  assert.equal(request.body.namespace, 'novaapm-system');
  assert.equal(request.body.alert_ingest_url, 'http://novaapm-api:8080');
  assert.equal(request.body.preview_id, 'preview-1');
  assert.equal(request.body.confirmation_token, 'confirm-1');
  assert.equal(result.runtimeId, 'vmalert-logs:vl-9527');
  assert.equal(result.deployClusterId, 'test03');
  assert.equal(result.alertIngestURL, 'http://novaapm-api:8080');
  assert.equal(result.status, 'applied');
  assert.equal(result.appliedRules, 2);
  assert.equal(result.resources[0].kind, 'Deployment');
});

test('确认 K8s logs_collector Runtime 时只提交不可变预览凭据', async () => {
  const { request, result } = await captureRequest(
    () => logsApi.confirmLogsCollectorRuntime({
      previewId: 'preview-001',
      confirmationToken: 'token-001',
    }),
    {
      runtime: { id: 'logs-collector:test03:novaapm-system', kind: 'logs_collector', status: 'ready' },
      task_type: 'incremental',
      status: 'applied',
      message: '已发布',
      requires_confirmation: false,
      audit_id: 'audit-001',
      changed_config_maps: ['novaapm-logs-agent-svc-orders-api-route-001'],
      collector_config_files: {
        'base.yaml': 'receivers: {}\n',
        'services/orders-api/fragment.yaml': 'receivers:\n  file_log/orders-api:\n',
      },
      resources: [
        { cluster_id: 'test03', api_version: 'v1', kind: 'Namespace', name: 'novaapm-system' },
        { cluster_id: 'test03', namespace: 'novaapm-system', api_version: 'apps/v1', kind: 'DaemonSet', name: 'novaapm-logs-agent' },
      ],
      diffs: [],
      warnings: [],
    },
  );

  assert.equal(request.path, '/api/v1/observability/runtimes/logs-collector/publish');
  assert.equal(request.init.method, 'POST');
  assert.deepEqual(Object.keys(request.body).sort(), ['confirmation_token', 'preview_id']);
  assert.equal(request.body.preview_id, 'preview-001');
  assert.equal(request.body.confirmation_token, 'token-001');
  assert.equal(result.auditId, 'audit-001');
  assert.equal(result.taskType, 'incremental');
  assert.deepEqual(result.changedConfigMaps, ['novaapm-logs-agent-svc-orders-api-route-001']);
  assert.equal(result.collectorConfigFiles['base.yaml'].includes('receivers'), true);
  assert.equal(result.collectorConfigFiles['services/orders-api/fragment.yaml'].includes('file_log/orders-api'), true);
  assert.equal(result.resources[1].kind, 'DaemonSet');
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
      productId: 'product-orders',
      clusterId: 'test03',
      namespace: 'logplatform',
      ownerTeam: 'sre',
      workloadKind: 'Deployment',
    }),
    {
      total: 1,
      services: [{
        created: true,
        service: { id: 'svc-001', key: 'utrace-api', name: 'utrace-api', source: 'k8s', sync_status: 'synced' },
        workload: { kind: 'Deployment', name: 'utrace-api', namespace: 'logplatform' },
      }],
    },
  );

  assert.equal(request.path, '/api/v1/products/product-orders/logs/onboarding/k8s/sync-services');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.body.cluster_id, 'test03');
  assert.equal(request.body.namespace, 'logplatform');
  assert.equal(result.services[0].service.key, 'utrace-api');
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
        agentNamespace: 'novaapm-system',
        workloadKind: 'Deployment',
        workloadName: 'api',
        workloadSelector: { app: 'api' },
        runtimeLogPaths: ['/data/docker/containers'],
        collectorFragmentYAML: 'receivers:\n  file_log/api:\nservice:\n  pipelines:\n    logs/api:\n',
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
      collector_yaml: 'receivers:\n  file_log/api:\n',
      collector_config_files: {
        'base.yaml': 'receivers: {}\n',
        'services/svc-001-route-001/fragment.yaml': 'receivers:\n  file_log/api:\n',
      },
      service_config_path: 'services/svc-001-route-001/fragment.yaml',
      service_config_map_name: 'novaapm-logs-agent-svc-001-route-001',
      service_config_yaml: 'receivers:\n  file_log/api:\n',
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
  assert.equal(request.body.environment_id, undefined);
  assert.equal(request.body.target_id, undefined);
  assert.equal(request.body.route_id, 'route-001');
  assert.equal(request.body.source_type, 'k8s_stdout');
  assert.equal(request.body.agent_group_id, 'ag-001');
  assert.equal(request.body.endpoint_id, '');
  assert.equal(request.body.k8s.cluster_id, 'test03');
  assert.deepEqual(request.body.k8s.workload_selector, { app: 'api' });
  assert.equal(request.body.k8s.runtime_log_paths, undefined);
  assert.equal(request.body.k8s.parse_rules[0].rule_type, 'regex');
  assert.equal(request.body.k8s.collector_fragment_yaml.includes('file_log/api'), true);
  assert.equal(request.body.k8s.collector_yaml, undefined);
  assert.equal(request.body.vm.collector_yaml, undefined);
  assert.equal(request.body.vm.host_group, undefined);
  assert.equal(result.collectorConfigHash, 'collector-abc123');
  assert.equal(result.deploymentManifestHash, 'manifest-abc123');
  assert.equal(result.collectorConfigFiles['base.yaml'].includes('receivers'), true);
  assert.equal(result.serviceConfigPath, 'services/svc-001-route-001/fragment.yaml');
  assert.equal(result.serviceConfigMapName, 'novaapm-logs-agent-svc-001-route-001');
  assert.equal(result.serviceConfigYAML.includes('file_log/api'), true);
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
        agentNamespace: 'novaapm-system',
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

test('查看 Logs route 采集配置 hash 对应服务 ConfigMap 片段', async () => {
  const { request, result } = await captureRequest(
    () => logsApi.getRouteCollectorConfig('route-001'),
    {
      route_id: 'route-001',
      collector_config_hash: 'collector-hash-001',
      deployment_manifest_hash: 'manifest-hash-001',
      source_type: 'k8s_stdout',
      collector_yaml: 'receivers:\n  file_log/logplatform-prometheus:\nservice:\n  pipelines:\n    logs/logplatform-prometheus:\n',
      collector_config_files: {
        'base.yaml': 'receivers: {}\n',
        'services/svc-prometheus-route-001/fragment.yaml': 'receivers:\n  file_log/logplatform-prometheus:\n',
      },
      service_config_path: 'services/svc-prometheus-route-001/fragment.yaml',
      service_config_map_name: 'novaapm-logs-agent-svc-prometheus-route-001',
      service_config_yaml: 'receivers:\n  file_log/logplatform-prometheus:\n',
    },
  );

  assert.equal(request.path, '/api/v1/logs/routes/route-001/collector-config');
  assert.equal(request.init.method, undefined);
  assert.equal(result.routeId, 'route-001');
  assert.equal(result.collectorConfigHash, 'collector-hash-001');
  assert.equal(result.deploymentManifestHash, 'manifest-hash-001');
  assert.equal(result.sourceType, 'k8s_stdout');
  assert.equal(result.collectorConfigFiles['base.yaml'].includes('receivers'), true);
  assert.equal(result.serviceConfigPath, 'services/svc-prometheus-route-001/fragment.yaml');
  assert.equal(result.serviceConfigMapName, 'novaapm-logs-agent-svc-prometheus-route-001');
  assert.equal(result.serviceConfigYAML.includes('file_log/logplatform-prometheus'), true);
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
  assert.equal(request.body.environment_id, undefined);
  assert.equal(request.body.target_id, undefined);
  assert.equal(request.body.vm.collector_yaml, 'receivers:\n  file_log/vm:\n');
  assert.equal(request.body.vm.host_group, 'billing-vms');
  assert.equal('host_selector' in request.body.vm, false);
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

test('发布 VM Logs route 时传递 preview confirmation token', async () => {
  const { request, result } = await captureRequest(
    () => logsApi.publishRoute('route-001', { previewId: 'preview-001', confirmationToken: 'token-001' }),
    {
      status: 'ready_for_agent_sync',
      message: 'VM Agent 配置已生成',
      requires_confirmation: false,
      audit_id: 'audit-001',
      warnings: [],
    },
  );

  assert.equal(request.path, '/api/v1/logs/routes/route-001/publish');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.body.preview_id, 'preview-001');
  assert.equal(request.body.confirmation_token, 'token-001');
  assert.equal(result.auditId, 'audit-001');
  assert.equal('plan' in result, false);
  assert.equal('resources' in result, false);
  assert.equal('diffs' in result, false);
});

test('读取 VM 手工安装材料并映射 snake_case 字段', async () => {
  const { request, result } = await captureRequest(
    () => logsApi.getVMInstallation('route-vm-001'),
    {
      route_id: 'route-vm-001',
      service_id: 'svc-001',
      collector_config_hash: 'sha256:abc',
      collector_yaml: 'receivers: {}',
      install_script: '#!/bin/sh\necho install',
      health_address_example: '10.0.0.8:13133',
      prerequisites: ['Linux', 'root 权限'],
    },
  );

  assert.equal(request.path, '/api/v1/logs/routes/route-vm-001/vm-installation');
  assert.equal(request.init.method, undefined);
  assert.deepEqual(result, {
    routeId: 'route-vm-001',
    serviceId: 'svc-001',
    collectorConfigHash: 'sha256:abc',
    collectorYAML: 'receivers: {}',
    installScript: '#!/bin/sh\necho install',
    healthAddressExample: '10.0.0.8:13133',
    prerequisites: ['Linux', 'root 权限'],
  });
});

test('VM Agent 节点支持列表、登记、校验和删除', async () => {
  const listed = await captureRequest(
    () => logsApi.listVMAgentEndpoints('route-vm-001'),
    [{
      id: 'node-001',
      route_id: 'route-vm-001',
      service_id: 'svc-001',
      name: 'vm-a',
      address: '10.0.0.8:13133',
      status: 'pending_probe',
      last_probe_status: 'unreachable',
      last_probe_message: 'connection refused',
      last_probe_latency_ms: 24,
      last_probe_at: '2026-07-12T08:00:00Z',
    }],
  );
  assert.equal(listed.request.path, '/api/v1/logs/routes/route-vm-001/vm-agent-endpoints');
  assert.deepEqual(listed.result[0], {
    id: 'node-001',
    routeId: 'route-vm-001',
    serviceId: 'svc-001',
    name: 'vm-a',
    address: '10.0.0.8:13133',
    status: 'pending_probe',
    lastProbeStatus: 'unreachable',
    lastProbeMessage: 'connection refused',
    lastProbeLatencyMs: 24,
    lastProbeAt: '2026-07-12T08:00:00Z',
  });

  const created = await captureRequest(
    () => logsApi.createVMAgentEndpoint('route-vm-001', { name: 'vm-b', address: '10.0.0.9:13133' }),
    { id: 'node-002', route_id: 'route-vm-001', service_id: 'svc-001', name: 'vm-b', address: '10.0.0.9:13133', status: 'pending_probe' },
  );
  assert.equal(created.request.init.method, 'POST');
  assert.deepEqual(created.request.body, { name: 'vm-b', address: '10.0.0.9:13133' });

  const probed = await captureRequest(
    () => logsApi.probeVMAgentEndpoint('route-vm-001', 'node-002'),
    { id: 'node-002', route_id: 'route-vm-001', service_id: 'svc-001', name: 'vm-b', address: '10.0.0.9:13133', status: 'reachable', last_probe_status: 'reachable' },
  );
  assert.equal(probed.request.path, '/api/v1/logs/routes/route-vm-001/vm-agent-endpoints/node-002/probe');
  assert.equal(probed.request.init.method, 'POST');
  assert.equal(probed.result.lastProbeStatus, 'reachable');

  const removed = await captureRequest(
    () => logsApi.deleteVMAgentEndpoint('route-vm-001', 'node-002'),
  );
  assert.equal(removed.request.path, '/api/v1/logs/routes/route-vm-001/vm-agent-endpoints/node-002');
  assert.equal(removed.request.init.method, 'DELETE');
});
