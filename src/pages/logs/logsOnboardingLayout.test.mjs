import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./LogsOnboardingPage.tsx', import.meta.url), 'utf8');
const workspaceSource = readFileSync(new URL('./LogsWorkspace.tsx', import.meta.url), 'utf8');
const exploreSource = readFileSync(new URL('./LogsExplorePage.tsx', import.meta.url), 'utf8');
const agentsSource = readFileSync(new URL('./LogsAgentsPage.tsx', import.meta.url), 'utf8');
const alertsSource = readFileSync(new URL('./LogsAlertsPage.tsx', import.meta.url), 'utf8');

test('Logs 接入配置使用工具栏流程和集群维度工作台', () => {
  assert.equal(source.includes('logs-onboarding-toolbar'), true);
  assert.equal(source.includes('可用集群'), true);
  assert.equal(source.includes('kubeconfig / namespace / workload'), true);
  assert.equal(source.includes('logs-onboarding-action-bar'), true);
});

test('Logs 接入配置突出主操作而不是平均铺陈', () => {
  assert.equal(source.includes('接入配置'), true);
  assert.equal(source.includes('本次接入'), true);
  assert.equal(source.includes('预览配置'), true);
});

test('Logs 接入配置在操作前展示缺失项和阻塞原因', () => {
  assert.equal(source.includes('配置检查'), true);
  assert.equal(source.includes('预览前还需'), true);
  assert.equal(source.includes('先完成配置预览'), true);
  assert.equal(source.includes('先保存路由'), true);
  assert.equal(source.includes('选择或创建当前集群可用的 VictoriaLogs 端点'), true);
  assert.equal(source.includes('填写主机组或主机标签'), true);
  assert.equal(source.includes('选择 AgentGroup'), false);
  assert.equal(source.includes('接入成功后自动创建'), true);
});

test('Logs 接入配置创建端点后保留已保存端点内容', () => {
  assert.equal(source.includes('endpointToForm(endpoint)'), true);
  assert.equal(source.includes('当前端点已保存并选中'), true);
  assert.equal(source.includes('setEndpointForm(emptyEndpoint);'), false);
});

test('Logs 接入配置使用 Collector 完整配置弹层和解析自检', () => {
  assert.equal(source.includes('Collector 配置'), true);
  assert.equal(source.includes('完整 collector.yaml'), true);
  assert.equal(source.includes('日志样本'), true);
  assert.equal(source.includes('解析规则自检'), true);
  assert.equal(source.includes('从当前选择生成'), true);
  assert.equal(source.includes('rule_type 为 json 或 regex'), false);
  assert.equal(source.includes('包含采集路径、处理链和 VictoriaLogs 输出端点'), false);
  assert.equal(source.includes('用于解析规则自检'), false);
  assert.equal(source.includes('从完整配置中摘出规则后可在这里验证'), false);
  assert.equal(source.includes('后端解析结果'), false);
  assert.equal(source.includes("'generated'"), false);
  assert.equal(source.includes("'custom'"), false);
  assert.equal(source.includes('http://victorialogs:9428'), false);
  assert.equal(source.includes('<victorialogs-write-url>'), true);
  assert.equal(source.includes('logsApi.previewParseRules'), true);
  assert.equal(source.includes('parserDraftMode'), true);
  assert.equal(source.includes('Regex Pattern'), true);
});

test('Logs 接入配置展示集群采集域和追加业务语义', () => {
  assert.equal(source.includes('集群采集域'), true);
  assert.equal(source.includes('已接入范围'), true);
  assert.equal(source.includes('/var/log/pods/*_*_*/*/*.log'), true);
  assert.equal(source.includes('新增业务通过追加 route 更新采集域配置'), true);
  assert.equal(source.includes('选择 Workload'), true);
  assert.equal(source.includes('批量追加'), false);
  assert.equal(source.includes('selectedWorkloads'), false);
});

test('Logs 模块壳层使用专业工作台导航', () => {
  assert.equal(workspaceSource.includes('logs-workbench'), true);
  assert.equal(workspaceSource.includes('日志工作台'), true);
  assert.equal(workspaceSource.includes('VictoriaLogs'), true);
  assert.equal(workspaceSource.includes('15m'), true);
});

test('Logs 日志分析采用路由列表、查询区和详情面板', () => {
  assert.equal(exploreSource.includes('logs-explore-workbench'), true);
  assert.equal(exploreSource.includes('日志路由'), true);
  assert.equal(exploreSource.includes('LogQL / VictoriaLogs query'), true);
  assert.equal(exploreSource.includes('详情'), true);
  assert.equal(exploreSource.includes('创建告警'), true);
});

test('Logs Agent 和告警页面采用分栏工作台', () => {
  assert.equal(agentsSource.includes('logs-agents-workbench'), true);
  assert.equal(agentsSource.includes('采集域'), true);
  assert.equal(agentsSource.includes('K8s 主动探测'), true);
  assert.equal(agentsSource.includes('VM 回连上报'), true);
  assert.equal(agentsSource.includes('实例状态'), true);
  assert.equal(agentsSource.includes('Remote Config'), true);
  assert.equal(alertsSource.includes('logs-alerts-workbench'), true);
  assert.equal(alertsSource.includes('日志告警规则'), true);
  assert.equal(alertsSource.includes('规则上下文'), true);
});
