import test from 'node:test';
import assert from 'node:assert/strict';
import { filterLogs, summarizeLogLevels } from './logFilters.ts';

const logs = [
  { timestamp: '2026-05-07T08:00:00Z', level: 'info', service: 'gateway', environment: 'prod', message: 'ok', traceId: 't1', requestId: 'r1' },
  { timestamp: '2026-05-07T08:01:00Z', level: 'error', service: 'payment-api', environment: 'prod', message: 'charge failed', traceId: 't2', requestId: 'r2' },
  { timestamp: '2026-05-07T08:02:00Z', level: 'warn', service: 'payment-api', environment: 'staging', message: 'slow request', traceId: 't3', requestId: 'r3' },
];

test('按服务、环境、级别和关键字过滤日志', () => {
  const result = filterLogs(logs, {
    service: 'payment-api',
    environment: 'prod',
    level: 'error',
    keyword: 'charge',
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].requestId, 'r2');
});

test('汇总过滤结果中的日志级别', () => {
  assert.deepEqual(summarizeLogLevels(logs), { info: 1, warn: 1, error: 1, debug: 0 });
});
