import test from 'node:test';
import assert from 'node:assert/strict';
import { k8sNavigationGroups, k8sNavigationItems, getK8sNavigationByPath, getVisibleK8sNavigationItems } from './navigation.ts';

const baseAccess = {
  subject: { id: 'user-1', type: 'user', displayName: '用户' },
  groups: [],
  platformAdmin: false,
  productAccesses: [],
  k8sProfiles: [],
  modules: {},
};

test('K8s 运维二级导航覆盖核心分组', () => {
  assert.deepEqual(k8sNavigationGroups.map((group) => group.label), [
    '总览',
    '资源',
    '交付运维',
    '安全',
  ]);
});

test('K8s 运维二级导航只保留 Profile 可用的业务能力', () => {
  assert.equal(k8sNavigationItems.some((item) => item.id === 'access-entry'), false);
  assert.equal(k8sNavigationItems.some((item) => item.path === '/k8s/access'), false);
  assert.equal(k8sNavigationItems.some((item) => item.id === 'observability-entry'), false);
  assert.deepEqual(k8sNavigationItems.map((item) => item.path), [
    '/k8s',
    '/k8s/clusters/:clusterId',
    '/k8s/clusters/:clusterId/namespaces',
    '/k8s/clusters/:clusterId/runtime-topology',
    '/k8s/clusters/:clusterId/resource-view',
    '/k8s/clusters/:clusterId/releases',
    '/k8s/clusters/:clusterId/deploy-history',
    '/k8s/clusters/:clusterId/audit',
    '/k8s/clusters/:clusterId/terminal',
  ]);
});

test('K8s 运维可按子路径定位当前二级导航', () => {
  assert.equal(getK8sNavigationByPath('/k8s')?.id, 'fleet');
  assert.equal(getK8sNavigationByPath('/k8s/access'), undefined);
  assert.equal(getK8sNavigationByPath('/k8s/observability'), undefined);
  assert.equal(getK8sNavigationByPath('/k8s/clusters/test03-02')?.id, 'dashboard');
  assert.equal(getK8sNavigationByPath('/k8s/clusters/test03-02/namespaces')?.id, 'namespaces');
  assert.equal(getK8sNavigationByPath('/k8s/clusters/test03-02/credentials'), undefined);
  assert.equal(getK8sNavigationByPath('/k8s/clusters/test03-02/platform-access'), undefined);
  assert.equal(getK8sNavigationByPath('/k8s/clusters/test03-02/rbac/roles'), undefined);
  assert.equal(getK8sNavigationByPath('/k8s/clusters/test03-02/terminal')?.id, 'terminal');
});

test('K8s 导航按当前集群 Developer、Maintainer 和平台管理员能力过滤', () => {
  const developer = {
    ...baseAccess,
    k8sProfiles: [{ id: 'dev', name: '', clusterId: 'prod', accessLevel: 'developer', namespaces: ['orders'], impersonationGroup: '', status: 'active', driftState: 'in-sync' }],
  };
  const maintainer = {
    ...baseAccess,
    k8sProfiles: [{ id: 'maintainer', name: '', clusterId: 'prod', accessLevel: 'namespace-maintainer', namespaces: ['orders'], impersonationGroup: '', status: 'active', driftState: 'in-sync' }],
  };
  const admin = { ...baseAccess, platformAdmin: true };

  const developerIds = getVisibleK8sNavigationItems(developer, 'prod').map((item) => item.id);
  const maintainerIds = getVisibleK8sNavigationItems(maintainer, 'prod').map((item) => item.id);
  const adminIds = getVisibleK8sNavigationItems(admin, 'prod').map((item) => item.id);

  assert.equal(developerIds.includes('resource-view'), true);
  assert.equal(developerIds.includes('releases'), false);
  assert.equal(developerIds.includes('terminal'), false);
  assert.equal(maintainerIds.includes('releases'), true);
  assert.equal(maintainerIds.includes('terminal'), true);
  assert.deepEqual(adminIds, []);
  assert.equal(adminIds.includes('resource-view'), false);
});
