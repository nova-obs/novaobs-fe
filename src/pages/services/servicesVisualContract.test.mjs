import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./ServicesPage.tsx', import.meta.url), 'utf8');

test('产品与服务提升为产品主入口并拆分服务详情页面', () => {
	assert.equal(source.includes('<div className="page-header">'), true);
	assert.equal(source.includes('<h1 className="page-title">产品与服务</h1>'), true);
  assert.equal(source.includes('观测关系'), true);
  assert.equal(source.includes('运行目标'), false);
  assert.equal(source.includes('ServiceTarget'), false);
  assert.equal(source.includes('integrationMode'), true);
  assert.equal(source.includes('GrafanaIntegrationPanel'), true);
  assert.equal(source.includes('archiveService'), true);
  assert.equal(source.includes('确认归档服务'), true);
  assert.equal(source.includes('syslog_device'), false);
  assert.equal(source.includes('environmentId: input.environmentId'), false);
});
