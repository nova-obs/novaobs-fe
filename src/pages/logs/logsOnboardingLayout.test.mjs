import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./LogsOnboardingPage.tsx', import.meta.url), 'utf8');

test('Logs 接入配置使用任务向导和集群维度工作台', () => {
  assert.equal(source.includes('接入步骤'), true);
  assert.equal(source.includes('可用集群'), true);
  assert.equal(source.includes('K8s 运维 kubeconfig'), true);
  assert.equal(source.includes('logs-onboarding-action-bar'), true);
});

test('Logs 接入配置突出主操作而不是平均铺陈', () => {
  assert.equal(source.includes('下一步动作'), true);
  assert.equal(source.includes('本次接入'), true);
  assert.equal(source.includes('预览配置'), true);
});
