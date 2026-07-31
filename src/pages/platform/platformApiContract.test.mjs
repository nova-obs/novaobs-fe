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
      return jsonResponse([{ id: 'user:operator-1', subject_id: 'operator-1', subject_type: 'user', display_name: 'operator-1', binding_refs: 2, source: 'iam', status: 'active' }]);
    }
    if (String(path).endsWith('/users') && init.method === 'POST') {
      return jsonResponse({ item: { id: 'operator-1', username: 'operator-1', email: 'operator@example.com', password_set: true, status: 'active' }, status: 'created' });
    }
    return jsonResponse([]);
  };

  try {
    const subjects = await platformApi.listSubjects();
    const created = await platformApi.createUser({ username: 'operator-1', email: 'operator@example.com', ['password']: userLoginValue });

    assert.equal(requests[0].path, '/api/v1/platform/subjects');
    assert.equal(requests[1].path, '/api/v1/platform/users');
    assert.equal(requests[1].init.method, 'POST');
    assert.deepEqual(JSON.parse(requests[1].init.body), { username: 'operator-1', email: 'operator@example.com', ['password']: userLoginValue });
    assert.equal(subjects[0].bindingRefs, 2);
    assert.equal(created.item.username, 'operator-1');
    assert.equal(created.item.passwordSet, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('平台 IAM 空库列表把 null 统一映射为空数组', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse(null);

  try {
    const results = await Promise.all([
      platformApi.listSubjects(),
      platformApi.listUsers(),
      platformApi.listGroups(),
      platformApi.listMemberships(),
      platformApi.listImages(),
    ]);

    assert.deepEqual(results, [[], [], [], [], []]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('平台 IAM 创建用户组调用统一后端契约', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init });
    return jsonResponse({
      item: {
        id: 'developers',
        name: 'developers',
        display_name: '研发组',
        description: '研发成员',
        status: 'active',
      },
      status: 'created',
    });
  };

  try {
    const created = await platformApi.createGroup({
      name: 'developers',
      displayName: '研发组',
      description: '研发成员',
    });

    assert.equal(requests[0].path, '/api/v1/platform/groups');
    assert.equal(requests[0].init.method, 'POST');
    assert.deepEqual(JSON.parse(requests[0].init.body), {
      name: 'developers',
      display_name: '研发组',
      description: '研发成员',
    });
    assert.equal(created.item.name, 'developers');
    assert.equal(created.item.displayName, '研发组');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('平台 IAM 列表拒绝非数组成功响应', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse({});

  try {
    await assert.rejects(
      () => platformApi.listSubjects(),
      /平台列表接口返回格式错误/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('平台 IAM 组成员调用统一平台 API', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init });
    if (String(path).endsWith('/group-memberships') && init.method === 'POST') {
      return jsonResponse({ item: { id: 'membership-1', group_id: 'sre', group_name: 'SRE', user_id: 'dev-admin', username: 'dev-admin' }, status: 'created' });
    }
    return jsonResponse([]);
  };

  try {
    const created = await platformApi.createMembership({ groupId: 'sre', userId: 'dev-admin' });

    assert.equal(requests[0].path, '/api/v1/platform/group-memberships');
    assert.deepEqual(JSON.parse(requests[0].init.body), { group_id: 'sre', user_id: 'dev-admin' });
    assert.equal(created.item.groupId, 'sre');
    assert.equal(created.item.userId, 'dev-admin');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('平台 IAM 删除接口覆盖用户和用户组', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init });
    if (String(path).includes('/users/')) {
      return jsonResponse({ item: { id: 'operator-1', username: 'operator-1', status: 'active' }, status: 'deleted' });
    }
    if (String(path).includes('/groups/')) {
      return jsonResponse({ item: { id: 'sre', name: 'sre', display_name: 'SRE', status: 'active' }, status: 'deleted' });
    }
    return jsonResponse({ status: 'deleted' });
  };

  try {
    await platformApi.deleteUser('operator-1');
    await platformApi.deleteGroup('sre');

    assert.deepEqual(requests.map((request) => request.path), [
      '/api/v1/platform/users/operator-1',
      '/api/v1/platform/groups/sre',
    ]);
    assert.deepEqual(requests.map((request) => request.init.method), ['DELETE', 'DELETE']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('平台镜像模板读取和更新使用平台设置 API', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init });
    if (init.method === 'PUT') {
      return jsonResponse({ key: '__NOVAAPM_IMAGE_OTEL_COLLECTOR__', value: 'harbor.example.com/novaapm/otel:0.153.0', updated_at: '2026-06-26T09:00:00Z' });
    }
    return jsonResponse([{ key: '__NOVAAPM_IMAGE_OTEL_COLLECTOR__', value: 'hub-test.service.ucloud.cn/logsplatfrom/opentelemetry-collector-contrib:0.153.0' }]);
  };

  try {
    const images = await platformApi.listImages();
    const updated = await platformApi.updateImage({ key: '__NOVAAPM_IMAGE_OTEL_COLLECTOR__', value: 'harbor.example.com/novaapm/otel:0.153.0' });

    assert.equal(requests[0].path, '/api/v1/platform/images');
    assert.equal(requests[1].path, '/api/v1/platform/images');
    assert.equal(requests[1].init.method, 'PUT');
    assert.deepEqual(JSON.parse(requests[1].init.body), { key: '__NOVAAPM_IMAGE_OTEL_COLLECTOR__', value: 'harbor.example.com/novaapm/otel:0.153.0' });
    assert.equal(images[0].key, '__NOVAAPM_IMAGE_OTEL_COLLECTOR__');
    assert.equal(updated.value, 'harbor.example.com/novaapm/otel:0.153.0');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Grafana 工作区入口配置使用全局平台设置 API', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init });
    return jsonResponse({ state: 'ready', entry_url: 'http://grafana:3000/dashboards', updated_at: '2026-07-22T10:00:00Z' });
  };
  try {
    const setting = await platformApi.getGrafanaSetting();
    const updated = await platformApi.updateGrafanaSetting('http://grafana:3000/explore?orgId=1');
    assert.equal(requests[0].path, '/api/v1/platform/settings/grafana');
    assert.equal(requests[1].path, '/api/v1/platform/settings/grafana');
    assert.equal(requests[1].init.method, 'PUT');
    assert.deepEqual(JSON.parse(requests[1].init.body), { entry_url: 'http://grafana:3000/explore?orgId=1' });
    assert.equal(setting.entryURL, 'http://grafana:3000/dashboards');
    assert.equal(updated.updatedAt, '2026-07-22T10:00:00Z');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('平台 API 不再暴露环境资源操作', () => {
  assert.equal(platformApi.listEnvironments, undefined);
  assert.equal(platformApi.createEnvironment, undefined);
  assert.equal(platformApi.bindEnvironmentResource, undefined);
});
