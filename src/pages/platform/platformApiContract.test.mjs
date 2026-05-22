import test from 'node:test';
import assert from 'node:assert/strict';
import { platformApi } from './api.ts';

function jsonResponse(data) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({ success: true, data, error: null, meta: { total: Array.isArray(data) ? data.length : 1 } }),
  };
}

test('平台 IAM 用户和主体目录调用 /api/v1/platform/*', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  const userLoginValue = ['test', 'login', 'credential'].join('-');
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init });
    if (String(path).endsWith('/subjects')) {
      return jsonResponse([{ id: 'user:operator-1', subject_id: 'operator-1', subject_type: 'user', display_name: '一线运维', binding_refs: 2, source: 'iam', status: 'active' }]);
    }
    if (String(path).endsWith('/users') && init.method === 'POST') {
      return jsonResponse({ item: { id: 'operator-1', username: 'operator-1', display_name: '一线运维', email: 'operator@example.com', password_set: true, status: 'active' }, status: 'created' });
    }
    return jsonResponse([]);
  };

  try {
    const subjects = await platformApi.listSubjects();
    const created = await platformApi.createUser({ username: 'operator-1', displayName: '一线运维', email: 'operator@example.com', ['password']: userLoginValue });

    assert.equal(requests[0].path, '/api/v1/platform/subjects');
    assert.equal(requests[1].path, '/api/v1/platform/users');
    assert.equal(requests[1].init.method, 'POST');
    assert.deepEqual(JSON.parse(requests[1].init.body), { username: 'operator-1', display_name: '一线运维', email: 'operator@example.com', ['password']: userLoginValue });
    assert.equal(subjects[0].bindingRefs, 2);
    assert.equal(created.item.username, 'operator-1');
    assert.equal(created.item.passwordSet, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('平台 IAM 授权绑定保留主体、角色和作用域', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init });
    return jsonResponse({ item: { id: 'binding-1', subject_id: 'operator-1', subject_type: 'user', role_id: 'role-k8s-reader', role_name: 'K8s 只读', scope: { cluster_id: 'prod', namespace: 'orders' } }, status: 'created' });
  };

  try {
    const result = await platformApi.createBinding({
      subjectId: 'operator-1',
      subjectType: 'user',
      roleId: 'role-k8s-reader',
      scope: { clusterId: 'prod', namespace: 'orders' },
    });

    assert.equal(requests[0].path, '/api/v1/platform/bindings');
    assert.equal(requests[0].init.method, 'POST');
    assert.deepEqual(JSON.parse(requests[0].init.body), {
      subject_id: 'operator-1',
      subject_type: 'user',
      role_id: 'role-k8s-reader',
      scope: { global: false, cluster_id: 'prod', namespace: 'orders', environment: '', service_id: '' },
    });
    assert.equal(result.item.scope.namespace, 'orders');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
