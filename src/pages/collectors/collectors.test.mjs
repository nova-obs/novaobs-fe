import test from 'node:test';
import assert from 'node:assert/strict';

function modeLabel(mode) {
  return mode === 'shared_gateway' ? '共享 Gateway' : '独立 Collector';
}

function publishLabel(status) {
  const map = { none: '未发布', pending: '待发布', applying: '下发中', applied: '已生效', partial_failed: '部分失败', failed: '失败' };
  return map[status] ?? status;
}

function isGroupReady(group) {
  if (group.status === 'disabled' || group.status === 'draining') return false;
  if ((group.onlineInstances ?? 0) === 0) return false;
  return true;
}

test('mode=shared_gateway 显示为共享 Gateway', () => {
  assert.equal(modeLabel('shared_gateway'), '共享 Gateway');
});

test('mode=dedicated_collector 显示为独立 Collector', () => {
  assert.equal(modeLabel('dedicated_collector'), '独立 Collector');
});

test('publishLabel 映射全部状态', () => {
  assert.equal(publishLabel('none'), '未发布');
  assert.equal(publishLabel('applied'), '已生效');
  assert.equal(publishLabel('failed'), '失败');
  assert.equal(publishLabel('unknown'), 'unknown');
});

test('active group 有在线实例时 isGroupReady 为 true', () => {
  assert.equal(isGroupReady({ status: 'active', onlineInstances: 3 }), true);
});

test('disabled group isGroupReady 为 false', () => {
  assert.equal(isGroupReady({ status: 'disabled', onlineInstances: 3 }), false);
});

test('无在线实例时 isGroupReady 为 false', () => {
  assert.equal(isGroupReady({ status: 'active', onlineInstances: 0 }), false);
});

function findUnassignedAgents(agents, instanceUids) {
  return agents.filter((a) => !a.collectorGroupId);
}

test('filter agents without groupId as unassigned', () => {
  const agents = [
    { instanceUid: 'a1', collectorGroupId: 'g1' },
    { instanceUid: 'a2', collectorGroupId: '' },
    { instanceUid: 'a3', collectorGroupId: null },
  ];
  const result = findUnassignedAgents(agents, new Set(['a1']));
  assert.equal(result.length, 2);
  assert.equal(result[0].instanceUid, 'a2');
});

function computeRuntimeStatus(lastSeenAt) {
  if (!lastSeenAt) return { runtimeStatus: 'offline', lastSeenAgeSeconds: Infinity };
  const age = (Date.now() - new Date(lastSeenAt).getTime()) / 1000;
  if (age <= 60) return { runtimeStatus: 'online', lastSeenAgeSeconds: Math.round(age) };
  if (age <= 300) return { runtimeStatus: 'stale', lastSeenAgeSeconds: Math.round(age) };
  return { runtimeStatus: 'offline', lastSeenAgeSeconds: Math.round(age) };
}

function runtimeStatusLabel(s) { const m = { online: '在线', stale: '心跳超时', offline: '离线' }; return m[s] ?? s; }
function runtimeStatusColor(s) { if (s === 'online') return 'text-emerald-400'; if (s === 'stale') return 'text-amber-400'; return 'text-muted'; }

test('无 lastSeenAt 时 status 为 offline', () => {
  assert.equal(computeRuntimeStatus('').runtimeStatus, 'offline');
  assert.equal(computeRuntimeStatus('').lastSeenAgeSeconds, Infinity);
});

test('lastSeenAt 在 60s 内为 online', () => {
  const recent = new Date(Date.now() - 30 * 1000).toISOString();
  assert.equal(computeRuntimeStatus(recent).runtimeStatus, 'online');
});

test('lastSeenAt 在 60-300s 之间为 stale', () => {
  const stale = new Date(Date.now() - 120 * 1000).toISOString();
  assert.equal(computeRuntimeStatus(stale).runtimeStatus, 'stale');
});

test('lastSeenAt 超过 300s 为 offline', () => {
  const old = new Date(Date.now() - 400 * 1000).toISOString();
  assert.equal(computeRuntimeStatus(old).runtimeStatus, 'offline');
});

test('runtimeStatusLabel 返回中文', () => {
  assert.equal(runtimeStatusLabel('online'), '在线');
  assert.equal(runtimeStatusLabel('stale'), '心跳超时');
  assert.equal(runtimeStatusLabel('offline'), '离线');
});

test('runtimeStatusColor 返回对应颜色', () => {
  assert.equal(runtimeStatusColor('online'), 'text-emerald-400');
  assert.equal(runtimeStatusColor('stale'), 'text-amber-400');
  assert.equal(runtimeStatusColor('offline'), 'text-muted');
});
