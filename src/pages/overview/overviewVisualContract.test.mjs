import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./OverviewPage.tsx', import.meta.url), 'utf8');

test('平台总览使用服务拓扑作为主视觉', () => {
  assert.equal(source.includes('服务拓扑'), true);
  assert.equal(source.includes('用户中心'), true);
  assert.equal(source.includes('支付中心'), true);
  assert.equal(source.includes('订单中心'), true);
  assert.equal(source.includes('库存中心'), true);
  assert.equal(source.includes('消息中心'), true);
  assert.equal(source.includes('UHost'), false);
  assert.equal(source.includes('PathX'), false);
});

test('平台总览展示审计级指标元信息', () => {
  assert.equal(source.includes('VictoriaLogs'), true);
  assert.equal(source.includes('OTel Collector'), true);
  assert.equal(source.includes('15m window'), true);
  assert.equal(source.includes('config a1b2c3d4'), true);
});

test('平台总览包含服务状态和最近告警区域', () => {
  assert.equal(source.includes('服务状态总览'), true);
  assert.equal(source.includes('最近告警'), true);
  assert.equal(source.includes('同步状态'), true);
});
