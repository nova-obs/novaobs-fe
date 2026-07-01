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
  assert.equal(onboardingSource.includes('logs-onboarding-toolbar'), false);
  assert.equal(onboardingSource.includes('aria-label="采集路由步骤"'), true);
  assert.equal(onboardingSource.includes('logs-runtime-configuration-panel'), true);
  assert.equal(onboardingSource.includes('运行目标'), true);
  assert.equal(onboardingSource.includes('日志下游端点'), true);
  assert.equal(onboardingSource.includes('业务采集配置'), true);
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

test('Logs 接入配置以 route collector fragment 作为主要编辑对象', () => {
  assert.equal(onboardingSource.includes('renderK8sRouteFragmentDraft'), true);
  assert.equal(onboardingSource.includes('collectorFragmentYAML'), true);
  assert.equal(onboardingSource.includes('collector_fragment_yaml'), false);
  assert.equal(onboardingSource.includes('route collector fragment'), true);
  assert.equal(onboardingSource.includes('重新生成示例'), true);
  assert.equal(onboardingSource.includes('表单占位已变更'), true);
  assert.equal(onboardingSource.includes('发布时会与同集群其他业务片段合并成完整 collector.yaml'), true);
  assert.equal(onboardingSource.includes('完整 collector.yaml · 同集群业务片段合并结果'), true);
  assert.equal(onboardingSource.includes('Runtime 日志目录'), false);
  assert.equal(onboardingSource.includes('runtimeLogPaths'), false);
});

test('Logs 接入配置以渐进任务卡承载服务、目标、端点和发布动作', () => {
  assert.equal(onboardingSource.includes('logs-route-task-stack'), true);
  assert.equal(onboardingSource.includes('logs-route-task-card'), true);
  assert.equal(onboardingSource.includes('logs-route-service-card'), true);
  assert.equal(onboardingSource.includes('logs-route-target-card'), true);
  assert.equal(onboardingSource.includes('logs-route-endpoint-card'), true);
  assert.equal(onboardingSource.includes('logs-route-config-card'), true);
  assert.equal(onboardingSource.includes('logs-route-preview-card'), true);
  assert.equal(onboardingSource.includes('logs-route-summary-card'), true);
  assert.equal(onboardingSource.includes('lg:grid-cols-[minmax(0,1fr)_320px]'), true);
  assert.equal(onboardingSource.includes('logs-runtime-configuration-panel'), true);
  assert.equal(onboardingSource.includes('logs-runtime-configuration-panel grid items-start'), false);
  assert.equal(onboardingSource.includes('logs-endpoint-picker'), true);
  assert.equal(onboardingSource.includes('<DataPanel title="日志下游端点"'), false);
  assert.equal(onboardingSource.includes('<DataPanel title="业务采集配置"'), false);
  assert.equal(onboardingSource.includes('xl:grid-cols-[minmax(0,1fr)_360px]'), false);
  assert.equal(onboardingSource.includes('<SummaryCard'), false);
  assert.equal(onboardingSource.includes('logs-onboarding-action-bar'), false);
  assert.equal(onboardingSource.includes('lg:sticky lg:bottom-3'), false);
  assert.equal(servicePickerSource.includes('logs-service-picker-panel relative flex min-h-[560px] flex-col'), true);
  assert.equal(servicePickerSource.includes('xl:h-full'), true);
});

test('Logs K8s 服务同步必须先显式选择集群和 Namespace', () => {
  assert.equal(onboardingSource.includes("const [syncClusterId, setSyncClusterId] = useState('')"), true);
  assert.equal(onboardingSource.includes("const [syncNamespace, setSyncNamespace] = useState('')"), true);
  assert.equal(onboardingSource.includes('logs-service-sync-action'), true);
  assert.equal(onboardingSource.includes('logs-service-sync-trigger'), true);
  assert.equal(onboardingSource.includes('logs-service-sync-dialog'), true);
  assert.equal(onboardingSource.includes('logs-service-sync-scope'), false);
  assert.equal(onboardingSource.includes('确认同步'), true);
  assert.equal(onboardingSource.includes("clusterId: syncClusterId"), true);
  assert.equal(onboardingSource.includes("namespace: syncNamespace"), true);
  assert.equal(onboardingSource.includes('请选择同步集群'), true);
  assert.equal(onboardingSource.includes('请选择同步 Namespace'), true);
  assert.equal(onboardingSource.includes('result.services[0]'), false);
});

test('Logs 创建采集路由来源选择位于左侧任务上下文', () => {
  assert.equal(onboardingSource.includes('logs-source-mode-switch'), true);
  assert.equal(onboardingSource.includes('aria-label="采集来源"'), true);
  assert.equal(onboardingSource.includes('context={('), true);
  assert.equal(onboardingSource.includes('action={('), false);
});

test('Logs 接入配置按当前任务步骤渐进展示', () => {
  assert.equal(onboardingSource.includes('const [currentStep, setCurrentStep] = useState<OnboardingStep>(1)'), true);
  assert.equal(onboardingSource.includes("const [setupTask, setSetupTask] = useState<SetupTask>('service')"), true);
  assert.equal(onboardingSource.includes("active={currentStep === 1 && setupTask === 'service'}"), true);
  assert.equal(onboardingSource.includes('active={currentStep === 2}'), true);
  assert.equal(onboardingSource.includes('active={currentStep === 3}'), true);
  assert.equal(onboardingSource.includes('md:grid-cols-3'), false);
  assert.equal(onboardingSource.includes('下一步：采集配置'), true);
  assert.equal(onboardingSource.includes('activeStep'), false);
});

test('采集路由任务页通过父模块子路径更新并保留只读集群过滤', () => {
  assert.equal(onboardingSource.includes("const { id: onboardingRouteId = '' } = useParams()"), true);
  assert.equal(onboardingSource.includes('const routeUpdateMode = Boolean(onboardingRouteId)'), true);
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
  assert.equal(agentsSource.includes('aria-label="采集路由工作区"'), true);
  assert.equal(agentsSource.includes('路由运行状态'), false);
  assert.equal(agentsSource.includes('<LogsSection'), false);
  assert.equal(agentsSource.includes('运行概览'), true);
  assert.equal(agentsSource.includes('Agent 实例'), true);
  assert.equal(agentsSource.includes('暂无 Agent 心跳数据'), true);
  assert.equal(agentsSource.includes('logsApi.getRouteCollectorConfig'), true);
  assert.equal(agentsSource.includes('完整 collector.yaml'), true);
  assert.equal(agentsSource.includes('非 K8s 部署清单'), true);
  assert.equal(agentsSource.includes('部署清单 hash'), true);
  assert.equal(agentsSource.includes('/logs/agents/${contextRoute.route.id}/edit'), true);
  assert.equal(agentsSource.includes('实例状态'), false);
  assert.equal(agentsSource.includes('<DomainMetric label="Audit"'), false);
  assert.equal(agentsSource.includes('<DomainMetric label="Preview"'), false);
  assert.equal(agentsSource.includes('<DomainMetric label="下游端点"'), false);
  assert.equal(agentsSource.includes('<LogsInfoCell label="运行实例"'), false);
  assert.equal(agentsSource.includes('<LogsInfoCell label="运行身份来源"'), false);
  assert.equal(agentsSource.includes('<LogsInfoCell label="采集配置"'), false);
  assert.equal(agentsSource.includes('<LogsInfoCell label="部署状态"'), false);
});

test('Logs Explore 只展示真实下游查询入口', () => {
  assert.equal(exploreSource.includes('logs-explore-workbench'), true);
  assert.equal(exploreSource.includes('新窗口'), true);
  assert.equal(exploreSource.includes('创建告警'), true);
  assert.equal(exploreSource.includes('查看采集路由'), true);
  assert.equal(exploreSource.includes('Log query'), false);
  assert.equal(exploreSource.includes('Rows3'), false);
  assert.equal(exploreSource.includes('Table2'), false);
  assert.equal(exploreSource.includes("viewMode"), false);
  assert.equal(exploreSource.includes('buildVictoriaLogsVMUIURL'), true);
  assert.equal(exploreSource.includes('租户'), true);
});

test('Logs Explore 将路由收敛为顶部一次性选择并突出检索主区域', () => {
  assert.equal(exploreSource.includes('<LogsSection title="日志路由"'), false);
  assert.equal(exploreSource.includes('title="日志分析"'), false);
  assert.equal(exploreSource.includes('xl:grid-cols-[minmax(0,1fr)_300px]'), true);
  assert.equal(exploreSource.includes('{routes.length} routes'), false);
  assert.equal(exploreSource.includes('<RouteSelector'), true);
  assert.equal(exploreSource.includes('route-selector-trigger'), true);
  assert.equal(exploreSource.includes('route-option-context'), true);
  assert.equal(exploreSource.includes('query-context-summary'), true);
  assert.equal((exploreSource.match(/logs-explore-context-panel/g) ?? []).length, 2);
  assert.equal((exploreSource.match(/logs-explore-context-header/g) ?? []).length, 2);
  assert.equal(exploreSource.includes('logs-explore-query-actions'), true);
  assert.equal(exploreSource.includes('aria-label="在新窗口打开查询"'), true);
  assert.equal(exploreSource.includes('aria-label="刷新日志上下文"'), true);
  assert.equal(exploreSource.includes('route-selector-popover'), true);
  assert.equal(exploreSource.includes('createPortal'), true);
  assert.equal(exploreSource.includes('<details'), false);
  assert.equal(exploreSource.includes('<select'), false);
  assert.equal(exploreSource.includes('routeQuery'), false);
  assert.equal(exploreSource.includes('过滤 service / endpoint'), false);
  assert.equal(exploreSource.includes('打开 VMUI'), false);
  assert.equal(exploreSource.includes('新窗口'), true);
  assert.equal((exploreSource.match(/创建告警/g) ?? []).length, 1);
  assert.equal((exploreSource.match(/查看采集路由/g) ?? []).length, 1);
});

test('Logs 工作台将可用高度传递给采集路由和日志分析内容区域', () => {
  assert.equal(workspaceSource.includes('logs-workbench route-transition-page flex h-full min-h-0 flex-col gap-3'), true);
  assert.equal(workspaceSource.includes('route-transition-page min-h-0 flex-1'), true);
  assert.equal(agentsSource.includes('logs-routes-workbench flex min-h-[720px] flex-col xl:h-full xl:min-h-0'), true);
  assert.equal(agentsSource.includes('logs-routes-content grid min-h-0 flex-1'), true);
  assert.equal(agentsSource.includes('采集路由工作区'), true);
  assert.equal((agentsSource.match(/>刷新</g) ?? []).length, 1);
  assert.equal(exploreSource.includes('logs-explore-workbench grid min-h-[760px] gap-3 xl:h-full xl:min-h-0'), true);
  assert.equal(agentsSource.includes('max-h-[720px]'), false);
  assert.equal(exploreSource.includes('max-h-[680px]'), false);
  assert.equal(exploreSource.includes('h-[650px]'), false);
});

test('Logs 告警和模块导航保留已闭环入口', () => {
  assert.equal(workspaceSource.includes('日志分析'), true);
  assert.equal(workspaceSource.includes('接入配置'), true);
  assert.equal(workspaceSource.includes('采集路由'), true);
  assert.equal(workspaceSource.includes('日志告警'), true);
  assert.equal(alertsSource.includes('日志告警规则'), false);
  assert.equal(alertsSource.includes('`${filteredRules.length}/${logRules.length} rules · ${enabledCount} enabled`'), false);
  assert.equal(alertsSource.includes('暂无日志告警'), true);
  assert.equal(alertsSource.includes('告警中心'), true);
  assert.equal(alertsSource.includes('规则上下文'), false);
  assert.equal(alertsSource.includes('规则字段'), false);
});
