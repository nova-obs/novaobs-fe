import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const onboardingSource = readFileSync(new URL('./LogsOnboardingPage.tsx', import.meta.url), 'utf8');
const servicePickerSource = readFileSync(new URL('./ServicePickerPanel.tsx', import.meta.url), 'utf8');
const workspaceSource = readFileSync(new URL('./LogsWorkspace.tsx', import.meta.url), 'utf8');
const exploreSource = readFileSync(new URL('./LogsExplorePage.tsx', import.meta.url), 'utf8');
const agentsSource = readFileSync(new URL('./LogsAgentsPage.tsx', import.meta.url), 'utf8');
const alertsSource = readFileSync(new URL('./LogsAlertsPage.tsx', import.meta.url), 'utf8');

test('Logs 接入配置收敛为接入和发布路径', () => {
  assert.equal(onboardingSource.includes('logs-onboarding-toolbar'), true);
  assert.equal(onboardingSource.includes('服务与运行目标'), true);
  assert.equal(onboardingSource.includes('日志下游端点'), true);
  assert.equal(onboardingSource.includes('发布预览'), true);
  assert.equal(onboardingSource.includes('生成预览'), true);
  assert.equal(onboardingSource.includes('保存草稿'), true);
  assert.equal(onboardingSource.includes('确认发布'), true);
  assert.equal(onboardingSource.includes('连通性检查'), false);
});

test('Logs 接入配置不再前端渲染 collector YAML', () => {
  assert.equal(onboardingSource.includes('renderCollectorConfigDraft'), false);
  assert.equal(onboardingSource.includes('renderCollectorDomainConfigDraft'), false);
  assert.equal(onboardingSource.includes('routeCollectorPatchDraft'), false);
  assert.equal(onboardingSource.includes('currentCollectorDomainConfig'), false);
  assert.equal(onboardingSource.includes('patchedCollectorDomainConfig'), false);
  assert.equal(onboardingSource.includes('runningCollectorDomainConfig'), false);
  assert.equal(onboardingSource.includes('collector-config-compare-grid'), false);
  assert.equal(onboardingSource.includes('当前运行配置'), false);
  assert.equal(onboardingSource.includes('Patch 后配置'), false);
  assert.equal(onboardingSource.includes('本服务采集配置'), false);
  assert.equal(onboardingSource.includes('本次 Collector YAML'), false);
  assert.equal(onboardingSource.includes('解析规则自检'), false);
  assert.equal(onboardingSource.includes('展开自检'), false);
  assert.equal(onboardingSource.includes('收起自检'), false);
  assert.equal(onboardingSource.includes('从当前选择生成'), false);
  assert.equal(onboardingSource.includes('<logs-downstream-write-address>'), false);
  assert.equal(onboardingSource.includes('logsApi.getRouteCollectorConfig'), false);
  assert.equal(onboardingSource.includes('LogsParseRuleDialog'), true);
  assert.equal(onboardingSource.includes('LogsPublishPreviewPanel'), true);
});

test('Logs 接入配置保留 route 更新和只读集群过滤', () => {
  assert.equal(onboardingSource.includes("routeParams.get('route_id')"), true);
  assert.equal(onboardingSource.includes("routeParams.get('mode') === 'update'"), true);
  assert.equal(onboardingSource.includes('loadRouteDraft'), true);
  assert.equal(onboardingSource.includes('routeScopedServices'), true);
  assert.equal(onboardingSource.includes('clusters.filter((cluster) => !cluster.readOnly)'), true);
  assert.equal(onboardingSource.includes('service.cluster && !writableClusterIds.has(service.cluster)'), true);
  assert.equal(onboardingSource.includes('writableClusters.map((cluster)'), true);
  assert.equal(onboardingSource.includes('cluster.readOnly ?'), false);
});

test('Logs 服务列表只承担选择和更新入口', () => {
  assert.equal(servicePickerSource.includes('ServicePickerPanel'), true);
  assert.equal(servicePickerSource.includes('serviceAccessState'), true);
  assert.equal(servicePickerSource.includes('采集中'), true);
  assert.equal(servicePickerSource.includes('更新配置'), true);
  assert.equal(servicePickerSource.includes('查看配置'), false);
  assert.equal(servicePickerSource.includes('onViewRoute'), false);
});

test('Logs 采集路由页负责运行态和配置查看', () => {
  assert.equal(agentsSource.includes('logs-routes-workbench'), true);
  assert.equal(agentsSource.includes('采集域状态'), true);
  assert.equal(agentsSource.includes('Agent 实例'), true);
  assert.equal(agentsSource.includes('暂无 Agent 心跳数据'), true);
  assert.equal(agentsSource.includes('logsApi.getRouteCollectorConfig'), true);
  assert.equal(agentsSource.includes('完整 collector.yaml'), true);
  assert.equal(agentsSource.includes('非 K8s 部署清单'), true);
  assert.equal(agentsSource.includes('部署清单 hash'), true);
  assert.equal(agentsSource.includes('/logs/onboarding?mode=update&route_id='), true);
  assert.equal(agentsSource.includes('实例状态'), false);
});

test('Logs Explore 只展示真实下游查询入口', () => {
  assert.equal(exploreSource.includes('logs-explore-workbench'), true);
  assert.equal(exploreSource.includes('打开 VMUI'), true);
  assert.equal(exploreSource.includes('创建告警'), true);
  assert.equal(exploreSource.includes('查看采集路由'), true);
  assert.equal(exploreSource.includes('Log query'), false);
  assert.equal(exploreSource.includes('Rows3'), false);
  assert.equal(exploreSource.includes('Table2'), false);
  assert.equal(exploreSource.includes("viewMode"), false);
});

test('Logs 告警和模块导航只保留已闭环入口', () => {
  assert.equal(workspaceSource.includes('日志分析'), true);
  assert.equal(workspaceSource.includes('接入配置'), true);
  assert.equal(workspaceSource.includes('采集路由'), true);
  assert.equal(workspaceSource.includes('日志告警'), true);
  assert.equal(alertsSource.includes('日志告警规则'), true);
  assert.equal(alertsSource.includes('告警中心'), true);
  assert.equal(alertsSource.includes('规则上下文'), false);
  assert.equal(alertsSource.includes('规则字段'), false);
});
