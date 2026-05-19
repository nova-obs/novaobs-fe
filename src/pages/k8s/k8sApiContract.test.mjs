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

test('K8s 资源列表调用统一 NovaObs API 并映射完整身份', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init });
    return jsonResponse([
      {
        identity: { cluster_id: 'prod', namespace: 'orders', api_version: 'apps/v1', kind: 'Deployment', name: 'orders-api', uid: 'uid-orders' },
        status: 'warning',
        labels: { app: 'orders-api' },
      },
    ]);
  };

  try {
    const resources = await k8sApi.listResources({ clusterId: 'prod', namespace: 'orders', kind: 'Deployment' });
    assert.equal(requests[0].path, '/api/v1/k8s/resources?cluster_id=prod&namespace=orders&kind=Deployment');
    assert.equal(resources[0].identity.uid, 'uid-orders');
    assert.equal(resources[0].identity.apiVersion, 'apps/v1');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('K8s 部署历史和审计事件调用统一 NovaObs API', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init });
    if (String(path).includes('audit-events')) {
      return jsonResponse([{ id: 'audit-1', cluster_id: 'prod', namespace: 'orders', resource_kind: 'Deployment', resource_name: 'orders-api', action: 'rollout.pause', actor: 'platform-admin', trace_id: 'trace-1' }]);
    }
    return jsonResponse([{ id: 'deploy-1', cluster_id: 'prod', namespace: 'orders', workload: 'orders-api', action: 'rollout.pause', revision: 'rev-1', actor: 'platform-admin' }]);
  };

  try {
    const history = await k8sApi.listDeploymentHistory('prod');
    const audits = await k8sApi.listAuditEvents('prod');
    assert.equal(requests[0].path, '/api/v1/k8s/deployment-history?cluster_id=prod');
    assert.equal(requests[1].path, '/api/v1/k8s/audit-events?cluster_id=prod');
    assert.equal(history[0].workload, 'orders-api');
    assert.equal(audits[0].traceId, 'trace-1');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
