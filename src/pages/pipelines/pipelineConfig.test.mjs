import test from 'node:test';
import assert from 'node:assert/strict';
import {
  configStatusLabel,
  describeApplyMatrix,
  shortHash,
  sourceTypeLabel,
  summarizeCollectorGroupConfig,
} from './pipelineConfig.ts';

test('汇总 Collector Group 配置状态', () => {
  assert.equal(summarizeCollectorGroupConfig({
    name: 'logs-gateway',
    configVersion: 3,
    lastPublishStatus: 'pending',
    desiredConfigHash: 'abcdef1234567890',
  }), 'logs-gateway · v3 · 待应用 · abcdef12');
});

test('应用矩阵按能力和同步状态汇总', () => {
  assert.deepEqual(describeApplyMatrix([
    { remoteConfigCapable: true, inSync: true },
    { remoteConfigCapable: true, inSync: false },
    { remoteConfigCapable: false, inSync: false },
  ]), {
    total: 3,
    capable: 2,
    inSync: 1,
    label: '1/3 in sync · 2 remote-config capable',
  });
});

test('状态和 hash 展示函数稳定处理空值', () => {
  assert.equal(configStatusLabel('applied'), '已生效');
  assert.equal(configStatusLabel('unknown'), 'unknown');
  assert.equal(shortHash(''), '-');
  assert.equal(shortHash('abcdef123456'), 'abcdef12');
});

test('配置来源类型展示名称稳定', () => {
  assert.equal(sourceTypeLabel('platform_template'), '平台模板');
  assert.equal(sourceTypeLabel('service_pipeline_patch'), '业务解析规则');
  assert.equal(sourceTypeLabel('custom'), 'custom');
});
