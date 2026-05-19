import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const layoutSource = readFileSync(new URL('./K8sOpsLayout.tsx', import.meta.url), 'utf8');
const dashboardSource = readFileSync(new URL('./DashboardPage.tsx', import.meta.url), 'utf8');
const navigationSource = readFileSync(new URL('./navigation.ts', import.meta.url), 'utf8');
const clusterSource = readFileSync(new URL('./ClusterPage.tsx', import.meta.url), 'utf8');
const namespaceSource = readFileSync(new URL('./NamespacePage.tsx', import.meta.url), 'utf8');
const resourceSource = readFileSync(new URL('./ResourcePage.tsx', import.meta.url), 'utf8');

test('K8s 运维模块使用专业二级导航和运维信号', () => {
  assert.equal(layoutSource.includes('K8s 运维'), true);
  assert.equal(layoutSource.includes('Prod / CN-SHANGHAI-A'), true);
  assert.equal(navigationSource.includes('访问控制'), true);
  assert.equal(navigationSource.includes('证书中心'), true);
});

test('K8s Dashboard 展示来源、时间窗口、同步和审计上下文', () => {
  assert.equal(dashboardSource.includes('startorch'), true);
  assert.equal(dashboardSource.includes('最近 15 分钟'), true);
  assert.equal(dashboardSource.includes('配置状态'), true);
  assert.equal(dashboardSource.includes('操作审计'), true);
});

test('K8s 集群页面展示集群连接和来源上下文', () => {
  assert.equal(clusterSource.includes('集群列表'), true);
  assert.equal(clusterSource.includes('startorch'), true);
  assert.equal(clusterSource.includes('/api/v1/k8s/clusters'), true);
});

test('K8s 命名空间页面展示集群、来源和权限上下文', () => {
  assert.equal(namespaceSource.includes('命名空间列表'), true);
  assert.equal(namespaceSource.includes('cluster/prod'), true);
  assert.equal(namespaceSource.includes('NovaObs RBAC'), true);
  assert.equal(namespaceSource.includes('/api/v1/k8s/namespaces'), true);
});

test('K8s 资源页面展示完整资源身份字段', () => {
  assert.equal(resourceSource.includes('资源视图'), true);
  assert.equal(resourceSource.includes('API Version'), true);
  assert.equal(resourceSource.includes('UID'), true);
  assert.equal(resourceSource.includes('cluster/ns/api/kind/name/uid'), true);
});
