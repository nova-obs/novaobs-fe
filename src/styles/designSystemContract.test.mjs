import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const styles = readFileSync(new URL('./index.css', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../layouts/AppShell.tsx', import.meta.url), 'utf8');
const logsWorkspace = readFileSync(new URL('../pages/logs/LogsWorkspace.tsx', import.meta.url), 'utf8');
const dataPanel = readFileSync(new URL('../components/DataPanel.tsx', import.meta.url), 'utf8');
const emptyState = readFileSync(new URL('../components/EmptyState.tsx', import.meta.url), 'utf8');
const statusBadge = readFileSync(new URL('../components/StatusBadge.tsx', import.meta.url), 'utf8');

test('全站提供统一的页面、按钮、提示和空态视觉语义', () => {
  assert.equal(styles.includes('.app-workspace'), true);
  assert.equal(styles.includes('.page-title'), true);
  assert.equal(styles.includes('.console-button'), true);
  assert.equal(styles.includes('.console-button-primary'), true);
  assert.equal(styles.includes('.console-notice-warning'), true);
  assert.equal(styles.includes('.console-notice-danger'), true);
  assert.equal(styles.includes('.console-empty-state'), true);
});

test('应用壳层使用稳定工作区并移除玻璃态白色表面', () => {
  assert.equal(shell.includes('app-workspace'), true);
  assert.equal(shell.includes('shell-toolbar'), true);
  assert.equal(shell.includes('bg-white/55'), false);
  assert.equal(shell.includes('backdrop-blur'), false);
});

test('共享面板、状态和空态组件遵循控制台语义', () => {
  assert.equal(dataPanel.includes('console-panel-header'), true);
  assert.equal(dataPanel.includes('shadow-[0_0_0_4px'), false);
  assert.equal(emptyState.includes('console-empty-state'), true);
  assert.equal(statusBadge.includes('status-badge'), true);
  assert.equal(statusBadge.includes('status-dot'), true);
});

test('全局排版标尺与 prototype 控制台层级一致', () => {
  assert.match(styles, /:root\s*\{[\s\S]*font-size:\s*16px/);
  assert.match(styles, /body\s*\{[\s\S]*font-size:\s*13px[\s\S]*line-height:\s*1\.5/);
  assert.match(styles, /\.page-title\s*\{[\s\S]*font-size:\s*18px/);
  assert.match(styles, /\.console-section-title\s*\{[\s\S]*font-size:\s*16px/);
  assert.match(styles, /\.console-input\s*\{[\s\S]*font-size:\s*13px/);
  assert.match(styles, /\.console-button\s*\{[\s\S]*font-size:\s*13px/);
  assert.match(styles, /\.console-field-label\s*\{[\s\S]*font-size:\s*13px/);
  assert.match(styles, /\.console-table th\s*\{[\s\S]*font-size:\s*13px/);
  assert.match(styles, /\.console-table td\s*\{[\s\S]*font-size:\s*13px/);
  assert.match(logsWorkspace, /px-3 text-sm font-semibold transition-colors/);
});
