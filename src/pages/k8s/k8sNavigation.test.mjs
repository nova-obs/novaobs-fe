import test from 'node:test';
import assert from 'node:assert/strict';
import { k8sNavigationGroups, k8sNavigationItems, getK8sNavigationByPath } from './navigation.ts';

test('K8s 运维二级导航覆盖核心分组', () => {
  assert.deepEqual(k8sNavigationGroups.map((group) => group.label), [
    '总览',
    '资源',
    '访问控制',
    '交付运维',
    '安全',
  ]);
});

test('K8s 运维二级导航保留 startorch 支持能力入口', () => {
  assert.equal(k8sNavigationItems.find((item) => item.id === 'access-entry')?.label, '集群接入');
  assert.deepEqual(k8sNavigationItems.map((item) => item.path), [
    '/k8s',
    '/k8s/access',
    '/k8s/clusters/:clusterId',
    '/k8s/clusters/:clusterId/namespaces',
    '/k8s/clusters/:clusterId/runtime-topology',
    '/k8s/clusters/:clusterId/credentials',
    '/k8s/clusters/:clusterId/platform-access',
    '/k8s/clusters/:clusterId/service-accounts',
    '/k8s/clusters/:clusterId/rbac',
    '/k8s/clusters/:clusterId/kubeconfig',
    '/k8s/clusters/:clusterId/resource-view',
    '/k8s/clusters/:clusterId/templates',
    '/k8s/clusters/:clusterId/releases',
    '/k8s/clusters/:clusterId/deploy-history',
    '/k8s/clusters/:clusterId/audit',
    '/k8s/clusters/:clusterId/certificates',
    '/k8s/clusters/:clusterId/terminal',
  ]);
});

test('K8s 运维可按子路径定位当前二级导航', () => {
  assert.equal(getK8sNavigationByPath('/k8s')?.id, 'fleet');
  assert.equal(getK8sNavigationByPath('/k8s/access')?.id, 'access-entry');
  assert.equal(getK8sNavigationByPath('/k8s/clusters/test03-02')?.id, 'dashboard');
  assert.equal(getK8sNavigationByPath('/k8s/clusters/test03-02/namespaces')?.id, 'namespaces');
  assert.equal(getK8sNavigationByPath('/k8s/clusters/test03-02/credentials')?.id, 'cluster-credentials');
  assert.equal(getK8sNavigationByPath('/k8s/clusters/test03-02/platform-access')?.id, 'platform-access');
  assert.equal(getK8sNavigationByPath('/k8s/clusters/test03-02/rbac/roles')?.id, 'rbac');
  assert.equal(getK8sNavigationByPath('/k8s/clusters/test03-02/terminal')?.id, 'terminal');
});
