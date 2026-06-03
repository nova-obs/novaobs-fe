import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./ServicesPage.tsx', import.meta.url), 'utf8');

test('服务目录展示业务关系，不展示运行目标说明卡', () => {
  assert.equal(source.includes('观测关系'), true);
  assert.equal(source.includes('运行目标的作用'), false);
  assert.equal(source.includes('runningTargetPurposeItems().map'), false);
  assert.equal(source.includes('targetPurposeLabel(target.targetType)'), false);
  assert.equal(source.includes('服务清单为空'), true);
  assert.equal(source.includes('confirmDeleteServiceId'), true);
  assert.equal(source.includes('deleteService'), true);
  assert.equal(source.includes('确认删除服务'), true);
  assert.equal(source.includes('syslog_device'), false);
  assert.equal(source.includes('Syslog 设备'), false);
});
