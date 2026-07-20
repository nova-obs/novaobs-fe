import test from 'node:test';
import assert from 'node:assert/strict';
import { observabilityEndpointsApi } from './observabilityEndpointsApi.ts';

function response(data) {
  return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ success: true, data, error: null, meta: {} }) };
}

test('VictoriaMetrics 写入目标通过统一观测端点 API 创建', async () => {
  const requests = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init });
    return response({ id: 'vm-prod', name: '生产 VMS', kind: 'victoriametrics', signal_types: ['metrics'], scope: { type: 'global' }, urls: { remote_write_url: 'http://vminsert:8480/insert/0/prometheus/api/v1/write', query_url: 'http://vmselect:8481/select/0/prometheus', ui_url: 'http://vmselect:8481/select/0/vmui' }, status: 'active', health: { status: 'unknown' } });
  };
  try {
    const created = await observabilityEndpointsApi.createVictoriaMetrics({ name: '生产 VMS', description: '', scopeType: 'global', clusterId: '', remoteWriteURL: 'http://vminsert:8480/insert/0/prometheus/api/v1/write', queryURL: 'http://vmselect:8481/select/0/prometheus', uiURL: 'http://vmselect:8481/select/0/vmui', status: 'active' });
    assert.equal(requests[0].path, '/api/v1/observability/endpoints');
    assert.equal(requests[0].init.method, 'POST');
    const body = JSON.parse(requests[0].init.body);
    assert.equal(body.kind, 'victoriametrics');
    assert.deepEqual(body.signal_types, ['metrics']);
    assert.equal(body.urls.remote_write_url, 'http://vminsert:8480/insert/0/prometheus/api/v1/write');
    assert.equal(created.kind, 'victoriametrics');
  } finally { globalThis.fetch = original; }
});

test('VictoriaMetrics 列表和连接测试使用统一端点接口', async () => {
  const requests = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init });
    return response(path.endsWith('/test') ? { status: 'healthy', message: 'VictoriaMetrics 查询端点连通', response_time_ms: 12, checked_at: '2026-07-11T00:00:00Z' } : []);
  };
  try {
    await observabilityEndpointsApi.listVictoriaMetrics();
    const result = await observabilityEndpointsApi.test('vm-prod');
    assert.equal(requests[0].path, '/api/v1/observability/endpoints?signal_type=metrics&kind=victoriametrics');
    assert.equal(requests[1].path, '/api/v1/observability/endpoints/vm-prod/test');
    assert.equal(requests[1].init.method, 'POST');
    assert.equal(result.status, 'healthy');
  } finally { globalThis.fetch = original; }
});
