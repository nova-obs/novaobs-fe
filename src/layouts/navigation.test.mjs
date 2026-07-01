import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getNavigationByPath,
  getNavigationDomainByPath,
  getNavigationDomains,
} from './navigation.ts';

test('超级菜单按业务域组织现有叶子入口且路径唯一', () => {
  const domains = getNavigationDomains();
  const items = domains.flatMap((domain) => domain.groups.flatMap((group) => flattenLeafItems(group.items)));

  assert.deepEqual(domains.map((domain) => domain.label), [
    '工作台',
    '可观测性',
    'K8s 运维',
    '平台管理',
  ]);
  assert.deepEqual(items.map((item) => item.path), [
    '/',
    '/services',
    '/logs/explore',
    '/logs/agents',
    '/logs/alerts',
    '/logs/endpoints',
    '/monitoring',
    '/traces',
    '/alerts',
    '/k8s',
    '/k8s/access',
    '/platform/settings',
    '/platform/access',
  ]);
  assert.equal(new Set(items.map((item) => item.path)).size, items.length);
});

test('可观测性导航以四大模块为一级，Logs 内收日志子功能', () => {
  const observability = getNavigationDomains().find((domain) => domain.id === 'observability');
  const primaryItems = observability?.groups.flatMap((group) => group.items) ?? [];
  const logs = primaryItems.find((item) => item.id === 'logs');

  assert.deepEqual(primaryItems.map((item) => item.label), ['Logs', '监控', 'Trace', '告警']);
  assert.equal(logs?.path, '/logs');
  assert.deepEqual(logs?.children?.map((item) => item.label), ['日志分析', '采集路由', '日志告警', '接入配置']);
  assert.deepEqual(logs?.children?.map((item) => item.path), ['/logs/explore', '/logs/agents', '/logs/alerts', '/logs/endpoints']);
});

test('K8s 运维导航按默认父模块卡片承载集群入口', () => {
  const k8s = getNavigationDomains().find((domain) => domain.id === 'k8s');
  const primaryItems = k8s?.groups.flatMap((group) => group.items) ?? [];
  const cluster = primaryItems.find((item) => item.id === 'k8s-cluster');

  assert.deepEqual(primaryItems.map((item) => item.label), ['集群']);
  assert.equal(cluster?.path, '/k8s');
  assert.deepEqual(cluster?.children?.map((item) => item.label), ['集群总览', '集群接入']);
  assert.deepEqual(cluster?.children?.map((item) => item.path), ['/k8s', '/k8s/access']);
});

test('根据路径解析当前导航项', () => {
  assert.equal(getNavigationByPath('/logs')?.id, 'logs');
  assert.equal(getNavigationByPath('/logs/agents/new')?.id, 'logs-agents');
  assert.equal(getNavigationByPath('/logs/alerts/new')?.id, 'logs-alerts');
  assert.equal(getNavigationByPath('/logs/endpoints')?.id, 'logs-endpoints');
  assert.equal(getNavigationByPath('/observability/endpoints')?.id, 'logs-endpoints');
  assert.equal(getNavigationByPath('/monitoring')?.id, 'monitoring');
  assert.equal(getNavigationByPath('/traces')?.id, 'traces');
  assert.equal(getNavigationByPath('/platform/settings')?.id, 'platform-settings');
  assert.equal(getNavigationByPath('/platform/access')?.id, 'platform-access');
  assert.equal(getNavigationByPath('/k8s')?.id, 'k8s-fleet');
  assert.equal(getNavigationByPath('/k8s/access')?.id, 'k8s-access');
  assert.equal(getNavigationByPath('/k8s/clusters/prod/namespaces')?.id, 'k8s-fleet');
  assert.equal(getNavigationByPath('/unknown'), undefined);
});

test('根据任意子页面解析当前业务域', () => {
  assert.equal(getNavigationDomainByPath('/services')?.id, 'workspace');
  assert.equal(getNavigationDomainByPath('/logs/agents/new')?.id, 'observability');
  assert.equal(getNavigationDomainByPath('/agents/agent-1')?.id, 'observability');
  assert.equal(getNavigationDomainByPath('/observability/endpoints')?.id, 'observability');
  assert.equal(getNavigationDomainByPath('/monitoring')?.id, 'observability');
  assert.equal(getNavigationDomainByPath('/traces')?.id, 'observability');
  assert.equal(getNavigationDomainByPath('/alerts')?.id, 'observability');
  assert.equal(getNavigationDomainByPath('/k8s/clusters/prod/namespaces')?.id, 'k8s');
  assert.equal(getNavigationDomainByPath('/platform/settings')?.id, 'platform');
  assert.equal(getNavigationDomainByPath('/platform/observability')?.id, 'platform');
  assert.equal(getNavigationDomainByPath('/unknown'), undefined);
});

function flattenLeafItems(items) {
  return items.flatMap((item) => item.children?.length ? flattenLeafItems(item.children) : [item]);
}
