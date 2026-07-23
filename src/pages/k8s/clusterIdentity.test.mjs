import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findSameNameClusterReplacement,
  formatClusterIdentity,
  resolveObservabilityClusterId,
  resolvePersistedRouteClusterId,
} from './clusterIdentity.ts';

const clusters = [
  { id: 'calico-arm', name: 'calico-arm' },
  { id: 'test03', name: 'calico-test03-02' },
];

test('观测接入没有 URL 集群上下文时使用当前登记列表，而不保留旧页面选择', () => {
  assert.equal(resolveObservabilityClusterId('', '', clusters), 'calico-arm');
});

test('观测接入只按集群 ID 精确解析 URL，不把同名登记静默当成同一身份', () => {
  assert.equal(resolveObservabilityClusterId('', 'calico-test03-02', clusters), 'calico-test03-02');
  assert.deepEqual(findSameNameClusterReplacement('calico-test03-02', clusters), clusters[1]);
});

test('集群选择项同时展示名称和不可混淆的 ID', () => {
  assert.equal(formatClusterIdentity(clusters[0]), 'calico-arm');
  assert.equal(formatClusterIdentity(clusters[1]), 'calico-test03-02 · ID: test03');
});

test('日志路由保存后以服务端返回的持久化集群 ID 进入观测接入', () => {
  assert.equal(resolvePersistedRouteClusterId({ clusterId: 'test03' }, 'calico-test03-02'), 'test03');
  assert.equal(resolvePersistedRouteClusterId(null, 'test03'), 'test03');
});
