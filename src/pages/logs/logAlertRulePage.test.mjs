import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./LogsAlertRulePage.tsx', import.meta.url), 'utf8');

test('日志告警使用四步直接启用流程且不引入草稿和强版本概念', () => {
  for (const label of ['匹配日志', '触发条件', '通知对象', '测试并启用']) {
    assert.equal(source.includes(label), true);
  }
  assert.equal(source.includes('草稿'), false);
  assert.equal(source.includes('版本'), false);
  assert.equal(source.includes('发布门禁'), false);
});

test('页面头部只保留一个标题与来源上下文，不重复展示步骤说明', () => {
  assert.equal(source.includes('更新日志告警'), true);
  assert.equal(source.includes('创建日志告警'), true);
  assert.equal(source.includes('Logs / 日志告警'), false);
  assert.equal(source.includes('实际执行的 LogsQL'), true);
});

test('实际 LogsQL 使用黑底白字形成清晰对比', () => {
  assert.equal(source.includes('bg-black'), true);
  assert.equal(source.includes('text-white'), true);
  assert.equal(source.includes('实际执行的 LogsQL'), true);
});

test('规则变化后必须重新测试才能创建或更新', () => {
  assert.equal(source.includes('testedInput === inputSnapshot'), true);
  assert.equal(source.includes('规则内容已变化，请重新测试'), true);
  assert.equal(source.includes('disabled={!testCurrent'), true);
});

test('通知策略来自受管资源下拉而不是自由文本', () => {
  assert.equal(source.includes('api.getNotificationPolicies'), true);
  assert.equal(source.includes('请选择通知策略'), true);
  assert.equal(source.includes('default-webhook'), false);
});
