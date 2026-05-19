import test from 'node:test';
import assert from 'node:assert/strict';
import { k8sApi } from './api.ts';

function jsonResponse(data) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({ success: true, data, error: null, meta: { total: data.length } }),
  };
}

test('K8s 集群列表调用统一 NovaObs API', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init });
    return jsonResponse([
      { id: 'prod', name: 'prod-core', version: 'v1.29.4', region: 'cn-shanghai', status: 'active' },
    ]);
  };

  try {
    const clusters = await k8sApi.listClusters('prod');
    assert.equal(requests[0].path, '/api/v1/k8s/clusters?q=prod');
    assert.equal(clusters[0].id, 'prod');
    assert.equal(clusters[0].status, 'active');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('K8s 命名空间列表调用统一 NovaObs API', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init });
    return jsonResponse([
      { id: 'orders', cluster_id: 'prod', name: 'orders', status: 'active', owner: 'orders-team', phase: 'Active' },
    ]);
  };

  try {
    const namespaces = await k8sApi.listNamespaces('prod', 'orders');
    assert.equal(requests[0].path, '/api/v1/k8s/namespaces?cluster_id=prod&q=orders');
    assert.equal(namespaces[0].clusterId, 'prod');
    assert.equal(namespaces[0].name, 'orders');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
