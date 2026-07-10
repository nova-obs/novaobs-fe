import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildVictoriaMetricsVMUIURL, metricsApi } from './api.ts';

const apiSource = readFileSync(new URL('./api.ts', import.meta.url), 'utf8');

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

test('VictoriaMetrics VMUI 默认加载当前服务的 basePromQL', () => {
	assert.equal(
		buildVictoriaMetricsVMUIURL('http://vmselect:8481/select/0:9528/vmui/', '{service_name="orders-api"}'),
		'http://vmselect:8481/select/0:9528/vmui/#/?g0.expr=%7Bservice_name%3D%22orders-api%22%7D',
	);
});

test('Metrics API 只通过统一 apiRequest 访问后端', () => {
  assert.match(apiSource, /import \{ apiRequest \} from '..\/..\/services\/api'/);
  assert.doesNotMatch(apiSource, /\bfetch\(/);
  assert.doesNotMatch(apiSource, /\/api\/v1\/metrics/);
});

test('获取 Metrics 工作台时映射服务、端点和服务绑定', async () => {
  const { request, result } = await captureRequest(
	() => metricsApi.getWorkspace('product-001', 'svc-001'),
    {
      services: [{ id: 'svc-001', name: 'order-api', display_name: '订单 API', owner_team: 'payments', sync_status: 'synced' }],
      endpoints: [{
        id: 'vm-001',
        name: 'vm-prod',
        endpoint_type: 'victoriametrics',
        remote_write_url: 'http://vm/insert/0/prometheus/api/v1/write',
        query_url: 'http://vm/select/0/prometheus',
        vmui_url: 'http://vm/select/0/vmui',
        account_id: '0',
        project_id: '0',
        scope_type: 'k8s_cluster',
        cluster_id: 'test03',
        status: 'active',
        updated_at: '2026-07-05T10:00:00Z',
      }],
      service_bindings: [{
        id: 'binding-001',
        service_id: 'svc-001',
        endpoint_id: 'vm-001',
        tenant: { account_id: '10', project_id: '11' },
        label_match: { service: 'order-api', namespace: 'prod' },
        base_promql: 'up{job="orders"}',
        status: 'active',
        last_probe_status: 'healthy',
        last_probe_message: 'ok',
        last_probe_at: '2026-07-05T10:01:00Z',
        updated_at: '2026-07-05T10:02:00Z',
      }],
    },
  );

	assert.equal(request.path, '/api/v1/products/product-001/services/svc-001/metrics/workspace');
  assert.equal(request.init.method, undefined);
  assert.equal(result.services[0].displayName, '订单 API');
  assert.equal(result.services[0].ownerTeam, 'payments');
  assert.equal(result.endpoints[0].endpointType, 'victoriametrics');
  assert.equal(result.endpoints[0].remoteWriteURL, 'http://vm/insert/0/prometheus/api/v1/write');
  assert.equal(result.endpoints[0].scopeType, 'k8s_cluster');
  assert.equal(result.serviceBindings[0].serviceId, 'svc-001');
  assert.equal(result.serviceBindings[0].accountId, '10');
  assert.equal(result.serviceBindings[0].projectId, '11');
  assert.equal(result.serviceBindings[0].basePromQL, 'up{job="orders"}');
  assert.equal(result.serviceBindings[0].labelMatch.namespace, 'prod');
  assert.equal(result.serviceBindings[0].lastProbeStatus, 'healthy');
});

test('Metrics 工作台兼容后端服务作用域、单个 binding 视图和嵌套端点字段', async () => {
  const { request, result } = await captureRequest(
	() => metricsApi.getWorkspace('product-001', 'svc-001'),
    {
      active_service_id: 'svc-001',
      services: [{ id: 'svc-001', name: 'order-api', display_name: '订单 API' }],
      endpoints: [{
        id: 'vm-prod',
        name: 'vm-prod',
        kind: 'victoriametrics',
        urls: {
          remote_write_url: 'http://vm/insert/0/prometheus/api/v1/write',
          query_url: 'http://vm/select/0/prometheus',
          ui_url: 'http://vm/select/0/vmui',
        },
        tenant: { account_id: '0', project_id: '1' },
        scope: { type: 'k8s_cluster', cluster_id: 'prod-1' },
        status: 'active',
      }],
      binding: {
        binding: {
          id: 'binding-001',
          service_id: 'svc-001',
          endpoint_id: 'vm-prod',
          tenant: { account_id: '9', project_id: '8' },
          label_match: { 'service.name': 'orders-api' },
          base_promql: '{service_name="orders-api"}',
          status: 'active',
          last_probe_status: 'verified',
        },
      },
    },
  );

	assert.equal(request.path, '/api/v1/products/product-001/services/svc-001/metrics/workspace');
  assert.equal(result.activeServiceId, 'svc-001');
  assert.equal(result.endpoints[0].endpointType, 'victoriametrics');
  assert.equal(result.endpoints[0].queryURL, 'http://vm/select/0/prometheus');
  assert.equal(result.endpoints[0].vmuiURL, 'http://vm/select/0/vmui');
  assert.equal(result.endpoints[0].accountId, '0');
  assert.equal(result.endpoints[0].scopeType, 'k8s_cluster');
  assert.equal(result.serviceBindings[0].endpointId, 'vm-prod');
  assert.equal(result.serviceBindings[0].accountId, '9');
  assert.equal(result.serviceBindings[0].projectId, '8');
  assert.equal(result.serviceBindings[0].basePromQL, '{service_name="orders-api"}');
  assert.equal(result.serviceBindings[0].labelMatch['service.name'], 'orders-api');
});

test('Metrics mapper 兼容 camelCase 响应字段', async () => {
  const { result } = await captureRequest(
	() => metricsApi.getWorkspace('product-002', 'svc-002'),
    {
      services: [{ id: 'svc-002', name: 'billing', displayName: '计费', ownerTeam: 'finance', syncStatus: 'local' }],
      endpoints: [{
        id: 'vm-002',
        name: 'vm-dev',
        endpointType: 'victoriametrics',
        remoteWriteURL: 'http://vm/write',
        queryURL: 'http://vm/select',
        vmuiURL: 'http://vm/vmui',
        accountId: '10',
        projectId: '20',
        scopeType: 'global',
        clusterId: '',
        status: 'active',
        updatedAt: '2026-07-05T11:00:00Z',
      }],
      serviceBindings: [{
        id: 'binding-002',
        serviceId: 'svc-002',
        endpointId: 'vm-002',
        accountId: '30',
        projectId: '40',
        labelMatch: { job: 'billing' },
        basePromQL: 'rate(http_requests_total[5m])',
        status: 'pending_verification',
        lastProbeStatus: 'unknown',
        lastProbeMessage: '',
        lastProbeAt: '',
        updatedAt: '2026-07-05T11:02:00Z',
      }],
    },
  );

  assert.equal(result.services[0].displayName, '计费');
  assert.equal(result.endpoints[0].queryURL, 'http://vm/select');
  assert.equal(result.endpoints[0].accountId, '10');
  assert.equal(result.serviceBindings[0].labelMatch.job, 'billing');
  assert.equal(result.serviceBindings[0].accountId, '30');
  assert.equal(result.serviceBindings[0].projectId, '40');
  assert.equal(result.serviceBindings[0].basePromQL, 'rate(http_requests_total[5m])');
  assert.equal(result.serviceBindings[0].status, 'pending_verification');
});

test('Metrics 端点与服务绑定列表使用独立资源接口', async () => {
  const endpoints = await captureRequest(
    () => metricsApi.listEndpoints(),
    [{ id: 'vm-001', name: 'vm-prod', kind: 'victoriametrics', health: { status: 'healthy', message: 'VictoriaMetrics 查询端点连通', response_time_ms: 8 } }],
  );
  const bindings = await captureRequest(
	() => metricsApi.listServiceBindings('product-001', 'svc-001'),
    [{ id: 'binding-001', service_id: 'svc-001', endpoint_id: 'vm-001', label_match: { service: 'order-api' } }],
  );

  assert.equal(endpoints.request.path, '/api/v1/observability/endpoints?signal_type=metrics&kind=victoriametrics');
  assert.equal(endpoints.result[0].endpointType, 'victoriametrics');
	assert.equal(endpoints.result[0].healthStatus, 'healthy');
	assert.equal(endpoints.result[0].healthResponseTimeMs, 8);
	assert.equal(bindings.request.path, '/api/v1/products/product-001/services/svc-001/metrics/bindings');
  assert.equal(bindings.result[0].serviceId, 'svc-001');
});

test('Metrics 通过统一观测端点 API 登记和更新 VMS 且不提交业务租户', async () => {
	const input = {
		name: 'vm-prod',
		description: '生产 VMS',
		remoteWriteURL: 'http://vminsert:8480/insert/0/prometheus/api/v1/write',
		queryURL: 'http://vmselect:8481/select/0/prometheus',
		vmuiURL: 'http://vmselect:8481/select/0/vmui/',
		scopeType: 'global',
		clusterId: '',
		status: 'active',
	};
	const created = await captureRequest(
		() => metricsApi.createEndpoint(input),
		{ id: 'vm-prod', name: 'vm-prod', kind: 'victoriametrics', signal_types: ['metrics'], urls: { remote_write_url: input.remoteWriteURL, query_url: input.queryURL, ui_url: input.vmuiURL }, scope: { type: 'global' }, status: 'active' },
	);

	assert.equal(created.request.path, '/api/v1/observability/endpoints');
	assert.equal(created.request.init.method, 'POST');
	assert.equal(created.request.body.kind, 'victoriametrics');
	assert.deepEqual(created.request.body.signal_types, ['metrics']);
	assert.equal(created.request.body.scope.type, 'global');
	assert.equal(created.request.body.urls.remote_write_url, input.remoteWriteURL);
	assert.equal(created.request.body.tenant, undefined);

	const updated = await captureRequest(
		() => metricsApi.updateEndpoint('vm-prod', { ...input, name: 'vm-prod-2', scopeType: 'k8s_cluster', clusterId: 'prod-1' }),
		{ id: 'vm-prod', name: 'vm-prod-2', kind: 'victoriametrics', signal_types: ['metrics'], urls: { remote_write_url: input.remoteWriteURL, query_url: input.queryURL, ui_url: input.vmuiURL }, scope: { type: 'k8s_cluster', cluster_id: 'prod-1' }, status: 'active' },
	);
	assert.equal(updated.request.path, '/api/v1/observability/endpoints/vm-prod');
	assert.equal(updated.request.init.method, 'PATCH');
	assert.equal(updated.request.body.name, 'vm-prod-2');
	assert.deepEqual(updated.request.body.scope, { type: 'k8s_cluster', cluster_id: 'prod-1' });
});

test('Metrics 工作台映射托管采集路由', async () => {
  const { result } = await captureRequest(
    () => metricsApi.getWorkspace('product-001', 'svc-001'),
    {
      services: [{ id: 'svc-001', product_id: 'product-001', account_id: '0', project_id: '9528', name: 'orders-api' }],
      endpoints: [{ id: 'vm-prod', kind: 'victoriametrics', urls: { ui_url: 'http://vmselect/select/0:9528/vmui/' } }],
      routes: [{
        route: {
          id: 'route-001', service_id: 'svc-001', endpoint_id: 'vm-prod', source_kind: 'k8s_service',
          cluster_id: 'prod-1', namespace: 'orders', k8s_service_name: 'orders-api', port: 'metrics',
          scheme: 'http', metrics_path: '/metrics', scrape_interval: '30s', scrape_timeout: '10s',
          base_promql: '{service_name="orders-api"}', status: 'active', last_publish_status: 'applied',
        },
        runtime_id: 'metrics-collector:prod-1:novaapm-system:product-001:vm-prod',
      }],
    },
  );

  assert.equal(result.routes[0].id, 'route-001');
  assert.equal(result.routes[0].k8sServiceName, 'orders-api');
  assert.equal(result.routes[0].lastPublishStatus, 'applied');
  assert.equal(result.routes[0].runtimeId, 'metrics-collector:prod-1:novaapm-system:product-001:vm-prod');
});

test('Metrics 采集路由使用服务嵌套 API 创建、更新和查询', async () => {
  const input = {
    productId: 'product-001', serviceId: 'svc-001', name: 'orders metrics', endpointId: 'vm-prod',
    clusterId: 'prod-1', namespace: 'orders', k8sServiceName: 'orders-api', port: 'metrics',
    scheme: 'http', metricsPath: '/metrics', scrapeInterval: '30s', scrapeTimeout: '10s',
  };
  const created = await captureRequest(
    () => metricsApi.createRoute(input),
    { route: { id: 'route-001', service_id: 'svc-001', k8s_service_name: 'orders-api' } },
  );
  assert.equal(created.request.path, '/api/v1/products/product-001/services/svc-001/metrics/routes');
  assert.equal(created.request.init.method, 'POST');
  assert.equal(created.request.body.k8s_service_name, 'orders-api');
  assert.equal(created.request.body.account_id, undefined);
  assert.equal(created.request.body.project_id, undefined);

  const updated = await captureRequest(
    () => metricsApi.updateRoute('product-001', 'svc-001', 'route-001', { scrapeInterval: '45s' }),
    { route: { id: 'route-001', scrape_interval: '45s' } },
  );
  assert.equal(updated.request.init.method, 'PATCH');
  assert.equal(updated.request.body.scrape_interval, '45s');

  const listed = await captureRequest(
    () => metricsApi.listRoutes('product-001', 'svc-001'),
    [{ route: { id: 'route-001' } }],
  );
  assert.equal(listed.request.path, '/api/v1/products/product-001/services/svc-001/metrics/routes');
});

test('Metrics vmagent 运行时使用预览确认发布 API', async () => {
  const preview = await captureRequest(
    () => metricsApi.publishCollectorRuntime({ routeId: 'route-001', namespace: 'novaapm-system' }),
    { status: 'previewed', requires_confirmation: true, preview_id: 'preview-1', confirmation_token: 'confirm-1', manifest_yaml: 'kind: Deployment' },
  );
  assert.equal(preview.request.path, '/api/v1/observability/runtimes/metrics-collector/publish');
  assert.equal(preview.request.init.method, 'POST');
  assert.equal(preview.request.body.route_id, 'route-001');
  assert.equal(preview.result.requiresConfirmation, true);

  const status = await captureRequest(
    () => metricsApi.getCollectorRuntimeStatus({ routeId: 'route-001', namespace: 'novaapm-system' }),
    { runtime_id: 'metrics-collector:prod-1:novaapm-system:product-001:vm-prod', status: 'ready', ready: true, resources: [] },
  );
  assert.match(status.request.path, /\/api\/v1\/observability\/runtimes\/metrics-collector\/status\?/);
  assert.match(status.request.path, /route_id=route-001/);
  assert.equal(status.result.ready, true);
});
