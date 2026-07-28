import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./MetricsDashboardPage.tsx', import.meta.url), 'utf8');

test('Dashboard 使用 kiosk iframe 并只保留平台 Dashboard 与 Explore 切换', () => {
  assert.match(source, /console-workbench flex h-full min-h-0/);
  assert.match(source, /src=\{iframeURL\}/);
  assert.match(source, /title="Grafana 工作区"/);
  assert.match(source, /referrerPolicy="strict-origin-when-cross-origin"/);
  assert.doesNotMatch(source, /sandbox=/);
  assert.doesNotMatch(source, /新窗口打开/);
  assert.doesNotMatch(source, /ExternalLink/);
  assert.match(source, />Dashboard</);
  assert.match(source, />Explore</);
  assert.match(source, /aria-pressed=/);
  assert.match(source, /grafanaWorkspaceURL/);
  assert.match(source, /onLoad=/);
  assert.match(source, /加载时间较长/);
  assert.doesNotMatch(source, /<h1/);
});
