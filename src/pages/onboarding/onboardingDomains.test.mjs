import test from 'node:test';
import assert from 'node:assert/strict';
import { getOnboardingDomains } from './onboardingDomains.ts';

test('服务接入总入口只展示当前可用接入域', () => {
  assert.deepEqual(getOnboardingDomains().map((domain) => domain.id), ['logs']);
});

test('日志接入入口归属采集路由创建任务', () => {
  const logs = getOnboardingDomains().find((domain) => domain.id === 'logs');
  assert.equal(logs?.path, '/logs/agents/new');
  assert.equal(logs?.status, 'available');
});

test('服务接入不展示规划中入口', () => {
  assert.equal(getOnboardingDomains().some((domain) => domain.status === 'planned'), false);
});
