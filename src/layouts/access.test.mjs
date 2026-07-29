import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accessAllows,
  hasBreakGlassAccess,
  k8sAccessLevelForCluster,
  k8sNamespacesForLevel,
  platformAccessQueryKey,
} from './access.tsx';

const base = {
  subject: { id: 'user-1', type: 'user', displayName: '开发用户' },
  groups: [],
  platformAdmin: false,
  productAccesses: [],
  k8sProfiles: [],
  k8sBreakGlass: [],
  modules: {},
};

test('K8s 权限按当前集群计算且 maintainer 包含 developer', () => {
  const context = {
    ...base,
    k8sProfiles: [
      { id: 'p1', name: '生产只读', clusterId: 'prod', accessLevel: 'developer', namespaces: ['orders'], impersonationGroup: '', status: 'active', driftState: 'in-sync' },
      { id: 'p2', name: '测试维护', clusterId: 'test', accessLevel: 'namespace-maintainer', namespaces: ['orders-test'], impersonationGroup: '', status: 'active', driftState: 'in-sync' },
    ],
  };

  assert.equal(k8sAccessLevelForCluster(context, 'prod'), 'developer');
  assert.equal(k8sAccessLevelForCluster(context, 'test'), 'namespace-maintainer');
  assert.equal(accessAllows(context, { kind: 'k8s', clusterId: 'prod', minimum: 'namespace-maintainer' }), false);
  assert.equal(accessAllows(context, { kind: 'k8s', clusterId: 'test', minimum: 'developer' }), true);
  assert.equal(accessAllows(context, { kind: 'k8s', clusterId: 'missing', minimum: 'developer' }), false);
});

test('写操作命名空间只取 Maintainer Profile，不能被同集群 Developer 范围抬升', () => {
  const context = {
    ...base,
    k8sProfiles: [
      { id: 'p1', name: '订单只读', clusterId: 'prod', accessLevel: 'developer', namespaces: ['orders'], impersonationGroup: '', status: 'active', driftState: 'in-sync' },
      { id: 'p2', name: '支付维护', clusterId: 'prod', accessLevel: 'namespace-maintainer', namespaces: ['payments'], impersonationGroup: '', status: 'active', driftState: 'in-sync' },
    ],
  };

  assert.deepEqual(k8sNamespacesForLevel(context, 'prod', 'developer'), ['orders', 'payments']);
  assert.deepEqual(k8sNamespacesForLevel(context, 'prod', 'namespace-maintainer'), ['payments']);
});

test('有效 Break Glass 临时开放目标集群 Maintainer 能力', () => {
  const context = {
    ...base,
    k8sBreakGlass: [{
      grantId: 'grant-1',
      clusterId: 'prod',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      accessLevel: 'namespace-maintainer',
    }],
  };

  assert.equal(hasBreakGlassAccess(context, 'prod'), true);
  assert.equal(accessAllows(context, { kind: 'k8s-module' }), true);
  assert.equal(accessAllows(context, { kind: 'k8s', clusterId: 'prod', minimum: 'namespace-maintainer' }), true);
});

test('平台管理员不会隐式获得产品和 K8s 业务权限', () => {
  const context = { ...base, platformAdmin: true, modules: { platform: 'manage' } };

  assert.equal(accessAllows(context, { kind: 'platform-admin' }), true);
  assert.equal(accessAllows(context, { kind: 'product', productId: 'product-1', minimum: 'product-viewer' }), false);
  assert.equal(accessAllows(context, { kind: 'k8s', clusterId: 'prod', minimum: 'developer' }), false);
  assert.equal(accessAllows(context, { kind: 'k8s-module' }), false);
});

test('访问上下文缓存按登录主体隔离', () => {
  assert.deepEqual(platformAccessQueryKey('user-1'), ['platform-me', 'user-1']);
  assert.notDeepEqual(platformAccessQueryKey('user-1'), platformAccessQueryKey('user-2'));
});
