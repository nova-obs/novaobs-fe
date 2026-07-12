import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyEndpoint, endpointKindOptions, listEndpointsByDomain } from './ObservabilitySettingsPage.tsx';

function response(data) {
  return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ success: true, data, error: null, meta: {} }) };
}

test('Logs 与指标端点创建类型保持领域隔离', () => {
  assert.equal(createEmptyEndpoint('logs').sinkType, 'vl');
  assert.equal(createEmptyEndpoint('metrics').sinkType, 'vm');
  assert.deepEqual(endpointKindOptions('logs').map((item) => item.value), ['vl', 'otel', 'es', 'kafka']);
  assert.deepEqual(endpointKindOptions('metrics').map((item) => item.value), ['vm']);
});

test('Logs 与指标页面只请求各自的端点 API', async () => {
  const requests = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (path) => {
    requests.push(path);
    return response([]);
  };
  try {
    await listEndpointsByDomain('logs');
    await listEndpointsByDomain('metrics');
    assert.deepEqual(requests, [
      '/api/v1/logs/endpoints',
      '/api/v1/observability/endpoints?signal_type=metrics&kind=victoriametrics',
    ]);
  } finally {
    globalThis.fetch = original;
  }
});
