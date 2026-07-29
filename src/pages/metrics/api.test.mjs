import test from 'node:test';
import assert from 'node:assert/strict';
import { metricsApi } from './api.ts';

function response(data) {
  return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ success: true, data, error: null, meta: {} }) };
}

test('Metrics Integration API 只使用产品级资源契约', async () => {
  const requests = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init });
    return response({ integration: { id: 'integration-1', product_id: 'product-commerce', destination_ref: 'vm-prod', desired_state: 'connected', identity_label_key: 'novaapm_product_id' }, source_accesses: [{ id: 'source-1', integration_id: 'integration-1', resource_kind: 'k8s_cluster', resource_ref: 'cluster-prod', source_kind: 'kubernetes_infra', collection_mode: 'external_collector', desired_state: 'connected' }] });
  };
  try {
    const created = await metricsApi.createIntegration({ productId: 'product-commerce', destinationRef: 'vm-prod' });
    assert.equal(requests[0].path, '/api/v1/metrics/integrations');
    assert.deepEqual(JSON.parse(requests[0].init.body), { product_id: 'product-commerce', destination_ref: 'vm-prod' });
    assert.equal(created.integration.identityLabelKey, 'novaapm_product_id');
    assert.equal(created.sourceAccesses[0].resourceRef, 'cluster-prod');
    assert.equal(created.sourceAccesses[0].sourceKind, 'kubernetes_infra');
  } finally { globalThis.fetch = original; }
});

test('采集方式属于来源而不是产品接入', async () => {
  const requests = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => { requests.push({ path, init }); return response({ id: 'source-1', integration_id: 'integration-1', source_kind: 'host_infra', collection_mode: 'managed_collector', desired_state: 'connected' }); };
  try {
    const source = await metricsApi.updateSourceAccess('source-1', { collectionMode: 'managed_collector' });
    assert.equal(requests[0].path, '/api/v1/metrics/source-accesses/source-1');
    assert.equal(requests[0].init.method, 'PATCH');
    assert.equal(source.collectionMode, 'managed_collector');
  } finally { globalThis.fetch = original; }
});

test('产品接入支持调整目标、断开和直接登记资源来源', async () => {
  const requests = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init });
    if (String(path).endsWith('/sources')) {
      return response({ id: 'source-1', integration_id: 'integration-1', resource_kind: 'host_group', resource_ref: 'hosts-prod', source_kind: 'host_infra', collection_mode: 'external_collector', desired_state: 'connected' });
    }
    return response({ integration: { id: 'integration-1', product_id: 'product-commerce', destination_ref: 'vm-next', desired_state: 'disconnected' }, source_accesses: [], collector_releases: [] });
  };
  try {
    await metricsApi.updateIntegration('integration-1', { destinationRef: 'vm-next', desiredState: 'disconnected' });
    await metricsApi.createSourceAccess('integration-1', { resourceKind: 'host_group', resourceRef: 'hosts-prod' });
    assert.equal(requests[0].path, '/api/v1/metrics/integrations/integration-1');
    assert.equal(requests[0].init.method, 'PATCH');
    assert.deepEqual(JSON.parse(requests[0].init.body), { destination_ref: 'vm-next', desired_state: 'disconnected' });
    assert.equal(requests[1].path, '/api/v1/metrics/integrations/integration-1/sources');
    assert.equal(requests[1].init.method, 'POST');
    assert.deepEqual(JSON.parse(requests[1].init.body), { resource_kind: 'host_group', resource_ref: 'hosts-prod' });
  } finally { globalThis.fetch = original; }
});

test('Dashboard 必须按产品读取并映射隔离不可用状态', async () => {
  const original = globalThis.fetch;
  let requestPath = '';
  globalThis.fetch = async (path) => {
    requestPath = String(path);
    return response({
      state: 'isolation_unavailable',
      embed_url: '',
      unavailable_reason: '共享 Grafana 无法可靠隔离 Product',
      updated_at: '2026-07-22T10:00:00Z',
    });
  };
  try {
    const dashboard = await metricsApi.getDashboard('product-commerce');
    assert.equal(requestPath, '/api/v1/products/product-commerce/metrics/dashboard');
    assert.equal(dashboard.state, 'isolation_unavailable');
    assert.equal(dashboard.embedURL, '');
    assert.equal(dashboard.unavailableReason, '共享 Grafana 无法可靠隔离 Product');
    assert.equal(dashboard.updatedAt, '2026-07-22T10:00:00Z');
  } finally { globalThis.fetch = original; }
});

test('外部采集器交付物按来源读取', async () => {
  const requests = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (path) => { requests.push(path); return response({ source_access_id: 'source-1', product_id: 'product-commerce', resource_ref: 'cluster-prod', destination_ref: 'vm-prod', artifacts: [{ kind: 'vmoperator_patch', content: 'spec: {}', note: 'merge' }] }); };
  try {
    const handoff = await metricsApi.getSourceHandoff('source-1');
    assert.equal(requests[0], '/api/v1/metrics/source-accesses/source-1/handoff');
    assert.equal(handoff.productId, 'product-commerce');
    assert.equal(handoff.artifacts[0].kind, 'vmoperator_patch');
  } finally { globalThis.fetch = original; }
});

test('Overview 只消费持久化的四层健康快照', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => response([{ integration: { id: 'integration-1', product_id: 'product-commerce' }, source_accesses: [], latest_snapshot: { id: 'snapshot-1', product_id: 'product-commerce', configuration: { status: 'healthy' }, destination: { status: 'healthy' }, data_flow: { status: 'degraded' }, sources: [] } }]);
  try {
    const items = await metricsApi.listOverview();
    assert.equal(items[0].latestSnapshot.id, 'snapshot-1');
    assert.equal(items[0].latestSnapshot.dataFlow.status, 'degraded');
  } finally { globalThis.fetch = original; }
});

test('受管 vmagent 必须先预览再应用', async () => {
  const requests = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => { requests.push({ path, init }); return response({ id: 'release-1', source_access_id: 'source-1', generation: 1, cluster_id: 'cluster-prod', namespace: 'novaapm-system', status: path.endsWith('/apply') ? 'applied' : 'previewed', resources: [] }); };
  try {
    await metricsApi.previewManagedCollector('source-1');
    await metricsApi.applyManagedCollector('source-1');
    assert.equal(requests[0].path, '/api/v1/metrics/source-accesses/source-1/managed-release/preview');
    assert.equal(requests[1].path, '/api/v1/metrics/source-accesses/source-1/managed-release/apply');
    assert.equal(requests[0].init.method, 'POST');
  } finally { globalThis.fetch = original; }
});

test('来源检测给出复用或受管推荐而不自动改配置', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => response({ source_access_id: 'source-1', resource_ref: 'cluster-prod', status: 'healthy', detected_collector: 'vmagent', detected_signals: ['node-exporter'], recommended_mode: 'external_collector', message: '复用现有采集器' });
  try {
    const assessment = await metricsApi.assessSource('source-1');
    assert.equal(assessment.detectedCollector, 'vmagent');
    assert.equal(assessment.recommendedMode, 'external_collector');
  } finally { globalThis.fetch = original; }
});

test('Logs-to-Metrics 作为产品来源接入同一 Integration', async () => {
  const original = globalThis.fetch;
  let requestPath = '';
  globalThis.fetch = async (path) => { requestPath = path; return response({ id: 'source-log', integration_id: 'integration-1', source_kind: 'log_derived', collection_mode: 'external_collector', desired_state: 'connected' }); };
  try {
    const source = await metricsApi.enableLogDerivedSource('integration-1');
    assert.equal(requestPath, '/api/v1/metrics/integrations/integration-1/log-derived-source');
    assert.equal(source.sourceKind, 'log_derived');
  } finally { globalThis.fetch = original; }
});
