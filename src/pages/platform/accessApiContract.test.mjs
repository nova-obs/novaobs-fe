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
    available_modules: ['workspace', 'observability', 'k8s'],
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
    assert.deepEqual(context.availableModules, ['workspace', 'observability', 'k8s']);
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
    await accessApi.createProductAccessGrant('product-1', { groupId: 'orders-dev', role: 'product-viewer' });
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
      '/api/v1/platform/products/product-1/access-grants',
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

test('平台管理员通过单一平台接口读取全部产品授权关系', async () => {
  const originalFetch = globalThis.fetch;
  let requestedPath = '';
  globalThis.fetch = async (path) => {
    requestedPath = String(path);
    return jsonResponse([{
      id: 'product:orders:group:orders-dev',
      product_id: 'orders',
      group_id: 'orders-dev',
      role: 'product-maintainer',
      created_by: 'admin',
      created_at: '2026-07-30T08:00:00Z',
      updated_by: 'admin-2',
      updated_at: '2026-07-31T09:00:00Z',
    }]);
  };

  try {
    const grants = await accessApi.listProductAccessGrantsForAdministration();
    assert.equal(requestedPath, '/api/v1/platform/product-access-grants');
    assert.deepEqual(grants, [{
      id: 'product:orders:group:orders-dev',
      productId: 'orders',
      groupId: 'orders-dev',
      role: 'product-maintainer',
      createdBy: 'admin',
      createdAt: '2026-07-30T08:00:00Z',
      updatedBy: 'admin-2',
      updatedAt: '2026-07-31T09:00:00Z',
    }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('产品访问授权创建与修改使用不同的写入语义', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path: String(path), init });
    return jsonResponse({
      item: {
        id: 'product:orders:group:orders-dev',
        product_id: 'orders',
        group_id: 'orders-dev',
        role: 'product-maintainer',
      },
      status: 'saved',
    });
  };

  try {
    await accessApi.createProductAccessGrant('orders', {
      groupId: 'orders-dev',
      role: 'product-viewer',
    });
    await accessApi.updateProductAccessGrant(
      'orders',
      'product:orders:group:orders-dev',
      'product-maintainer',
    );

    assert.equal(requests[0].path, '/api/v1/platform/products/orders/access-grants');
    assert.equal(requests[0].init.method, 'POST');
    assert.deepEqual(JSON.parse(requests[0].init.body), {
      group_id: 'orders-dev',
      role: 'product-viewer',
    });
    assert.equal(
      requests[1].path,
      '/api/v1/platform/products/orders/access-grants/product%3Aorders%3Agroup%3Aorders-dev',
    );
    assert.equal(requests[1].init.method, 'PUT');
    assert.deepEqual(JSON.parse(requests[1].init.body), {
      role: 'product-maintainer',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('命名空间权限风险确认与紧急访问时长在请求边界校验', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('无效输入不应发起网络请求');
  };

  try {
    await assert.rejects(
      () => accessApi.createK8sAccessProfile({
        name: '未确认权限',
        clusterId: 'prod',
        accessLevel: 'developer',
        namespaces: ['orders'],
        wholeNamespaceConfirmed: false,
      }),
      /整命名空间风险/,
    );
    await assert.rejects(
      () => accessApi.createK8sAccessProfile({
        name: '全局权限',
        clusterId: 'prod',
        accessLevel: 'developer',
        namespaces: ['all_namespaces'],
        wholeNamespaceConfirmed: true,
      }),
      /命名空间/,
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
