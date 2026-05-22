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
  assert.deepEqual(k8sNavigationItems.map((item) => item.path), [
    '/k8s',
    '/k8s/clusters',
    '/k8s/namespaces',
    '/k8s/runtime-topology',
    '/k8s/platform-access',
    '/k8s/service-accounts',
    '/k8s/rbac',
    '/k8s/kubeconfig',
    '/k8s/resource-view',
    '/k8s/templates',
    '/k8s/releases',
    '/k8s/deploy-history',
    '/k8s/audit',
    '/k8s/certificates',
    '/k8s/terminal',
  ]);
});

test('K8s 运维可按子路径定位当前二级导航', () => {
  assert.equal(getK8sNavigationByPath('/k8s')?.id, 'dashboard');
  assert.equal(getK8sNavigationByPath('/k8s/namespaces')?.id, 'namespaces');
  assert.equal(getK8sNavigationByPath('/k8s/platform-access')?.id, 'platform-access');
  assert.equal(getK8sNavigationByPath('/k8s/rbac/roles')?.id, 'rbac');
  assert.equal(getK8sNavigationByPath('/k8s/terminal')?.id, 'terminal');
});
