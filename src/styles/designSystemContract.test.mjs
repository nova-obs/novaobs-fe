import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const styles = readFileSync(new URL('./index.css', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../layouts/AppShell.tsx', import.meta.url), 'utf8');
const logsWorkspace = readFileSync(new URL('../pages/logs/LogsWorkspace.tsx', import.meta.url), 'utf8');
const dataPanel = readFileSync(new URL('../components/DataPanel.tsx', import.meta.url), 'utf8');
const emptyState = readFileSync(new URL('../components/EmptyState.tsx', import.meta.url), 'utf8');
const statusBadge = readFileSync(new URL('../components/StatusBadge.tsx', import.meta.url), 'utf8');
const k8sLayout = readFileSync(new URL('../pages/k8s/K8sOpsLayout.tsx', import.meta.url), 'utf8');
const platformLayout = readFileSync(new URL('../pages/platform/PlatformLayout.tsx', import.meta.url), 'utf8');

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
  assert.equal(shell.includes('content-workbench-frame'), true);
  assert.equal(styles.includes('.content-workbench-frame'), true);
  assert.equal(styles.includes('.content-workbench-header'), true);
  assert.equal(styles.includes('.content-workbench-primary'), true);
  assert.equal(styles.includes('.content-workbench-back'), true);
  assert.equal(styles.includes('.content-workbench-body'), true);
  assert.equal(shell.includes('mega-menu-panel'), true);
  assert.equal(shell.includes('mega-menu-backdrop'), true);
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

test('模块导航统一标题边界、文字基线和激活位置', () => {
  for (const source of [logsWorkspace, k8sLayout, platformLayout]) {
    assert.match(source, /module-navigation-bar/);
    assert.match(source, /module-navigation-title/);
    assert.match(source, /module-navigation-tabs/);
    assert.match(source, /module-navigation-link/);
  }
  assert.match(styles, /\.module-navigation-title\s*\{[\s\S]*border-right/);
  assert.match(styles, /\.module-navigation-link\s*\{[\s\S]*min-height:\s*40px/);
  assert.match(styles, /\.module-navigation-bar\s*\{[\s\S]*background:\s*linear-gradient/);
  assert.match(styles, /\.module-navigation-title\s*\{[\s\S]*font-size:\s*16px/);
  assert.match(styles, /\.module-navigation-link,[\s\S]*\.k8s-context-navigation \.console-input\s*\{[\s\S]*font-size:\s*13px/);
  assert.match(styles, /\.k8s-context-navigation\s*\{[\s\S]*overflow:\s*visible/);
});
