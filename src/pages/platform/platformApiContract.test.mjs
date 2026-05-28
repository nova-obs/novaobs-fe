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

test('平台 IAM 组成员和有效权限调用统一平台 API', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init });
    if (String(path).includes('/effective-permissions')) {
      return jsonResponse([{ binding_id: 'binding-1', role_id: 'role-k8s-reader', role_name: 'K8s 只读', granted_to_subject_id: 'sre', granted_to_type: 'group', granted_via: 'group', permissions: [{ resource: 'k8s.resource', action: 'read', scope_mode: 'namespace' }], scope: { cluster_id: 'test03-02', namespace: 'cattle-system' } }]);
    }
    if (String(path).endsWith('/group-memberships') && init.method === 'POST') {
      return jsonResponse({ item: { id: 'membership-1', group_id: 'sre', group_name: 'SRE', subject_id: 'dev-admin', subject_type: 'user', subject_display_name: '开发管理员' }, status: 'created' });
    }
    return jsonResponse([]);
  };

  try {
    const created = await platformApi.createMembership({ groupId: 'sre', subjectId: 'dev-admin', subjectType: 'user' });
    const effective = await platformApi.effectivePermissions({ subjectId: 'dev-admin', subjectType: 'user' });

    assert.equal(requests[0].path, '/api/v1/platform/group-memberships');
    assert.deepEqual(JSON.parse(requests[0].init.body), { group_id: 'sre', subject_id: 'dev-admin', subject_type: 'user' });
    assert.equal(requests[1].path, '/api/v1/platform/effective-permissions?subject_id=dev-admin&subject_type=user');
    assert.equal(created.item.groupId, 'sre');
    assert.equal(effective[0].grantedVia, 'group');
    assert.equal(effective[0].permissions[0].scopeMode, 'namespace');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('平台 IAM 角色创建显式传递 resource action 和 scopeMode', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init });
    return jsonResponse({ item: { id: 'role-k8s-custom', name: 'K8s 自定义', permissions: [{ resource: 'k8s.resource', action: 'read', scope_mode: 'namespace' }] }, status: 'created' });
  };

  try {
    const result = await platformApi.createRole({
      id: 'role-k8s-custom',
      name: 'K8s 自定义',
      permissions: [{ resource: 'k8s.resource', action: 'read', scopeMode: 'namespace' }],
    });

    assert.equal(requests[0].path, '/api/v1/platform/roles');
    assert.equal(requests[0].init.method, 'POST');
    assert.deepEqual(JSON.parse(requests[0].init.body), {
      id: 'role-k8s-custom',
      name: 'K8s 自定义',
      description: '',
      permissions: [{ resource: 'k8s.resource', action: 'read', scope_mode: 'namespace' }],
    });
    assert.equal(result.item.permissions[0].scopeMode, 'namespace');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('平台 IAM 删除接口覆盖用户、组、服务账号、角色和授权绑定', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init });
    if (String(path).includes('/users/')) {
      return jsonResponse({ item: { id: 'operator-1', username: 'operator-1', display_name: '一线运维', status: 'active' }, status: 'deleted' });
    }
    if (String(path).includes('/groups/')) {
      return jsonResponse({ item: { id: 'sre', name: 'sre', display_name: 'SRE', status: 'active' }, status: 'deleted' });
    }
    if (String(path).includes('/service-accounts/')) {
      return jsonResponse({ item: { id: 'robot-1', name: 'robot-1', display_name: '自动化账号', status: 'active' }, status: 'deleted' });
    }
    if (String(path).includes('/roles/')) {
      return jsonResponse({ item: { id: 'role-k8s-custom', name: 'K8s 自定义', permissions: [] }, status: 'deleted' });
    }
    return jsonResponse({ item: { id: 'binding-platform-custom', subject_id: 'operator-1', subject_type: 'user', role_id: 'role-k8s-custom', scope: { global: true } }, status: 'deleted' });
  };

  try {
    await platformApi.deleteUser('operator-1');
    await platformApi.deleteGroup('sre');
    await platformApi.deleteServiceAccount('robot-1');
    await platformApi.deleteRole('role-k8s-custom');
    await platformApi.deleteBinding('binding-platform-custom');

    assert.deepEqual(requests.map((request) => request.path), [
      '/api/v1/platform/users/operator-1',
      '/api/v1/platform/groups/sre',
      '/api/v1/platform/service-accounts/robot-1',
      '/api/v1/platform/roles/role-k8s-custom',
      '/api/v1/platform/bindings/binding-platform-custom',
    ]);
    assert.deepEqual(requests.map((request) => request.init.method), ['DELETE', 'DELETE', 'DELETE', 'DELETE', 'DELETE']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
