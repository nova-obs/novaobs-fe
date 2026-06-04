import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./OverviewPage.tsx', import.meta.url), 'utf8');

test('平台总览不展示硬编码业务数据', () => {
  assert.equal(source.includes('服务目录快照'), true);
  assert.equal(source.includes('用户中心'), false);
  assert.equal(source.includes('支付中心'), false);
  assert.equal(source.includes('订单中心'), false);
  assert.equal(source.includes('库存中心'), false);
  assert.equal(source.includes('消息中心'), false);
  assert.equal(source.includes('UHost'), false);
  assert.equal(source.includes('PathX'), false);
});

test('平台总览展示审计级指标元信息', () => {
  assert.equal(source.includes('日志下游'), true);
  assert.equal(source.includes('OTel Collector'), true);
  assert.equal(source.includes('最近 15 分钟'), true);
  assert.equal(source.includes('config a1b2c3d4'), false);
  assert.equal(source.includes('98.2%'), false);
});

test('平台总览包含服务、告警和组件状态区域', () => {
  assert.equal(source.includes('服务目录快照'), true);
  assert.equal(source.includes('告警规则'), true);
  assert.equal(source.includes('观测链路'), true);
  assert.equal(source.includes('同步'), true);
});
