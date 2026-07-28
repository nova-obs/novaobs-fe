import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { logsApi } from './api.ts';

const onboarding = readFileSync(new URL('./LogsOnboardingPage.tsx', import.meta.url), 'utf8');
const vmFlow = readFileSync(new URL('./VMOnboardingFlow.tsx', import.meta.url), 'utf8');
const agents = readFileSync(new URL('./LogsAgentsPage.tsx', import.meta.url), 'utf8');
const apiSource = readFileSync(new URL('./api.ts', import.meta.url), 'utf8');
const serviceApiSource = readFileSync(new URL('../../services/api.ts', import.meta.url), 'utf8');
const agentDetail = readFileSync(new URL('../agents/AgentDetailPage.tsx', import.meta.url), 'utf8');

async function captureRequest(callApi, responseData = {}) {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init, body: init.body ? JSON.parse(init.body) : undefined });
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ success: true, data: responseData, error: null }) };
  };
  try {
    const result = await callApi();
    assert.equal(requests.length, 1);
    return { request: requests[0], result };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('VM 日志路由强绑定 host_set 部署且不提交主机组或完整 Collector YAML', async () => {
  const { request } = await captureRequest(
    () => logsApi.createRoute({
      name: 'orders', serviceId: 'service-1', serviceDeploymentId: 'deployment-1',
      sourceType: 'vm_file', endpointId: 'endpoint-1',
      vm: { pathPattern: '/data/logs/*.log', parseRules: [] },
    }),
    { route: { id: 'route-1', service_id: 'service-1', service_deployment_id: 'deployment-1' } },
  );
  assert.equal(request.body.service_deployment_id, 'deployment-1');
  assert.equal('host_group' in request.body.vm, false);
  assert.equal('collector_yaml' in request.body.vm, false);
});

test('路由运行摘要保留预期未安装目标并只映射控制面状态', async () => {
  const { request, result } = await captureRequest(
    () => logsApi.getRouteRuntimeStatus('route-1'),
    {
      expected: 3, registered: 2, online: 1, healthy: 1, converged: 1,
      blocking_reason: '1 台主机未安装',
      targets: [{
        target_id: 'host-3', target_name: 'orders-03', installation_id: '',
        connection_status: 'offline', process_status: 'unknown',
        config_status: 'pending', blocking_reason: 'not_installed',
      }],
    },
  );
  assert.equal(request.path, '/api/v1/logs/routes/route-1/runtime-status');
  assert.equal(result.expected, 3);
  assert.equal(result.targets[0].blockingReason, 'not_installed');
  assert.equal(result.targets[0].processStatus, 'unknown');
  assert.equal('flowing' in result, false);
  assert.equal('dataStatus' in result.targets[0], false);
});

test('VM 编辑只选择 host_set deployment，Supervisor 安装覆盖由运行页承载', () => {
  assert.match(vmFlow, /getServiceDeployments/);
  assert.match(vmFlow, /deployment\.kind === 'host_set'/);
  assert.match(vmFlow, /allowedLogRoots/);
  assert.doesNotMatch(vmFlow, /listVMAgentEndpoints|createVMAgentEndpoint|probeVMAgentEndpoint/);
  assert.doesNotMatch(vmFlow, /hostGroup|13133|批量录入/);
  assert.equal((onboarding.match(/<VMOnboardingFlow/g) ?? []).length, 1);
  assert.match(agents, /getRouteRollouts/);
  assert.match(agents, /rollbackRoute/);
  assert.match(agents, /retryRouteTarget/);
  assert.match(agents, /重试下发/);
  assert.match(agents, /回滚会复用历史产物创建新 generation/);
});

test('路由草稿变化会使旧预览失效且阻断未预览或预览失败的发布', () => {
  assert.match(onboarding, /setPreview\(null\)/);
  assert.match(onboarding, /!props\.preview \|\| props\.preview\.publishBlocked/);
  assert.match(vmFlow, /setPreview\(null\)/);
});

test('Logs API 已硬切删除 VM 手工安装材料、Endpoint 和端口探测入口', () => {
  assert.doesNotMatch(apiSource, /VMInstallation|VMAgentEndpoint/);
  assert.doesNotMatch(apiSource, /getVMInstallation|listVMAgentEndpoints|createVMAgentEndpoint/);
  assert.doesNotMatch(apiSource, /probeVMAgentEndpoint|deleteVMAgentEndpoint|vm-agent-endpoints|vm-installation/);
  assert.doesNotMatch(apiSource, /agent_group_id|collectorGroups/);
  assert.doesNotMatch(serviceApiSource, /assignInstanceService|unassignInstanceService/);
});

test('运行页异常优先并使用统一 runtime-status', () => {
  assert.match(agents, /getRouteRuntimeStatus/);
  assert.match(agents, /仅看异常/);
  assert.match(agents, /blockingReason/);
  assert.doesNotMatch(agents, /listVMAgentEndpoints|地址可达|13133/);
});

test('Agent 详情按连接进程配置三轴展示并折叠高级诊断', () => {
  assert.match(agentDetail, /连接状态/);
  assert.match(agentDetail, /进程状态/);
  assert.match(agentDetail, /配置状态/);
  assert.doesNotMatch(agentDetail, /数据状态/);
  assert.match(agentDetail, /<details/);
  assert.match(agentDetail, /高级诊断/);
  assert.match(agentDetail, /最后心跳/);
  assert.doesNotMatch(agentDetail, /最后日志/);
  assert.match(agentDetail, /safeLogsReturnPath/);
  assert.doesNotMatch(agentDetail, /navigate\(-1\)/);
  assert.doesNotMatch(agentDetail, /const service = services\\[0\\]/);
});
