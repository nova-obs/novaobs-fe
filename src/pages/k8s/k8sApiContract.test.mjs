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

test('K8s 证书中心调用统一 NovaObs API 且只映射元数据', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init });
    return jsonResponse([
      {
        id: 'cert-prod-1',
        cluster_id: 'prod',
        namespace: 'ingress',
        name: 'wildcard-prod',
        common_name: '*.prod.example.com',
        fingerprint: 'sha256:6f7d8e',
        not_after: '2026-08-19T00:00:00Z',
        status: 'valid',
        source: 'startorch',
        private_key: 'must-not-be-used',
      },
    ]);
  };

  try {
    const certificates = await k8sApi.listCertificates('prod');
    assert.equal(requests[0].path, '/api/v1/k8s/certificates?cluster_id=prod');
    assert.equal(certificates[0].clusterId, 'prod');
    assert.equal(certificates[0].commonName, '*.prod.example.com');
    assert.equal(certificates[0].fingerprint, 'sha256:6f7d8e');
    assert.equal(certificates[0].notAfter, '2026-08-19T00:00:00Z');
    assert.equal('privateKey' in certificates[0], false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('K8s ServiceAccount 写操作调用统一 NovaObs API 并传递审计上下文', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init });
    if (init.method === 'POST') {
      return jsonResponse({ item: { id: 'sa-1', cluster_id: 'prod', namespace: 'orders', name: 'orders-reader', uid: 'uid-1', status: 'active' }, audit_id: 'audit-create-1' });
    }
    if (init.method === 'DELETE') {
      return jsonResponse({ status: 'deleted', audit_id: 'audit-delete-1' });
    }
    return jsonResponse([{ id: 'sa-1', cluster_id: 'prod', namespace: 'orders', name: 'orders-reader', uid: 'uid-1', status: 'active', source: 'startorch' }]);
  };

  try {
    const accounts = await k8sApi.listServiceAccounts('prod', 'orders');
    const created = await k8sApi.createServiceAccount({ clusterId: 'prod', namespace: 'orders', name: 'orders-reader' });
    const deleted = await k8sApi.deleteServiceAccount({ clusterId: 'prod', namespace: 'orders', name: 'orders-reader', uid: 'uid-1' });

    assert.equal(requests[0].path, '/api/v1/k8s/service-accounts?cluster_id=prod&namespace=orders');
    assert.equal(requests[1].path, '/api/v1/k8s/service-accounts');
    assert.equal(requests[1].init.method, 'POST');
    assert.equal('X-NovaObs-User' in requests[1].init.headers, false);
    assert.equal(JSON.parse(requests[1].init.body).name, 'orders-reader');
    assert.equal(requests[2].path, '/api/v1/k8s/service-accounts?cluster_id=prod&namespace=orders&name=orders-reader&uid=uid-1');
    assert.equal(requests[2].init.method, 'DELETE');
    assert.equal('X-NovaObs-User' in requests[2].init.headers, false);
    assert.equal(accounts[0].uid, 'uid-1');
    assert.equal(created.auditId, 'audit-create-1');
    assert.equal(created.item.uid, 'uid-1');
    assert.equal(deleted.auditId, 'audit-delete-1');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('K8s RBAC Role 和 Binding 调用统一 NovaObs API', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init });
    if (init.method === 'POST' && String(path).includes('/roles')) {
      return jsonResponse({ item: { id: 'role-1', cluster_id: 'prod', namespace: 'orders', kind: 'Role', name: 'orders-reader', uid: 'uid-role', rules: [{ api_groups: [''], resources: ['pods'], verbs: ['get'] }] }, audit_id: 'audit-role-1' });
    }
    if (init.method === 'POST' && String(path).includes('/bindings')) {
      return jsonResponse({ item: { id: 'binding-1', cluster_id: 'prod', namespace: 'orders', kind: 'RoleBinding', name: 'orders-reader-binding', uid: 'uid-binding', role_ref: { kind: 'Role', name: 'orders-reader' }, subjects: [{ kind: 'ServiceAccount', name: 'orders-reader', namespace: 'orders' }] }, audit_id: 'audit-binding-1' });
    }
    if (init.method === 'DELETE') {
      return jsonResponse({ status: 'deleted', audit_id: 'audit-binding-delete-1' });
    }
    if (String(path).includes('/bindings')) {
      return jsonResponse([{ id: 'binding-1', cluster_id: 'prod', namespace: 'orders', kind: 'RoleBinding', name: 'orders-reader-binding', uid: 'uid-binding', role_ref: { kind: 'Role', name: 'orders-reader' }, subjects: [] }]);
    }
    return jsonResponse([{ id: 'role-1', cluster_id: 'prod', namespace: 'orders', kind: 'Role', name: 'orders-reader', uid: 'uid-role', rules: [{ api_groups: [''], resources: ['pods'], verbs: ['get'] }] }]);
  };

  try {
    const roles = await k8sApi.listRBACRoles('prod', 'orders');
    const bindings = await k8sApi.listRBACBindings('prod', 'orders');
    const role = await k8sApi.createRBACRole({ clusterId: 'prod', namespace: 'orders', name: 'orders-reader' });
    const binding = await k8sApi.createRBACBinding({ clusterId: 'prod', namespace: 'orders', name: 'orders-reader-binding', roleName: 'orders-reader', serviceAccountName: 'orders-reader' });
    const deleted = await k8sApi.deleteRBACBinding({ clusterId: 'prod', namespace: 'orders', kind: 'RoleBinding', name: 'orders-reader-binding', uid: 'uid-binding' });

    assert.equal(requests[0].path, '/api/v1/k8s/rbac/roles?cluster_id=prod&namespace=orders');
    assert.equal(requests[1].path, '/api/v1/k8s/rbac/bindings?cluster_id=prod&namespace=orders');
    assert.equal(requests[2].path, '/api/v1/k8s/rbac/roles');
    assert.equal(requests[2].init.method, 'POST');
    assert.equal(JSON.parse(requests[2].init.body).rules[0].resources[0], 'pods');
    assert.equal(requests[3].path, '/api/v1/k8s/rbac/bindings');
    assert.equal(JSON.parse(requests[3].init.body).role_ref.name, 'orders-reader');
    assert.equal(requests[4].path, '/api/v1/k8s/rbac/bindings?cluster_id=prod&namespace=orders&kind=RoleBinding&name=orders-reader-binding&uid=uid-binding');
    assert.equal(roles[0].rules[0].apiGroups[0], '');
    assert.equal(bindings[0].roleRef.name, 'orders-reader');
    assert.equal(role.auditId, 'audit-role-1');
    assert.equal(binding.auditId, 'audit-binding-1');
    assert.equal(deleted.auditId, 'audit-binding-delete-1');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('K8s Kubeconfig 生成只返回元数据，导出单独调用', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init });
    if (String(path).includes('/export')) {
      return jsonResponse({ kubeconfig: 'apiVersion: v1\nkind: Config', audit_id: 'audit-export-1' });
    }
    return jsonResponse({ secret_id: 'secret-1', fingerprint: 'sha256:abc', expires_at: '2026-05-20T00:00:00Z', audit_id: 'audit-create-1' });
  };

  try {
    const metadata = await k8sApi.createKubeconfig({ clusterId: 'prod', namespace: 'orders', serviceAccount: 'orders-reader' });
    const exported = await k8sApi.exportKubeconfig('secret-1');

    assert.equal(requests[0].path, '/api/v1/k8s/kubeconfigs');
    assert.equal(requests[0].init.method, 'POST');
    assert.equal(JSON.parse(requests[0].init.body).service_account, 'orders-reader');
    assert.equal(requests[1].path, '/api/v1/k8s/kubeconfigs/export');
    assert.equal(JSON.parse(requests[1].init.body).secret_id, 'secret-1');
    assert.equal(metadata.secretId, 'secret-1');
    assert.equal(metadata.auditId, 'audit-create-1');
    assert.equal(exported.kubeconfig.includes('apiVersion'), true);
    assert.equal(exported.auditId, 'audit-export-1');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
