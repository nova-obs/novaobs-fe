import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getNavigationByPath,
  getNavigationDomainByPath,
  getNavigationDomains,
} from './navigation.ts';

test('超级菜单按业务域组织现有模块且路径唯一', () => {
  const domains = getNavigationDomains();
  const items = domains.flatMap((domain) => domain.groups.flatMap((group) => group.items));

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
    '/monitoring',
    '/alerts',
    '/k8s',
    '/k8s/access',
    '/platform/access',
    '/platform/observability',
  ]);
  assert.equal(new Set(items.map((item) => item.path)).size, items.length);
});

test('根据路径解析当前导航项', () => {
  assert.equal(getNavigationByPath('/logs/agents/new')?.id, 'logs-agents');
  assert.equal(getNavigationByPath('/logs/alerts/new')?.id, 'logs-alerts');
  assert.equal(getNavigationByPath('/monitoring')?.id, 'monitoring');
  assert.equal(getNavigationByPath('/platform/access')?.id, 'platform-access');
  assert.equal(getNavigationByPath('/platform/observability')?.id, 'platform-observability');
  assert.equal(getNavigationByPath('/k8s/clusters/prod/namespaces')?.id, 'k8s-fleet');
  assert.equal(getNavigationByPath('/unknown'), undefined);
});

test('根据任意子页面解析当前业务域', () => {
  assert.equal(getNavigationDomainByPath('/services')?.id, 'workspace');
  assert.equal(getNavigationDomainByPath('/logs/agents/new')?.id, 'observability');
  assert.equal(getNavigationDomainByPath('/agents/agent-1')?.id, 'observability');
  assert.equal(getNavigationDomainByPath('/monitoring')?.id, 'observability');
  assert.equal(getNavigationDomainByPath('/alerts')?.id, 'observability');
  assert.equal(getNavigationDomainByPath('/k8s/clusters/prod/namespaces')?.id, 'k8s');
  assert.equal(getNavigationDomainByPath('/platform/observability')?.id, 'platform');
  assert.equal(getNavigationDomainByPath('/unknown'), undefined);
});
