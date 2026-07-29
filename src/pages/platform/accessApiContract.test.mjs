import test from 'node:test';
import assert from 'node:assert/strict';
import { accessApi } from './accessApi.ts';

function jsonResponse(data) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({ success: true, data, error: null, meta: {} }),
  };
}

test('访问上下文映射固定平台、产品和 K8s 授权', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse({
    subject: { id: 'user-1', type: 'user', display_name: '开发一组' },
    group_ids: ['developers'],
    platform_admin: false,
    product_accesses: [{ product_id: 'product-1', product_name: '订单', role: 'product-maintainer' }],
    k8s_profiles: [{
      profile_id: 'profile-1',
      name: '订单生产只读',
      cluster_id: 'prod',
      access_level: 'developer',
      namespaces: ['orders'],
      drift_state: 'in_sync',
    }],
    k8s_break_glass: [{
      grant_id: 'break-glass-1',
      cluster_id: 'prod',
      access_level: 'namespace-maintainer',
      expires_at: '2026-07-29T14:00:00Z',
    }],
    modules: { products: 'manage', observability: 'manage', k8s: 'read', platform: 'hidden' },
  });

  try {
    const context = await accessApi.me();
    assert.equal(context.subject.displayName, '开发一组');
    assert.equal(context.groups[0].id, 'developers');
    assert.equal(context.platformAdmin, false);
    assert.equal(context.productAccesses[0].role, 'product-maintainer');
    assert.equal(context.k8sProfiles[0].accessLevel, 'developer');
    assert.deepEqual(context.k8sProfiles[0].namespaces, ['orders']);
    assert.equal(context.k8sProfiles[0].status, 'active');
    assert.equal(context.k8sBreakGlass[0].grantId, 'break-glass-1');
    assert.equal(context.k8sBreakGlass[0].accessLevel, 'namespace-maintainer');
    assert.equal(context.modules.k8s, 'read');
    assert.equal(context.modules.logs, 'manage');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('固定授权 API 使用类型化资源而不是通用 Role 和 Binding', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init });
    if (String(path).endsWith('/sync')) {
      return jsonResponse({ item: { id: 'profile-1', cluster_id: 'prod', access_level: 'developer', namespaces: ['orders'] }, status: 'synced', audit_id: 'audit-sync' });
    }
    return jsonResponse({ item: { id: 'grant-1' }, status: 'created', audit_id: 'audit-1' });
  };

  try {
    await accessApi.createPlatformAdminGrant({ subjectType: 'group', subjectId: 'platform-admins' });
    await accessApi.createProductAccessGrant('product-1', { subjectType: 'group', subjectId: 'orders-dev', role: 'product-viewer' });
    await accessApi.createK8sAccessProfile({
      name: '订单生产只读',
      clusterId: 'prod',
      accessLevel: 'developer',
      namespaces: ['orders'],
      wholeNamespaceConfirmed: true,
    });
    await accessApi.updateK8sAccessProfile('profile-1', {
      name: '订单生产维护',
      accessLevel: 'namespace-maintainer',
      namespaces: ['orders'],
      wholeNamespaceConfirmed: true,
    });
    await accessApi.createK8sAccessGrant({ groupId: 'orders-dev', profileId: 'profile-1' });
    await accessApi.syncK8sAccessProfile('profile-1');

    assert.deepEqual(requests.map((item) => item.path), [
      '/api/v1/platform/admin-grants',
      '/api/v1/products/product-1/access-grants',
      '/api/v1/k8s/access-profiles',
      '/api/v1/k8s/access-profiles/profile-1',
      '/api/v1/k8s/access-grants',
      '/api/v1/k8s/access-profiles/profile-1/sync',
    ]);
    assert.deepEqual(JSON.parse(requests[2].init.body), {
      name: '订单生产只读',
      cluster_id: 'prod',
      access_level: 'developer',
      namespaces: ['orders'],
      whole_namespace_confirmed: true,
    });
    assert.equal(requests[3].init.method, 'PUT');
    assert.deepEqual(JSON.parse(requests[3].init.body), {
      name: '订单生产维护',
      access_level: 'namespace-maintainer',
      namespaces: ['orders'],
      whole_namespace_confirmed: true,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('产品维护者通过产品域接口读取最小授权主体目录', async () => {
  const originalFetch = globalThis.fetch;
  let requestedPath = '';
  globalThis.fetch = async (path) => {
    requestedPath = String(path);
    return jsonResponse([
      { subject_type: 'group', subject_id: 'orders-dev', display_name: '订单开发组' },
      { subject_type: 'service-account', subject_id: 'orders-bot', display_name: '订单发布机器人' },
    ]);
  };

  try {
    const subjects = await accessApi.listProductGrantSubjects('product-1');
    assert.equal(requestedPath, '/api/v1/products/product-1/access-subjects');
    assert.deepEqual(subjects, [
      { subjectType: 'group', subjectId: 'orders-dev', displayName: '订单开发组' },
      { subjectType: 'service-account', subjectId: 'orders-bot', displayName: '订单发布机器人' },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Profile 整 Namespace 确认与 Break Glass 时长在请求边界校验', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('无效输入不应发起网络请求');
  };

  try {
    await assert.rejects(
      () => accessApi.createK8sAccessProfile({
        name: '未确认 Profile',
        clusterId: 'prod',
        accessLevel: 'developer',
        namespaces: ['orders'],
        wholeNamespaceConfirmed: false,
      }),
      /整 Namespace 风险/,
    );
    await assert.rejects(
      () => accessApi.createK8sAccessProfile({
        name: '全局 Profile',
        clusterId: 'prod',
        accessLevel: 'developer',
        namespaces: ['all_namespaces'],
        wholeNamespaceConfirmed: true,
      }),
      /Namespace/,
    );
    await assert.rejects(
      () => accessApi.approveBreakGlassGrant('grant-1', 121),
      /120/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Namespace 影响分析使用平台控制面接口并映射 Product Service 真值', async () => {
  const originalFetch = globalThis.fetch;
  let requestedPath = '';
  globalThis.fetch = async (path) => {
    requestedPath = String(path);
    return jsonResponse([{
      cluster_id: 'prod',
      namespace: 'orders',
      product_id: 'product-1',
      product_name: '订单',
      service_id: 'service-1',
      service_name: '订单服务',
      deployment_id: 'deployment-1',
      deployment_name: '订单生产',
      workload_kind: 'Deployment',
      workload_name: 'orders-api',
    }]);
  };

  try {
    const impacts = await accessApi.listK8sNamespaceImpacts('prod', ['orders', 'payments']);
    assert.equal(requestedPath, '/api/v1/platform/k8s/namespace-impacts?cluster_id=prod&namespace=orders&namespace=payments');
    assert.equal(impacts[0].productName, '订单');
    assert.equal(impacts[0].serviceName, '订单服务');
    assert.equal(impacts[0].workloadName, 'orders-api');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
