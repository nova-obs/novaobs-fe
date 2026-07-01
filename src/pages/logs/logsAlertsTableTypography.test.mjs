import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./LogsAlertsPage.tsx', import.meta.url), 'utf8');

test('日志告警列表明确区分表头与表格内容字号', () => {
  assert.match(source, /<table className="console-table logs-alert-rules-table/);
  assert.match(source, /<thead className="\[&>tr>th\]:text-\[13px\] \[&>tr>th\]:font-semibold"/);
  assert.match(source, /<tbody className="\[&>tr>td\]:text-\[11px\]"/);
  assert.doesNotMatch(source, /LogsAlertRuleInspector/);
  assert.doesNotMatch(source, /console-split-workbench/);
  assert.doesNotMatch(source, /console-detail-rail console-inspector/);
  assert.doesNotMatch(source, /console-selected-row/);
  assert.doesNotMatch(source, /日志告警详情/);
});
