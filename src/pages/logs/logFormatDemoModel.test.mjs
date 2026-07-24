import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assessBusinessLogProposal,
  buildCollectedLogPreview,
  formatDemoScenarios,
} from './logFormatDemoModel.ts';

const platformContext = {
  serviceKey: 'orders-api',
  serviceId: 'svc-orders-api-01',
  ownerTeam: '交易平台',
  alertRoute: 'trade-oncall',
};

test('标准业务 JSON 满足必填与推荐字段时可直接进入联调', () => {
  const assessment = assessBusinessLogProposal(JSON.stringify({
    timestamp: '2026-07-24T10:32:18.245+08:00',
    level: 'error',
    message: 'create order failed',
    trace_id: '4bf92f3577b34da6a3ce929d0e0e4736',
    span_id: '00f067aa0ba902b7',
    request_id: 'req-20260724-001',
    error_code: 'ORDER_CREATE_FAILED',
  }));

  assert.equal(assessment.status, 'ready');
  assert.equal(assessment.blockingIssues.length, 0);
  assert.equal(assessment.advice.length, 0);
  assert.equal(assessment.recommendation?.level, 'error');
  assert.equal(assessment.recommendation?.error_code, 'ORDER_CREATE_FAILED');
});

test('旧日志级别会规范为小写且不会改写输入对象', () => {
  const input = {
    timestamp: '2026-07-24T10:32:18+08:00',
    level: 'WARNING',
    message: 'payment timeout',
    order_id: 'order-1',
  };
  const snapshot = structuredClone(input);
  const assessment = assessBusinessLogProposal(JSON.stringify(input));

  assert.deepEqual(input, snapshot);
  assert.equal(assessment.status, 'ready_with_advice');
  assert.equal(assessment.recommendation?.level, 'warn');
  assert.match(assessment.advice.join('\n'), /level.*warn/i);
});

test('缺少 level 或 message 会阻断联调', () => {
  const assessment = assessBusinessLogProposal(JSON.stringify({
    timestamp: '2026-07-24T10:32:18+08:00',
    trace_id: '4bf92f3577b34da6a3ce929d0e0e4736',
  }));

  assert.equal(assessment.status, 'blocked');
  assert.match(assessment.blockingIssues.join('\n'), /level/);
  assert.match(assessment.blockingIssues.join('\n'), /message/);
});

test('推荐字段缺失只给改造建议，不误判业务格式不可用', () => {
  const assessment = assessBusinessLogProposal(JSON.stringify({
    level: 'info',
    message: 'order created',
  }));

  assert.equal(assessment.status, 'ready_with_advice');
  assert.equal(assessment.blockingIssues.length, 0);
  assert.match(assessment.advice.join('\n'), /timestamp/);
  assert.match(assessment.advice.join('\n'), /trace_id/);
  assert.match(assessment.advice.join('\n'), /span_id/);
  assert.match(assessment.advice.join('\n'), /request_id/);
});

test('格式错误给出稳定校验结果且不抛出异常', () => {
  const assessment = assessBusinessLogProposal('{"level":"info"');

  assert.equal(assessment.status, 'blocked');
  assert.equal(assessment.recommendation, null);
  assert.match(assessment.parseError, /JSON/);
});

test('敏感字段会阻断并从推荐结果中移除，同时保留其他业务字段', () => {
  const assessment = assessBusinessLogProposal(JSON.stringify({
    level: 'info',
    message: 'login success',
    user_id: 'user-1',
    auth: {
      access_token: 'secret-value',
      channel: 'web',
    },
  }));

  assert.equal(assessment.status, 'blocked');
  assert.match(assessment.blockingIssues.join('\n'), /auth\.access_token/);
  assert.equal(assessment.recommendation?.user_id, 'user-1');
  assert.deepEqual(assessment.recommendation?.auth, { channel: 'web' });
});

test('驼峰凭据、会话和个人信息字段以及正文中的 Bearer 凭据均会阻断并脱敏', () => {
  const assessment = assessBusinessLogProposal(JSON.stringify({
    level: 'info',
    message: 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature',
    accessToken: 'token-value',
    clientSecret: 'secret-value',
    session_id: 'session-1',
    sessionKey: 'session-key-1',
    email: 'user@example.com',
    phone: '13800138000',
    recipients: [['nested@example.com']],
    opaque_value: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature-',
  }));

  assert.equal(assessment.status, 'blocked');
  assert.match(assessment.blockingIssues.join('\n'), /accessToken/);
  assert.match(assessment.blockingIssues.join('\n'), /message/);
  assert.equal(assessment.recommendation?.accessToken, undefined);
  assert.equal(assessment.recommendation?.clientSecret, undefined);
  assert.equal(assessment.recommendation?.session_id, undefined);
  assert.equal(assessment.recommendation?.sessionKey, undefined);
  assert.equal(assessment.recommendation?.email, undefined);
  assert.equal(assessment.recommendation?.phone, undefined);
  assert.deepEqual(assessment.recommendation?.recipients, [['<敏感内容已移除>']]);
  assert.equal(assessment.recommendation?.opaque_value, '<敏感内容已移除>');
  assert.equal(assessment.recommendation?.message, '<敏感内容已移除>');
});

test('业务不能输出平台保留字段，推荐结果只保留业务真值', () => {
  const assessment = assessBusinessLogProposal(JSON.stringify({
    level: 'info',
    message: 'order created',
    'service.name': 'forged-service',
    novaapm: { service_id: 'forged-service-id' },
    owner_team: 'forged-team',
    alert_route: 'forged-route',
    order_id: 'order-1',
  }));

  assert.equal(assessment.status, 'blocked');
  assert.match(assessment.blockingIssues.join('\n'), /service\.name/);
  assert.match(assessment.blockingIssues.join('\n'), /novaapm\.service_id/);
  assert.equal(assessment.recommendation?.['service.name'], undefined);
  assert.equal(assessment.recommendation?.owner_team, undefined);
  assert.equal(assessment.recommendation?.alert_route, undefined);
  assert.equal(assessment.recommendation?.order_id, 'order-1');
});

test('计数、版本和状态类业务字段不会被误判为敏感字段', () => {
  const assessment = assessBusinessLogProposal(JSON.stringify({
    level: 'info',
    message: 'delivery finished',
    token_count: 12,
    secretary_id: 'employee-1',
    mobile_version: '2.1.0',
    email_status: 'verified',
  }));

  assert.notEqual(assessment.status, 'blocked');
  assert.equal(assessment.recommendation?.token_count, 12);
  assert.equal(assessment.recommendation?.secretary_id, 'employee-1');
  assert.equal(assessment.recommendation?.mobile_version, '2.1.0');
  assert.equal(assessment.recommendation?.email_status, 'verified');
});

test('带业务前缀的密码、密钥和凭据字段仍会被识别并移除', () => {
  const assessment = assessBusinessLogProposal(JSON.stringify({
    level: 'info',
    message: 'integration ready',
    dbPassword: 'plain-credential',
    openaiApiKey: 'sk-proj-123456789',
    awsSecretKey: 'aws-secret',
    awsSecretAccessKey: 'aws-secret-access-key',
    stripeSecretKey: 'stripe-secret',
    serviceCredentials: 'credential-value',
    apiToken: 'api-token',
    oauthToken: 'oauth-token',
    IDToken: 'id-token',
    clientCredential: 'client-credential',
    awsCredentials: 'aws-credentials',
    cookieValue: 'cookie-value',
    sessionCookie: 'session-cookie',
  }));

  assert.equal(assessment.status, 'blocked');
  assert.equal(assessment.recommendation?.dbPassword, undefined);
  assert.equal(assessment.recommendation?.openaiApiKey, undefined);
  assert.equal(assessment.recommendation?.awsSecretKey, undefined);
  assert.equal(assessment.recommendation?.awsSecretAccessKey, undefined);
  assert.equal(assessment.recommendation?.stripeSecretKey, undefined);
  assert.equal(assessment.recommendation?.serviceCredentials, undefined);
  assert.equal(assessment.recommendation?.apiToken, undefined);
  assert.equal(assessment.recommendation?.oauthToken, undefined);
  assert.equal(assessment.recommendation?.IDToken, undefined);
  assert.equal(assessment.recommendation?.clientCredential, undefined);
  assert.equal(assessment.recommendation?.awsCredentials, undefined);
  assert.equal(assessment.recommendation?.cookieValue, undefined);
  assert.equal(assessment.recommendation?.sessionCookie, undefined);
});

test('正文中的 Basic Authorization 凭据会阻断并脱敏', () => {
  const assessment = assessBusinessLogProposal(JSON.stringify({
    level: 'info',
    message: 'Authorization: Basic dXNlcjpwYXNzd29yZA==',
  }));

  assert.equal(assessment.status, 'blocked');
  assert.match(assessment.blockingIssues.join('\n'), /message/);
  assert.equal(assessment.recommendation?.message, '<敏感内容已移除>');
});

test('超长、字段过多或嵌套过深的 JSON 返回稳定阻断结果', () => {
  const oversized = assessBusinessLogProposal(JSON.stringify({
    level: 'info',
    message: 'ok',
    padding: 'a'.repeat(21_000),
  }));
  const tooManyFields = assessBusinessLogProposal(JSON.stringify(Object.fromEntries([
    ['level', 'info'],
    ['message', 'ok'],
    ...Array.from({ length: 205 }, (_, index) => [`field_${index}`, index]),
  ])));
  let nested = { value: 'end' };
  for (let index = 0; index < 25; index += 1) nested = { child: nested };
  const tooDeep = assessBusinessLogProposal(JSON.stringify({
    level: 'info',
    message: 'ok',
    nested,
  }));

  assert.equal(oversized.status, 'blocked');
  assert.match(oversized.parseError, /字符/);
  assert.equal(tooManyFields.status, 'blocked');
  assert.match(tooManyFields.parseError, /字段/);
  assert.equal(tooDeep.status, 'blocked');
  assert.match(tooDeep.parseError, /嵌套/);
});

test('平台字段只在采集后目标视图中补齐，不写回业务推荐 JSON', () => {
  const assessment = assessBusinessLogProposal(JSON.stringify({
    level: 'info',
    message: 'order created',
    order_id: 'order-1',
  }));
  const collected = buildCollectedLogPreview(assessment.recommendation, platformContext);

  assert.equal(assessment.recommendation?.['service.name'], undefined);
  assert.equal(collected.business.order_id, 'order-1');
  assert.equal(collected.platform['service.name'], 'orders-api');
  assert.equal(collected.platform['novaapm.service_id'], 'svc-orders-api-01');
  assert.equal(collected.platform.owner_team, '交易平台');
  assert.equal(collected.platform.alert_route, 'trade-oncall');
  assert.match(collected.platform['novaapm.source_type'], /采集路由/);
});

test('内置洽谈样例同时覆盖文本现状、旧 JSON 和达标 JSON', () => {
  assert.deepEqual(formatDemoScenarios.map((item) => item.id), [
    'java-text',
    'legacy-json',
    'standard-json',
  ]);
  assert.ok(formatDemoScenarios.every((item) => item.currentSample && item.proposal));
});
