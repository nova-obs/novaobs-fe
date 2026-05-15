import test from 'node:test';
import assert from 'node:assert/strict';
import { getOnboardingDomains } from './onboardingDomains.ts';

test('服务接入总入口覆盖日志、告警、监控三个接入域', () => {
  assert.deepEqual(getOnboardingDomains().map((domain) => domain.id), ['logs', 'alerts', 'metrics']);
});

test('日志接入入口归属 Logs / Pipelines / Config', () => {
  const logs = getOnboardingDomains().find((domain) => domain.id === 'logs');
  assert.equal(logs?.path, '/logs?tab=pipelines&section=config');
  assert.equal(logs?.status, 'available');
});

test('告警和监控接入不再复用日志 pipeline 状态', () => {
  const planned = getOnboardingDomains().filter((domain) => domain.id !== 'logs');
  assert.ok(planned.every((domain) => domain.status === 'planned'));
});
