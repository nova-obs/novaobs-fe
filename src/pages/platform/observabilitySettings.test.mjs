import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { endpointOperationProfile, sortEndpointsForList } from './ObservabilitySettingsPage.tsx';

const source = readFileSync(new URL('./ObservabilitySettingsPage.tsx', import.meta.url), 'utf8');

test('日志下游端点列表优先展示配置完整且可操作的端点', () => {
  const registeredClusters = new Set(['prod']);
  const endpoints = [
    {
      id: 'otel-draft',
      name: 'otel-draft',
      sinkType: 'otel',
      scopeType: 'global',
      writeURL: '',
      queryURL: '',
      vmuiURL: '',
      streamName: '',
      clusterId: '',
      accountId: '',
      projectId: '',
      secretRef: '',
      status: 'active',
      updatedAt: '2026-06-28T00:00:00Z',
    },
    {
      id: 'vl-prod',
      name: 'vl-prod',
      sinkType: 'vl',
      scopeType: 'k8s_cluster',
      writeURL: 'http://vl:9428/insert/opentelemetry/v1/logs',
      queryURL: 'http://vl:9428/select/logsql/query',
      vmuiURL: 'http://vl:9428/select/vmui/',
      streamName: '',
      clusterId: 'prod',
      accountId: '100',
      projectId: '200',
      secretRef: 'secret://logs/vl-prod',
      status: 'active',
      updatedAt: '2026-06-27T00:00:00Z',
    },
    {
      id: 'kafka-disabled',
      name: 'kafka-disabled',
      sinkType: 'kafka',
      scopeType: 'vm',
      writeURL: 'kafka-0:9092',
      queryURL: '',
      vmuiURL: '',
      streamName: 'novaobs.logs',
      clusterId: '',
      accountId: '',
      projectId: '',
      secretRef: '',
      status: 'disabled',
      updatedAt: '2026-06-29T00:00:00Z',
    },
  ];

  const ranked = sortEndpointsForList(endpoints, registeredClusters);
  const profile = endpointOperationProfile(endpoints[1], registeredClusters);

  assert.equal(ranked[0].id, 'vl-prod');
  assert.equal(profile.runtimeCapable, true);
  assert.equal(profile.blockers.length, 0);
  assert.equal(profile.scoreLabel, '5/5');
});

test('观测接入配置使用列表、详情抽屉和表单抽屉承载端点操作', () => {
  assert.equal(source.includes('console-table'), true);
  assert.equal(source.includes('EndpointTableRow'), true);
  assert.equal(source.includes('EndpointDetailDrawer'), true);
  assert.equal(source.includes('EndpointEditorDrawer'), true);
  assert.equal(source.includes("role=\"dialog\""), true);
  assert.equal(source.includes('生产配置'), true);
  assert.equal(source.includes('保存后才会更新端点生产配置'), true);
  assert.equal(source.includes('端点排行'), false);
  assert.equal(source.includes('按启用状态、配置完整度和 Runtime 能力排序'), false);
  assert.equal(source.includes('部署 Runtime'), false);
});
