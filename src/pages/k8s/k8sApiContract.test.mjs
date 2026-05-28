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

function jsonErrorResponse(data, code = 'k8s_terminal_command_blocked', message = '命令不符合 NovaObs 终端安全策略') {
  return {
    ok: false,
    status: 400,
    headers: { get: () => null },
    json: async () => ({ success: false, data, error: { code, message }, meta: {} }),
  };
}

test('K8s 集群列表调用统一 NovaObs API', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init });
    return jsonResponse([
      { id: 'prod', name: 'prod-core', version: 'v1.29.4', region: 'cn-shanghai', status: 'active', access_mode: 'direct', read_only: true },
    ]);
  };

  try {
    const clusters = await k8sApi.listClusters('prod');
    assert.equal(requests[0].path, '/api/v1/k8s/clusters?q=prod');
    assert.equal(clusters[0].id, 'prod');
    assert.equal(clusters[0].status, 'active');
    assert.equal(clusters[0].accessMode, 'direct');
    assert.equal(clusters[0].readOnly, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('K8s 集群登记调用统一 NovaObs API 并刷新真实数据源', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init });
    return jsonResponse({ id: 'prod', name: 'prod-core', version: 'v1.30.1', region: 'cn-shanghai', status: 'active', access_mode: 'agent', read_only: true });
  };

  try {
    const cluster = await k8sApi.createCluster({
      id: 'prod',
      name: 'prod-core',
      version: 'v1.30.1',
      region: 'cn-shanghai',
      description: '生产集群',
      accessMode: 'agent',
      readOnly: true,
    });

    assert.equal(requests[0].path, '/api/v1/k8s/clusters');
    assert.equal(requests[0].init.method, 'POST');
    assert.deepEqual(JSON.parse(requests[0].init.body), {
      id: 'prod',
      name: 'prod-core',
      version: 'v1.30.1',
      region: 'cn-shanghai',
      description: '生产集群',
      access_mode: 'agent',
      read_only: true,
    });
    assert.equal(cluster.status, 'active');
    assert.equal(cluster.accessMode, 'agent');
    assert.equal(cluster.readOnly, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('K8s 集群连接探测调用只读 probe API 并映射策略状态', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init });
    return jsonResponse({
      cluster_id: 'test03',
      status: 'connected',
      access_mode: 'direct',
      read_only: true,
      server_version: 'v1.30.2',
      resource_count: 42,
      warnings: ['partial discovery'],
      checked_at: '2026-05-22T10:00:00Z',
    });
  };

  try {
    const probe = await k8sApi.probeCluster('test03');

    assert.equal(requests[0].path, '/api/v1/k8s/clusters/test03/probe');
    assert.equal(requests[0].init.method, 'POST');
    assert.equal(probe.clusterId, 'test03');
    assert.equal(probe.readOnly, true);
    assert.equal(probe.resourceCount, 42);
    assert.equal(probe.warnings[0], 'partial discovery');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('K8s 集群删除只调用 NovaObs 元数据 API', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init });
    return jsonResponse({ deleted: true });
  };

  try {
    const result = await k8sApi.deleteCluster('stage');

    assert.equal(requests[0].path, '/api/v1/k8s/clusters/stage');
    assert.equal(requests[0].init.method, 'DELETE');
    assert.equal(result.deleted, true);
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

test('K8s 命名空间和 ServiceAccount API 不内置演示集群默认值', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init });
    return jsonResponse([]);
  };

  try {
    await k8sApi.listNamespaces();
    await k8sApi.listServiceAccounts();

    assert.equal(requests[0].path, '/api/v1/k8s/namespaces');
    assert.equal(requests[1].path, '/api/v1/k8s/service-accounts');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('K8s 集群凭据调用统一 NovaObs API 且只映射元数据', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init });
    if (init.method === 'POST' && String(path).endsWith('/rollback')) {
      return jsonResponse({
        item: { secret_id: 'secret-rollback', cluster_id: 'prod', name: 'prod-readonly', fingerprint: 'sha256:abc', status: 'active', active: true, version: 3 },
        audit_id: 'audit-rollback-1',
        probe: { cluster_id: 'prod', status: 'connected', server_version: 'v1.30.2', resource_count: 42, warnings: [], checked_at: '2026-05-27T10:00:00Z' },
      });
    }
    if (init.method === 'POST' && String(path).endsWith('/rotate')) {
      return jsonResponse({
        item: { secret_id: 'secret-rotated', cluster_id: 'prod', name: 'prod-readonly', fingerprint: 'sha256:def', status: 'active', active: true, version: 2 },
        audit_id: 'audit-rotate-1',
        probe: { cluster_id: 'prod', status: 'connected', server_version: 'v1.30.2', resource_count: 42, warnings: [], checked_at: '2026-05-27T10:00:00Z' },
      });
    }
    if (init.method === 'POST') {
      return jsonResponse({ item: { secret_id: 'secret-created', cluster_id: 'prod', name: 'prod-readonly', fingerprint: 'sha256:abc', status: 'active', active: true, version: 1 }, audit_id: 'audit-create-1' });
    }
    return jsonResponse([
      { secret_id: 'secret-rotated', cluster_id: 'prod', name: 'prod-readonly', fingerprint: 'sha256:def', status: 'active', active: true, version: 2, expires_soon: true, expired: false, kubeconfig: 'must-not-be-used' },
      { secret_id: 'secret-created', cluster_id: 'prod', name: 'prod-readonly', fingerprint: 'sha256:abc', status: 'superseded', active: false, version: 1, expires_soon: false, expired: false },
    ]);
  };

  try {
    const credentials = await k8sApi.listClusterCredentials('prod');
    const created = await k8sApi.createClusterCredential({ clusterId: 'prod', name: 'prod-readonly', kubeconfig: 'apiVersion: v1\nkind: Config\nclusters: []' });
    const rotated = await k8sApi.rotateClusterCredential({ clusterId: 'prod', name: 'prod-readonly', kubeconfig: 'apiVersion: v1\nkind: Config\nclusters: []' });
    const rollback = await k8sApi.rollbackClusterCredential({ clusterId: 'prod', secretId: 'secret-created' });

    assert.equal(requests[0].path, '/api/v1/k8s/cluster-credentials?cluster_id=prod');
    assert.equal(requests[1].path, '/api/v1/k8s/cluster-credentials');
    assert.equal(JSON.parse(requests[1].init.body).kubeconfig.includes('apiVersion'), true);
    assert.equal(requests[2].path, '/api/v1/k8s/cluster-credentials/rotate');
    assert.equal(requests[3].path, '/api/v1/k8s/cluster-credentials/rollback');
    assert.deepEqual(JSON.parse(requests[3].init.body), { cluster_id: 'prod', secret_id: 'secret-created' });
    assert.equal(credentials[0].secretId, 'secret-rotated');
    assert.equal(credentials[0].fingerprint, 'sha256:def');
    assert.equal(credentials[0].active, true);
    assert.equal(credentials[0].version, 2);
    assert.equal(credentials[0].expiresSoon, true);
    assert.equal('kubeconfig' in credentials[0], false);
    assert.equal(created.auditId, 'audit-create-1');
    assert.equal(rotated.item.secretId, 'secret-rotated');
    assert.equal(rotated.probe.serverVersion, 'v1.30.2');
    assert.equal(rollback.item.secretId, 'secret-rollback');
    assert.equal(rollback.probe.resourceCount, 42);
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

test('K8s 资源详情、YAML 和 Pod 日志调用统一 NovaObs API', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  const identity = { clusterId: 'prod', namespace: 'orders', apiVersion: 'v1', kind: 'Pod', name: 'orders-api-7d9', uid: 'uid-pod' };
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init });
    if (String(path).includes('/resources/detail')) {
      return jsonResponse({
        identity: { cluster_id: 'prod', namespace: 'orders', api_version: 'v1', kind: 'Pod', name: 'orders-api-7d9', uid: 'uid-pod' },
        status: 'healthy',
        labels: { app: 'orders-api' },
        spec: { containers: [{ name: 'api', image: 'orders:v1' }] },
      });
    }
    if (String(path).includes('/resources/yaml')) {
      return jsonResponse({
        identity: { cluster_id: 'prod', namespace: 'orders', api_version: 'v1', kind: 'Pod', name: 'orders-api-7d9', uid: 'uid-pod' },
        yaml: 'apiVersion: v1\nkind: Pod\nmetadata:\n  name: orders-api-7d9\n',
      });
    }
    return jsonResponse({
      identity: { cluster_id: 'prod', namespace: 'orders', api_version: 'v1', kind: 'Pod', name: 'orders-api-7d9' },
      container: 'api',
      lines: ['line-1', 'line-2'],
    });
  };

  try {
    const detail = await k8sApi.getResourceDetail(identity);
    const yaml = await k8sApi.getResourceYAML(identity);
    const logs = await k8sApi.getPodLogs({ clusterId: 'prod', namespace: 'orders', pod: 'orders-api-7d9', container: 'api' });

    assert.equal(requests[0].path, '/api/v1/k8s/resources/detail?cluster_id=prod&namespace=orders&api_version=v1&kind=Pod&name=orders-api-7d9&uid=uid-pod');
    assert.equal(requests[1].path, '/api/v1/k8s/resources/yaml?cluster_id=prod&namespace=orders&api_version=v1&kind=Pod&name=orders-api-7d9&uid=uid-pod');
    assert.equal(requests[2].path, '/api/v1/k8s/pod-logs?cluster_id=prod&namespace=orders&pod=orders-api-7d9&container=api');
    assert.equal(detail.spec.containers[0].image, 'orders:v1');
    assert.equal(yaml.yaml.includes('kind: Pod'), true);
    assert.equal(logs.lines.length, 2);
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
    const history = await k8sApi.listDeploymentHistory('prod', 'orders');
    const audits = await k8sApi.listAuditEvents('prod', 'orders');
    assert.equal(requests[0].path, '/api/v1/k8s/deployment-history?cluster_id=prod&namespace=orders');
    assert.equal(requests[1].path, '/api/v1/k8s/audit-events?cluster_id=prod&namespace=orders');
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

test('K8s 证书写操作调用统一 NovaObs API 且私钥只在提交体中出现', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init });
    if (init.method === 'POST') {
      return jsonResponse({ item: { id: 'cert-1', cluster_id: 'prod', namespace: 'ingress', name: 'wildcard-prod', common_name: '*.prod.example.com', fingerprint: 'sha256:abc', secret_id: 'secret-1', status: 'valid' }, audit_id: 'audit-create-1' });
    }
    if (init.method === 'DELETE') {
      return jsonResponse({ status: 'deleted', audit_id: 'audit-delete-1' });
    }
    return jsonResponse([]);
  };

  try {
    const created = await k8sApi.createCertificate({
      clusterId: 'prod',
      namespace: 'ingress',
      name: 'wildcard-prod',
      commonName: '*.prod.example.com',
      certificatePEM: 'certificate',
      keyMaterialPEM: 'private-key-material',
      notAfter: '2026-08-19',
    });
    const deleted = await k8sApi.deleteCertificate('cert-1');

    assert.equal(requests[0].path, '/api/v1/k8s/certificates');
    assert.equal(JSON.parse(requests[0].init.body).private_key_pem, 'private-key-material');
    assert.equal(requests[1].path, '/api/v1/k8s/certificates/cert-1');
    assert.equal(created.item.secretId, 'secret-1');
    assert.equal('privateKey' in created.item, false);
    assert.equal(deleted.auditId, 'audit-delete-1');
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

test('K8s 平台授权权限包调用统一 NovaObs API 并映射风险与推荐主体', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init });
    return jsonResponse([
      {
        id: 'k8s-readonly',
        label: '只读观察者',
        description: '查看资源',
        risk: 'low',
        scope_mode: 'namespace',
        recommended_subject_type: 'group',
        permission_ids: ['k8s.namespace:read', 'k8s.resource:read'],
      },
    ]);
  };

  try {
    const profiles = await k8sApi.listPlatformAccessProfiles();

    assert.equal(requests[0].path, '/api/v1/k8s/platform-access/profiles');
    assert.equal(profiles[0].id, 'k8s-readonly');
    assert.equal(profiles[0].risk, 'low');
    assert.equal(profiles[0].scopeMode, 'namespace');
    assert.equal(profiles[0].recommendedSubjectType, 'group');
    assert.deepEqual(profiles[0].permissionIds, ['k8s.namespace:read', 'k8s.resource:read']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('K8s 平台授权创建支持多命名空间、全命名空间和风险确认契约', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init });
    return jsonResponse({
      item: {
        id: 'binding-prod-sre',
        subject_id: 'sre',
        subject_type: 'group',
        role_id: 'role-k8s-platform-access',
        role_name: 'K8s 平台授权组合',
        scope: { cluster_id: 'prod', namespaces: ['orders', 'payments'] },
        permission_ids: ['k8s.resource:read'],
        permissions: [{ resource: 'k8s.resource', action: 'read', scope_mode: 'namespace' }],
      },
      items: [
        {
          id: 'binding-prod-sre',
          subject_id: 'sre',
          subject_type: 'group',
          role_id: 'role-k8s-platform-access',
          role_name: 'K8s 平台授权组合',
          scope: { cluster_id: 'prod', namespaces: ['orders', 'payments'] },
          permission_ids: ['k8s.resource:read'],
          permissions: [{ resource: 'k8s.resource', action: 'read', scope_mode: 'namespace' }],
        },
      ],
      audit_id: 'audit-grant-1',
    });
  };

  try {
    const result = await k8sApi.createPlatformAccessBinding({
      subjectId: 'sre',
      subjectType: 'group',
      clusterId: 'prod',
      namespaces: ['orders', 'payments'],
      allNamespaces: false,
      riskAccepted: true,
      permissionIds: ['k8s.resource:read'],
    });

    assert.equal(requests[0].path, '/api/v1/k8s/platform-access/bindings');
    const payload = JSON.parse(requests[0].init.body);
    assert.deepEqual(payload.namespaces, ['orders', 'payments']);
    assert.equal(payload.all_namespaces, false);
    assert.equal(payload.risk_accepted, true);
    assert.equal(payload.namespace, '');
    assert.equal(result.items.length, 1);
    assert.deepEqual(result.items[0].scope.namespaces, ['orders', 'payments']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('K8s 模板管理调用统一 NovaObs API 并单独渲染', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init });
    if (String(path).includes('/base')) {
      return jsonResponse({ type: 'Deployment', yaml_content: 'apiVersion: apps/v1\nkind: Deployment', variables: [{ name: 'name', required: true }], source: 'novaobs-base' });
    }
    if (init.method === 'POST' && String(path).endsWith('/render')) {
      return jsonResponse({ rendered_yaml: 'kind: Deployment\nmetadata:\n  name: orders-api', audit_id: 'audit-render-1' });
    }
    if (init.method === 'POST') {
      return jsonResponse({ item: { id: 'tpl-1', name: 'orders-deploy', type: 'Deployment', yaml_content: 'kind: Deployment', variables: [{ name: 'image', required: true }] }, audit_id: 'audit-create-1' });
    }
    if (init.method === 'DELETE') {
      return jsonResponse({ status: 'deleted', audit_id: 'audit-delete-1' });
    }
    return jsonResponse([{ id: 'tpl-1', name: 'orders-deploy', type: 'Deployment', yaml_content: 'kind: Deployment', variables: [{ name: 'image', required: true }], source: 'startorch' }]);
  };

  try {
    const templates = await k8sApi.listTemplates();
    const base = await k8sApi.getBaseTemplate('Deployment');
    const created = await k8sApi.createTemplate({ name: 'orders-deploy', type: 'Deployment', yamlContent: 'kind: Deployment', variables: [{ name: 'image', description: '', required: true }] });
    const rendered = await k8sApi.renderTemplate('tpl-1', { image: 'orders:v2' });
    const deleted = await k8sApi.deleteTemplate('tpl-1');

    assert.equal(requests[0].path, '/api/v1/k8s/templates');
    assert.equal(requests[1].path, '/api/v1/k8s/templates/base?type=Deployment');
    assert.equal(requests[2].path, '/api/v1/k8s/templates');
    assert.equal(JSON.parse(requests[2].init.body).yaml_content, 'kind: Deployment');
    assert.equal(requests[3].path, '/api/v1/k8s/templates/render');
    assert.equal(JSON.parse(requests[3].init.body).variables.image, 'orders:v2');
    assert.equal(requests[4].path, '/api/v1/k8s/templates/tpl-1');
    assert.equal(templates[0].yamlContent, 'kind: Deployment');
    assert.equal(base.yamlContent.includes('kind: Deployment'), true);
    assert.equal(base.variables[0].name, 'name');
    assert.equal(created.auditId, 'audit-create-1');
    assert.equal(rendered.auditId, 'audit-render-1');
    assert.equal(deleted.auditId, 'audit-delete-1');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('K8s 发布部署调用统一 NovaObs API 并传递预览确认与完整资源身份', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  const result = {
    status: 'accepted',
    message: 'ok',
    audit_id: 'audit-deploy-1',
    preview_id: 'preview-8f13',
    confirmation_token: 'confirm-7c2a',
    warnings: ['server dry-run warning'],
    diffs: [{ cluster_id: 'prod', namespace: 'orders', api_version: 'apps/v1', kind: 'Deployment', name: 'orders-api', operation: 'update', before_hash: 'before-1', after_hash: 'after-2' }],
    resources: [{ cluster_id: 'prod', namespace: 'orders', api_version: 'apps/v1', kind: 'Deployment', name: 'orders-api', uid: 'uid-orders-api' }],
  };
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init });
    return jsonResponse(result);
  };

  try {
    const preview = await k8sApi.previewDeployment({ clusterId: 'prod', yamlContent: 'kind: Deployment' });
    const applied = await k8sApi.applyDeployment({ clusterId: 'prod', yamlContent: 'kind: Deployment', previewId: preview.previewId, confirmationToken: preview.confirmationToken });
    const deletePreview = await k8sApi.previewDeleteDeployment({ clusterId: 'prod', namespace: 'orders', apiVersion: 'apps/v1', kind: 'Deployment', name: 'orders-api', uid: 'uid-orders-api' });
    const deleted = await k8sApi.deleteDeployment({ clusterId: 'prod', namespace: 'orders', apiVersion: 'apps/v1', kind: 'Deployment', name: 'orders-api', uid: 'uid-orders-api' }, { previewId: deletePreview.previewId, confirmationToken: deletePreview.confirmationToken });
    const rollback = await k8sApi.rollbackDeployment({ historyId: 'deploy-1', identity: { clusterId: 'prod', namespace: 'orders', apiVersion: 'apps/v1', kind: 'Deployment', name: 'orders-api', uid: 'uid-orders-api' } });

    assert.equal(requests[0].path, '/api/v1/k8s/deployments/preview');
    assert.equal(requests[1].path, '/api/v1/k8s/deployments');
    assert.equal(JSON.parse(requests[1].init.body).preview_id, 'preview-8f13');
    assert.equal(JSON.parse(requests[1].init.body).confirmation_token, 'confirm-7c2a');
    assert.equal(requests[2].path, '/api/v1/k8s/deployments/delete-preview');
    assert.equal(JSON.parse(requests[2].init.body).identity.uid, 'uid-orders-api');
    assert.equal(requests[3].path, '/api/v1/k8s/deployments');
    assert.equal(requests[3].init.method, 'DELETE');
    assert.equal(JSON.parse(requests[3].init.body).identity.uid, 'uid-orders-api');
    assert.equal(JSON.parse(requests[3].init.body).preview_id, 'preview-8f13');
    assert.equal(JSON.parse(requests[3].init.body).confirmation_token, 'confirm-7c2a');
    assert.equal(requests[4].path, '/api/v1/k8s/deployments/rollback');
    assert.equal(JSON.parse(requests[4].init.body).history_id, 'deploy-1');
    assert.equal(preview.resources[0].apiVersion, 'apps/v1');
    assert.equal(deletePreview.diffs[0].operation, 'update');
    assert.equal(preview.previewId, 'preview-8f13');
    assert.equal(preview.confirmationToken, 'confirm-7c2a');
    assert.equal(preview.diffs[0].operation, 'update');
    assert.equal(preview.warnings[0], 'server dry-run warning');
    assert.equal(applied.auditId, 'audit-deploy-1');
    assert.equal(deleted.status, 'accepted');
    assert.equal(rollback.resources[0].uid, 'uid-orders-api');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('K8s 受控终端调用统一 NovaObs API 并映射审计结果', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init });
    return jsonResponse({
      status: 'accepted',
      cluster_id: 'prod',
      namespace: 'orders',
      command: 'get pods -n orders',
      verb: 'get',
      args: ['pods', '-n', 'orders'],
      output: 'NovaObs 已校验只读命令',
      exit_code: 0,
      audit_id: 'audit-terminal-1',
      mode: 'dry_run',
      output_truncated: true,
    });
  };

  try {
    const result = await k8sApi.execTerminal({ clusterId: 'prod', namespace: 'orders', command: 'get pods -n orders' });

    assert.equal(requests[0].path, '/api/v1/k8s/terminal/exec');
    assert.equal(JSON.parse(requests[0].init.body).cluster_id, 'prod');
    assert.equal(JSON.parse(requests[0].init.body).namespace, 'orders');
    assert.equal(JSON.parse(requests[0].init.body).command, 'get pods -n orders');
    assert.equal(result.auditId, 'audit-terminal-1');
    assert.equal(result.mode, 'dry_run');
    assert.equal(result.exitCode, 0);
    assert.equal(result.outputTruncated, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('K8s 受控终端保留 blocked 响应中的策略结果', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonErrorResponse({
    status: 'blocked',
    cluster_id: 'prod',
    namespace: 'orders',
    command: 'delete pod orders-api',
    verb: 'delete',
    output: '动词 "delete" 不在只读允许列表中',
    exit_code: 126,
    audit_id: 'audit-terminal-blocked',
    blocked_reason: '动词 "delete" 不在只读允许列表中',
    mode: 'policy_guard',
  });

  try {
    const result = await k8sApi.execTerminal({ clusterId: 'prod', namespace: 'orders', command: 'delete pod orders-api' });

    assert.equal(result.status, 'blocked');
    assert.equal(result.auditId, 'audit-terminal-blocked');
    assert.equal(result.blockedReason.includes('delete'), true);
    assert.equal(result.exitCode, 126);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
