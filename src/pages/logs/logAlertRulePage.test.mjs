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

test('告警编辑器使用抽屉标题和底部动作条，不再渲染独立任务页', () => {
  assert.equal(source.includes('export function LogsAlertRuleEditorDrawer'), true);
  assert.equal(source.includes('role="dialog"'), true);
  assert.equal(source.includes('console-drawer-panel'), true);
  assert.equal(source.includes('console-action-bar'), true);
  assert.equal(source.includes('<LogsTaskPageHeader'), false);
  assert.equal(source.includes('logs-task-page'), false);
  assert.equal(source.includes('编辑日志告警'), true);
  assert.equal(source.includes('创建日志告警'), true);
  assert.equal(source.includes('Logs / 日志告警'), false);
  assert.equal(source.includes('实际执行的 LogsQL'), true);
});

test('创建告警使用端点新增同款表单抽屉而不是整页分栏', () => {
  assert.equal(source.includes('function FormCard'), true);
  assert.equal(source.includes('fixed inset-0 z-[90] flex justify-end'), true);
  assert.equal(source.includes('max-w-[760px]'), true);
  assert.equal(source.includes('xl:grid-cols-[minmax(0,960px)_320px]'), false);
  assert.equal(source.includes('sticky top-3 flex min-w-0 flex-col p-4'), false);
  assert.equal(source.includes('overflow-hidden border-y border-outline bg-surface-lowest'), false);
  assert.equal(source.includes('xl:grid-cols-[minmax(0,1fr)_320px]'), false);
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
