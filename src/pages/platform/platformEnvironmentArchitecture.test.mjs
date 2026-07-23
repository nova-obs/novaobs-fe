import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const routesSource = readFileSync(new URL('../../app/routes.tsx', import.meta.url), 'utf8');
const layoutSource = readFileSync(new URL('./PlatformLayout.tsx', import.meta.url), 'utf8');

test('平台管理不再提供环境领域入口', () => {
  assert.doesNotMatch(routesSource, /PlatformEnvironmentsPage|path: 'environments'/);
  assert.doesNotMatch(layoutSource, /\/platform\/environments|环境管理/);
});
