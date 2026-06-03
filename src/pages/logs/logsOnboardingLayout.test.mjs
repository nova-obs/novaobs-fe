import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./LogsOnboardingPage.tsx', import.meta.url), 'utf8');
const workspaceSource = readFileSync(new URL('./LogsWorkspace.tsx', import.meta.url), 'utf8');
const exploreSource = readFileSync(new URL('./LogsExplorePage.tsx', import.meta.url), 'utf8');
const agentsSource = readFileSync(new URL('./LogsAgentsPage.tsx', import.meta.url), 'utf8');
const alertsSource = readFileSync(new URL('./LogsAlertsPage.tsx', import.meta.url), 'utf8');

test('Logs 接入配置使用服务驱动的工具栏流程', () => {
  assert.equal(source.includes('logs-onboarding-toolbar'), true);
  assert.equal(source.includes('可用集群'), true);
  assert.equal(source.includes('kubeconfig / namespace / workload'), true);
  assert.equal(source.includes('logs-onboarding-action-bar'), true);
  assert.equal(source.includes('服务与运行目标'), true);
  assert.equal(source.includes('日志端点'), true);
  assert.equal(source.includes('<StepCard index={1} title="服务与运行目标"'), true);
  assert.equal(source.includes('<StepCard index={2} title="日志端点"'), true);
});

test('Logs 接入配置突出主操作而不是平均铺陈', () => {
  assert.equal(source.includes('接入配置'), true);
  assert.equal(source.includes('本次接入'), true);
  assert.equal(source.includes('预览配置'), true);
});

test('Logs 接入配置先绑定服务对应的 K8s 运行目标', () => {
  assert.equal(source.includes('<DataPanel title="服务与运行目标" meta="service / runtime target">'), true);
  assert.equal(source.includes('<DataPanel title="服务与下游" meta="service / downstream">'), false);
  assert.equal(source.includes("<DataPanel title={sourceType === 'vm_file' ? 'VM 采集范围' : 'K8s 采集范围'}"), false);
  assert.equal(source.includes('xl:grid-cols-[330px_minmax(0,1fr)]'), true);
  assert.equal(source.includes('搜索服务'), true);
  assert.equal(source.includes('applyServiceRuntimeScope'), true);
  assert.equal(source.includes('resolveServiceWorkloadKey'), true);
  assert.equal(source.includes('service.cluster'), true);
  assert.equal(source.includes('service.namespace'), true);
  assert.equal(source.includes('服务选择后绑定运行目标'), true);
  assert.equal(source.includes('serviceMatchesAccessSource'), true);
  assert.equal(source.includes("service.identityType === 'host_process'"), true);
  assert.equal(source.includes("service.identityType === 'k8s_workload'"), true);
  assert.equal(source.includes('sourceServices.length'), true);
  assert.equal(source.includes('资源浏览器'), true);
  assert.equal(source.includes('搜索 Workload'), true);
  assert.equal(source.includes('当前范围'), true);
  assert.equal(source.includes('xl:grid-cols-[260px_minmax(0,1fr)]'), false);
  assert.equal(source.includes('日志下游端点'), true);
  assert.equal(source.includes('运行目标未绑定时禁用日志下游端点'), true);
  assert.equal(source.includes('搜索端点 / URL / 集群'), true);
  assert.equal(source.includes('console-table min-w-[760px]'), true);
  assert.equal(source.includes('新增端点'), true);
  assert.equal(source.includes('编辑端点'), true);
  assert.equal(source.includes('endpointEditId'), true);
  assert.equal(source.includes('closeEndpointForm'), true);
  assert.equal(source.includes('endpointCreateOpen && endpointEditId === endpoint.id'), true);
  assert.equal(source.includes('setEndpointEditId(endpoint.id)'), true);
  assert.equal(source.includes('logsApi.updateEndpoint(endpointEditId'), true);
  assert.equal(source.includes('当前端点配置已保存'), true);
  assert.equal(source.includes('编辑中'), true);
  assert.equal(source.includes('endpointCreateOpen'), true);
  assert.equal(source.includes('aria-expanded={endpointCreateOpen}'), true);
  assert.equal(source.includes('端点信息'), true);
  assert.equal(source.includes('请选择服务后再预览配置'), true);
  assert.equal(source.includes('servicePickerOpen'), false);
  assert.equal(source.includes('aria-autocomplete="list"'), false);
  assert.equal(source.includes('<option value="">选择服务</option>'), false);
  assert.equal(source.includes('<DataPanel title="服务绑定" meta="service">'), false);
  assert.equal(source.includes('<DataPanel title="日志路由"'), false);
  assert.equal(source.includes('service / collection domain / downstream'), false);
  assert.equal(source.includes('路由参数'), false);
  assert.equal(source.includes('日志接入链路'), false);
  assert.equal(source.includes('BindingFlowNode'), false);
  assert.equal(source.includes('BindingFlowArrow'), false);
});

test('Logs 接入配置把下游和 Collector 放回各自区域', () => {
  assert.equal(source.includes('日志下游端点'), true);
  assert.equal(source.includes('<DataPanel title="日志下游端点"'), true);
  assert.equal(source.includes('当前下游端点'), false);
  assert.equal(source.includes('自动匹配集群端点'), false);
  assert.equal(source.includes('使用集群绑定端点'), false);
  assert.equal(source.includes('<DataPanel title="配置预览"'), true);
  assert.equal(source.includes('Collector 配置'), true);
  assert.equal(source.includes('<DataPanel title="Collector 配置"'), false);
});

test('Logs 接入配置在操作前展示缺失项和阻塞原因', () => {
  assert.equal(source.includes('配置检查'), true);
  assert.equal(source.includes('预览前还需'), true);
  assert.equal(source.includes('先完成配置预览'), true);
  assert.equal(source.includes('先保存路由'), true);
  assert.equal(source.includes('选择或创建当前集群可用的日志下游端点'), true);
  assert.equal(source.includes('填写主机组或主机标签'), true);
  assert.equal(source.includes('选择 AgentGroup'), false);
  assert.equal(source.includes('接入成功后自动创建'), false);
});

test('Logs 接入配置使用发布预览替代直接发布按钮', () => {
  assert.equal(source.includes('发布预览'), true);
  assert.equal(source.includes('生成发布预览'), true);
  assert.equal(source.includes('等待确认'), true);
  assert.equal(source.includes('确认发布'), true);
  assert.equal(source.includes('function PublishPreviewPanel'), true);
});

test('Logs 接入配置创建端点后保留已保存端点内容', () => {
  assert.equal(source.includes('endpointToForm(endpoint)'), true);
  assert.equal(source.includes('当前端点配置已保存'), true);
  assert.equal(source.includes('setEndpointForm(emptyEndpoint);'), false);
});

test('Logs 接入配置刷新后可从已登记路由恢复草稿', () => {
  assert.equal(source.includes('selectedRouteId'), true);
  assert.equal(source.includes('autoRestoredRouteRef'), true);
  assert.equal(source.includes('suspendDraftResetRef'), true);
  assert.equal(source.includes('loadRouteDraft'), true);
  assert.equal(source.includes('parserFormFromRules'), true);
  assert.equal(source.includes('setCollectorConfigYaml(source.collectorYAML ??'), true);
  assert.equal(source.includes('setCreatedRoute(route)'), true);
  assert.equal(source.includes('logsApi.updateRoute(selectedRouteId'), true);
  assert.equal(source.includes('routeId: selectedRouteId'), true);
  assert.equal(source.includes('载入配置'), true);
  assert.equal(source.includes('已载入'), true);
});

test('Logs 接入配置切换服务后不会复用已载入路由的 Collector YAML', () => {
  assert.equal(source.includes('routeMatchesCurrentDraft'), true);
  assert.equal(source.includes('selectedRouteMatchesDraft'), true);
  assert.equal(source.includes('shouldUseSavedCollectorYaml'), true);
  assert.equal(source.includes("setSelectedRouteId('')"), true);
  assert.equal(source.includes("setCollectorConfigYaml('')"), true);
  assert.equal(source.includes('shouldUseSavedCollectorYaml ? collectorConfigYaml : routeCollectorPatchDraft'), true);
});

test('Logs 接入配置让已接入服务状态可读', () => {
  assert.equal(source.includes('function routeLifecycle'), true);
  assert.equal(source.includes('接入状态'), true);
  assert.equal(source.includes('已发布'), true);
  assert.equal(source.includes('待发布'), true);
  assert.equal(source.includes('待确认'), true);
  assert.equal(source.includes('未发布'), true);
  assert.equal(source.includes('配置已变更'), true);
  assert.equal(source.includes('function RouteStatusCell'), true);
  assert.equal(source.includes('function StatusPill'), true);
  assert.equal(source.includes('lastPublishMessage'), true);
  assert.equal(source.includes('lastAuditId'), true);
  assert.equal(source.includes('lastPreviewId'), true);
});

test('Logs 接入配置使用 Collector 完整配置弹层和解析自检', () => {
  assert.equal(source.includes('Collector 配置'), true);
  assert.equal(source.includes('当前运行配置'), true);
  assert.equal(source.includes('Patch 后配置'), true);
  assert.equal(source.includes('本次增量配置'), true);
  assert.equal(source.includes('collector-config-compare-grid'), true);
  assert.equal(source.includes('currentCollectorDomainConfig'), true);
  assert.equal(source.includes('patchedCollectorDomainConfig'), true);
  assert.equal(source.includes('routeCollectorPatchDraft'), true);
  assert.equal(source.includes('parseRulesDrawerOpen'), true);
  assert.equal(source.includes('setParseRulesDrawerOpen(false)'), true);
  assert.equal(source.includes('aria-expanded={parseRulesDrawerOpen}'), true);
  assert.equal(source.includes('规则自检抽屉'), true);
  assert.equal(source.includes('展开自检'), true);
  assert.equal(source.includes('收起自检'), true);
  assert.equal(source.includes('只读'), true);
  assert.equal(source.includes('可编辑'), true);
  assert.equal(source.includes('read-only'), true);
  assert.equal(source.includes('editable'), true);
  assert.equal(source.includes('完整 collector.yaml'), false);
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
  assert.equal(source.includes('<logs-downstream-write-address>'), true);
  assert.equal(source.includes('elasticsearch/logs_downstream'), true);
  assert.equal(source.includes('kafka/logs_downstream'), true);
  assert.equal(source.includes('logsApi.previewParseRules'), true);
  assert.equal(source.includes('parserDraftMode'), true);
  assert.equal(source.includes('Regex Pattern'), true);
  assert.equal(source.includes('file_log/${routeSuffix}'), true);
  assert.equal(source.includes('poll_interval: 10s'), true);
  assert.equal(source.includes('max_concurrent_files: 128'), true);
  assert.equal(source.includes('memory_limiter'), true);
  assert.equal(source.includes('k8s_attributes'), true);
  assert.equal(source.includes('k8sattributes'), false);
  assert.equal(source.includes('node_from_env_var: KUBE_NODE_NAME'), true);
  assert.equal(source.includes('otlp_http/logs_downstream'), true);
  assert.equal(source.includes('file_storage/filelog_offsets'), true);
});

test('Logs 接入配置展示 K8s 资源浏览器并弱化左侧辅助控件', () => {
  assert.equal(source.includes('采集域'), true);
  assert.equal(source.includes('选择 K8s 集群'), true);
  assert.equal(source.includes('logs-k8s-cluster-picker'), true);
  assert.equal(source.includes('logs-k8s-cluster-card'), true);
  assert.equal(source.includes('已选择'), true);
  assert.equal(source.includes('版本'), true);
  assert.equal(source.includes('模式'), true);
  assert.equal(source.includes('Cluster ID'), true);
  assert.equal(source.includes('资源浏览器'), true);
  assert.equal(source.includes('搜索 Workload'), true);
  assert.equal(source.includes('Runtime 日志目录'), true);
  assert.equal(source.includes('/data/docker/containers'), true);
  assert.equal(source.includes('runtimeLogPathsText'), true);
  assert.equal(source.includes('workloadsQuery.refetch()'), true);
  assert.equal(source.includes('当前范围'), true);
  assert.equal(source.includes('console-table min-w-[680px]'), true);
  assert.equal(source.includes('kind / name / selector'), true);
  assert.equal(source.includes('k8sLogIncludePath(namespace'), true);
  assert.equal(source.includes('/var/log/pods/${ns}_${workload}_*/*/*.log'), true);
  assert.equal(source.includes('选择 Workload'), true);
  assert.equal(source.includes('批量追加'), false);
  assert.equal(source.includes('selectedWorkloads'), false);
  assert.equal(source.includes('selectedAgentStatus'), false);
  assert.equal(source.includes('setSyncOwnerTeam'), false);
  assert.equal(source.includes('Owner Team'), false);
});

test('Logs 模块壳层使用专业工作台导航', () => {
  assert.equal(workspaceSource.includes('logs-workbench'), true);
  assert.equal(workspaceSource.includes('日志工作台'), true);
  assert.equal(workspaceSource.includes('日志下游'), true);
  assert.equal(workspaceSource.includes('15m'), true);
});

test('Logs 日志分析采用路由列表、查询区和详情面板', () => {
  assert.equal(exploreSource.includes('logs-explore-workbench'), true);
  assert.equal(exploreSource.includes('日志路由'), true);
  assert.equal(exploreSource.includes('Log query'), true);
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
  assert.equal(agentsSource.includes('confirmDeleteGroupId'), true);
  assert.equal(agentsSource.includes('deleteCollectorGroup'), true);
  assert.equal(agentsSource.includes('删除采集域'), true);
  assert.equal(alertsSource.includes('logs-alerts-workbench'), true);
  assert.equal(alertsSource.includes('日志告警规则'), true);
  assert.equal(alertsSource.includes('规则上下文'), true);
});
