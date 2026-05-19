import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./ServicesPage.tsx', import.meta.url), 'utf8');

test('服务目录展示运行目标及其作用说明', () => {
  assert.equal(source.includes('运行目标的作用'), true);
  assert.equal(source.includes('runningTargetPurposeItems().map'), true);
  assert.equal(source.includes('targetPurposeLabel(target.targetType)'), true);
});
