import test from 'node:test';
import assert from 'node:assert/strict';

function sourceLabel(source) {
  if (source === 'k8s') return 'K8s 同步';
  return source === 'cmdb' ? 'CMDB' : '本地录入';
}

function syncLabel(status) {
  return status === 'synced' ? '已同步' : '本地';
}

function hasActiveFilters(filters) {
  return !!(filters.q || filters.environment || filters.status || filters.source);
}

test('source=manual 显示为本地录入', () => {
  assert.equal(sourceLabel('manual'), '本地录入');
});

test('source=cmdb 显示为 CMDB', () => {
  assert.equal(sourceLabel('cmdb'), 'CMDB');
});

test('source=k8s 显示为 K8s 同步', () => {
  assert.equal(sourceLabel('k8s'), 'K8s 同步');
});

test('sync_status=local 显示为本地', () => {
  assert.equal(syncLabel('local'), '本地');
});

test('sync_status=synced 显示为已同步', () => {
  assert.equal(syncLabel('synced'), '已同步');
});

test('空 filter 对象无激活筛选', () => {
  assert.equal(hasActiveFilters({ q: '', environment: '', status: '', source: '' }), false);
});

test('有 q 时判定为激活筛选', () => {
  assert.equal(hasActiveFilters({ q: 'payment', environment: '', status: '', source: '' }), true);
});

test('有 environment 时判定为激活筛选', () => {
  assert.equal(hasActiveFilters({ q: '', environment: 'prod', status: '', source: '' }), true);
});
