import test from 'node:test';
import assert from 'node:assert/strict';
import { renderK8sRouteFragmentDraft } from './LogsOnboardingPage.tsx';

const baseInput = {
  namespace: 'logplatform',
  workloadName: 'payment-api',
  serviceName: 'payment-api',
  environment: 'prod',
  endpointWriteURL: 'http://vl.prod:9428/insert/opentelemetry/v1/logs',
  accountId: '',
  projectId: '',
  parseRules: [],
};

test('业务 Collector 示例为 VictoriaLogs 租户生成 AccountID 和 ProjectID 请求头', () => {
  const yaml = renderK8sRouteFragmentDraft({
    ...baseInput,
    accountId: '9527',
    projectId: '9528',
  });

  assert.match(yaml, /logs_endpoint: "http:\/\/vl\.prod:9428\/insert\/opentelemetry\/v1\/logs"\n    headers:\n      AccountID: "9527"\n      ProjectID: "9528"/);
});

test('业务 Collector 示例未配置 VictoriaLogs 租户时不生成租户请求头', () => {
  const yaml = renderK8sRouteFragmentDraft(baseInput);

  assert.equal(yaml.includes('AccountID:'), false);
  assert.equal(yaml.includes('ProjectID:'), false);
});
