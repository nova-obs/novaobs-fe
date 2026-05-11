import test from 'node:test';
import assert from 'node:assert/strict';

const workspaceNotStarted = {
  service: { id: 'svc-1', name: 'payment-api', environment: 'prod', cluster: 'cn-a', namespace: 'pay', status: 'active' },
  onboarding: { status: 'not_started', mode: 'shared_gateway' },
  identity: null,
  collectorTarget: { groupId: 'cg-1', name: 'shared-gw-prod', status: 'active', onlineInstances: 3, healthyInstances: 3 },
  generatedConfig: { endpoint: '', resourceAttributes: {}, resourceAttributesText: '', kubernetesLabels: {}, environmentVariables: {}, envBlock: '', otelCollectorHint: '', codeSamples: {} },
  checklist: [],
  lastCheck: null,
  availableActions: ['save'],
};

const workspaceVerified = {
  ...workspaceNotStarted,
  onboarding: { ...workspaceNotStarted.onboarding, status: 'verified' },
  identity: { id: 'id-1', identityType: 'k8s_workload', enabled: true, tokenPresent: false },
  generatedConfig: { ...workspaceNotStarted.generatedConfig, endpoint: 'https://observe-gateway.internal:4318', resourceAttributesText: 'service.name=payment-api', envBlock: 'OTEL_SERVICE_NAME=payment-api' },
  checklist: [
    { key: 'service_metadata', name: '服务元数据', status: 'passed', blocking: true, message: '' },
    { key: 'identity_bound', name: '身份绑定', status: 'passed', blocking: true, message: '' },
    { key: 'collector_online', name: 'Collector 在线', status: 'passed', blocking: true, message: '3/3 online' },
    { key: 'log_signal_seen', name: '日志信号', status: 'warning', blocking: false, message: '暂未检测到日志' },
  ],
  lastCheck: { status: 'verified', message: '', checkedAt: '2026-05-08T10:00:00Z', details: [] },
  availableActions: ['check'],
};

function deriveWorkspaceView(workspace) {
  const { onboarding, checklist } = workspace;
  if (!onboarding || onboarding.status === 'not_started') return 'not_started';
  if (onboarding.status === 'verified') return 'verified';
  if (onboarding.status === 'failed') return 'failed';
  const blockingFailed = checklist.some((item) => item.blocking && item.status === 'failed');
  if (blockingFailed) return 'failed';
  return 'pending_verification';
}

function countChecklistByStatus(checklist, status) {
  return checklist.filter((item) => item.status === status).length;
}

test('not_started workspace 视图状态为 not_started', () => {
  assert.equal(deriveWorkspaceView(workspaceNotStarted), 'not_started');
});

test('verified workspace 视图状态为 verified', () => {
  assert.equal(deriveWorkspaceView(workspaceVerified), 'verified');
});

test('checklist 中存在 blocking failed 时视图状态为 failed', () => {
  const ws = {
    ...workspaceNotStarted,
    onboarding: { ...workspaceNotStarted.onboarding, status: 'pending_verification' },
    checklist: [
      { key: 'service_metadata', name: '服务元数据', status: 'failed', blocking: true, message: '缺少 owner_team' },
      { key: 'identity_bound', name: '身份绑定', status: 'passed', blocking: true, message: '' },
    ],
  };
  assert.equal(deriveWorkspaceView(ws), 'failed');
});

test('checklist 中仅有 warning 不触发 failed', () => {
  const ws = {
    ...workspaceNotStarted,
    onboarding: { ...workspaceNotStarted.onboarding, status: 'pending_verification' },
    checklist: [
      { key: 'service_metadata', name: '服务元数据', status: 'passed', blocking: true, message: '' },
      { key: 'log_signal_seen', name: '日志信号', status: 'warning', blocking: false, message: '暂未检测' },
    ],
    identity: { id: 'id-1', identityType: 'k8s_workload', enabled: true, tokenPresent: false },
  };
  assert.equal(deriveWorkspaceView(ws), 'pending_verification');
});

test('countChecklistByStatus 按状态正确计数', () => {
  assert.equal(countChecklistByStatus(workspaceVerified.checklist, 'passed'), 3);
  assert.equal(countChecklistByStatus(workspaceVerified.checklist, 'warning'), 1);
  assert.equal(countChecklistByStatus(workspaceVerified.checklist, 'failed'), 0);
});
