import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const layoutSource = readFileSync(new URL('./PlatformLayout.tsx', import.meta.url), 'utf8');
const observabilitySource = readFileSync(new URL('./ObservabilitySettingsPage.tsx', import.meta.url), 'utf8');

test('平台管理模块提供访问控制和观测接入配置入口', () => {
  assert.equal(layoutSource.includes('/platform/access'), true);
  assert.equal(layoutSource.includes('/platform/observability'), true);
  assert.equal(layoutSource.includes('访问控制'), true);
  assert.equal(layoutSource.includes('观测接入配置'), true);
  assert.equal(layoutSource.includes('平台管理导航'), true);
  assert.equal(layoutSource.includes('<aside'), false);
  assert.equal(layoutSource.includes('xl:grid-cols-[248px'), false);
});

test('观测接入配置先集中维护日志下游端点', () => {
  assert.equal(observabilitySource.includes("queryKey: ['logs-endpoints']"), true);
  assert.equal(observabilitySource.includes('logsApi.listEndpoints'), true);
  assert.equal(observabilitySource.includes('logsApi.createEndpoint'), true);
  assert.equal(observabilitySource.includes('logsApi.updateEndpoint'), true);
  assert.equal(observabilitySource.includes('日志下游端点'), true);
  assert.equal(observabilitySource.includes('新增日志下游端点'), true);
  assert.equal(observabilitySource.includes('编辑日志下游端点'), true);
  assert.equal(observabilitySource.includes('AccountID'), true);
  assert.equal(observabilitySource.includes('ProjectID'), true);
  assert.equal(observabilitySource.includes('生成租户 ID'), true);
  assert.equal(observabilitySource.includes('ClusterCollectorConfigPanel'), false);
  assert.equal(observabilitySource.includes('集群 Collector 基础配置'), false);
  assert.equal(observabilitySource.includes('logsApi.getClusterConfig'), false);
  assert.equal(observabilitySource.includes('logsApi.upsertClusterConfig'), false);
});
