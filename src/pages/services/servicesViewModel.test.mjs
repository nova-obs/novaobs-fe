import test from 'node:test';
import assert from 'node:assert/strict';
import { graphStatItems } from './servicesViewModel.ts';

test('关系统计只包含已落地关系类型', () => {
  const items = graphStatItems({
    agents: [{ instanceUid: 'a1' }, { instanceUid: 'a2' }],
    logRoutes: { total: 2, routes: [{ route: { id: 'p1' } }, { route: { id: 'p2' } }] },
    alertRules: [{ id: 'r1' }],
  });
  assert.deepEqual(items.map((item) => item.label), ['Agent', '日志路由', '告警规则']);
  assert.deepEqual(items.map((item) => item.value), [2, 2, 1]);
});
