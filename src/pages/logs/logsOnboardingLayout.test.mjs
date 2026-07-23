import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const onboardingSource = readFileSync(new URL('./LogsOnboardingPage.tsx', import.meta.url), 'utf8');
const servicePickerSource = readFileSync(new URL('./ServicePickerPanel.tsx', import.meta.url), 'utf8');
const workspaceSource = readFileSync(new URL('./LogsWorkspace.tsx', import.meta.url), 'utf8');
const exploreSource = readFileSync(new URL('./LogsExplorePage.tsx', import.meta.url), 'utf8');
const agentsSource = readFileSync(new URL('./LogsAgentsPage.tsx', import.meta.url), 'utf8');
const alertsSource = readFileSync(new URL('./LogsAlertsPage.tsx', import.meta.url), 'utf8');
const alertRuleSource = readFileSync(new URL('./LogsAlertRulePage.tsx', import.meta.url), 'utf8');
const publishPreviewSource = readFileSync(new URL('./LogsPublishPreviewPanel.tsx', import.meta.url), 'utf8');

test('Logs 接入配置收敛为接入和发布路径', () => {
  assert.equal(onboardingSource.includes('logs-onboarding-toolbar'), false);
  assert.equal(onboardingSource.includes('aria-label="采集路由步骤"'), true);
  assert.equal(onboardingSource.includes('logs-runtime-configuration-panel'), true);
  assert.equal(onboardingSource.includes('运行目标'), false);
  assert.equal(onboardingSource.includes('targetId'), false);
  assert.equal(onboardingSource.includes('日志下游端点'), true);
  assert.equal(onboardingSource.includes('业务采集配置'), true);
  assert.equal(onboardingSource.includes('发布预览'), false);
  assert.equal(onboardingSource.includes('配置预览'), true);
  assert.equal(onboardingSource.includes('生成预览'), true);
  assert.equal(onboardingSource.includes('保存草稿'), true);
  assert.equal(onboardingSource.includes('确认发布'), false);
  assert.equal(onboardingSource.includes('连通性检查'), false);
  assert.equal(onboardingSource.includes('resolvePersistedRouteClusterId(createdRoute?.source, clusterId)'), true);
  assert.equal(onboardingSource.includes('formatClusterIdentity(cluster)'), true);
});

test('VM 日志接入使用手工安装与节点回填，不再表达平台自动发布', () => {
  assert.equal(onboardingSource.includes('主机组<input'), true);
  assert.equal(onboardingSource.includes('主机标签<input'), false);
  assert.equal(onboardingSource.includes('logsApi.publishRoute'), false);
  assert.equal(onboardingSource.includes('部署清单预览'), false);
  assert.equal(onboardingSource.includes('手工安装'), true);
  assert.equal(onboardingSource.includes('VM 节点'), true);
  assert.equal(onboardingSource.includes('名称,host:port'), true);
  assert.equal(onboardingSource.includes('地址可达不代表采集中'), true);
  assert.equal(onboardingSource.includes('安装脚本写入每台 VM 的 Collector 配置'), true);
  assert.equal(onboardingSource.includes('保存路由后获取安装材料'), true);
  assert.equal(onboardingSource.includes('logsApi.getVMInstallation'), true);
  assert.equal(onboardingSource.includes('logsApi.listVMAgentEndpoints'), true);
  assert.equal(onboardingSource.includes('logsApi.createVMAgentEndpoint'), true);
  assert.equal(onboardingSource.includes('logsApi.probeVMAgentEndpoint'), true);
  assert.equal(onboardingSource.includes('logsApi.deleteVMAgentEndpoint'), true);
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
  assert.equal(onboardingSource.includes('LogsPublishPreviewPanel'), false);
  assert.equal(onboardingSource.includes('publishLogsCollectorRuntime'), false);
  assert.equal(onboardingSource.includes('getLogsCollectorRuntimeStatus'), true);
  assert.equal(onboardingSource.includes('/k8s/observability?cluster_id='), true);
  assert.equal(onboardingSource.includes('启用集群观测接入'), true);
  assert.equal(onboardingSource.includes('前往观测接入'), true);
});

test('Logs 接入配置以服务 ConfigMap 片段作为主要编辑对象', () => {
  assert.equal(onboardingSource.includes('renderK8sRouteFragmentDraft'), true);
  assert.equal(onboardingSource.includes('collectorFragmentYAML'), true);
  assert.equal(onboardingSource.includes('collector_fragment_yaml'), false);
  assert.equal(onboardingSource.includes('service config fragment'), true);
  assert.equal(onboardingSource.includes('重新生成示例'), true);
  assert.equal(onboardingSource.includes('表单占位已变更'), true);
  assert.equal(onboardingSource.includes('路由会作为业务片段由运行时统一合并发布'), false);
  assert.equal(onboardingSource.includes('集群 logs_collector 基础组件已就绪，路由会生成当前服务独立 ConfigMap，并由 DaemonSet 按文件集合加载'), true);
  assert.equal(onboardingSource.includes('发布后写入当前服务独立 ConfigMap，并由 DaemonSet 按文件集合加载'), true);
  assert.equal(onboardingSource.includes('logs-route-config-editor'), true);
  assert.equal(onboardingSource.includes('bodyClassName="min-h-0 flex-1 overflow-hidden bg-surface/35"'), true);
  assert.equal(onboardingSource.includes('logs-route-config-editor min-h-0 flex-1 resize-none overflow-auto'), true);
  assert.equal(onboardingSource.includes('logs-route-preview-code-grid'), true);
  assert.equal(onboardingSource.includes('RoutePreviewCodePanel'), true);
  assert.equal(onboardingSource.includes('完整 collector.yaml'), false);
  assert.equal(onboardingSource.includes('采集域合并视图'), true);
  assert.equal(onboardingSource.includes('当前服务 ConfigMap 片段'), true);
  assert.equal(onboardingSource.includes('只读校验视图，发布时按多 ConfigMap 文件集合加载'), true);
  assert.equal(publishPreviewSource.includes('logs-publish-preview-panel'), true);
  assert.equal(onboardingSource.includes('Runtime 日志目录'), false);
  assert.equal(onboardingSource.includes('runtimeLogPaths'), false);
});

test('观测接入发布预览展示完整资源部署 YAML', () => {
  assert.equal(publishPreviewSource.includes('完整资源部署 YAML'), true);
  assert.equal(publishPreviewSource.includes('变更 ConfigMap'), true);
  assert.equal(publishPreviewSource.includes('preview.manifestYAML'), true);
  assert.equal(publishPreviewSource.includes('资源部署 YAML 为空'), true);
  assert.equal(publishPreviewSource.includes('navigator.clipboard?.writeText(preview.manifestYAML'), true);
  assert.equal(publishPreviewSource.includes('<th>Hash</th>'), false);
  assert.equal(publishPreviewSource.includes('preview {shortHash'), false);
  assert.equal(publishPreviewSource.includes('<th>配置结果</th>'), false);
  assert.equal(publishPreviewSource.includes('资源清单已生成'), false);
  assert.equal(publishPreviewSource.includes('部署预览已生成'), false);
});

test('Logs 接入配置以三栏画布承载服务、采集来源、端点和发布动作', () => {
  assert.equal(onboardingSource.includes('task=incremental'), true);
  assert.equal(onboardingSource.includes('logs-route-task-stack'), true);
  assert.equal(onboardingSource.includes('logs-route-canvas'), true);
  assert.equal(onboardingSource.includes('logs-route-canvas mt-3 grid min-h-0 min-w-0 flex-1 gap-3 overflow-hidden'), true);
  assert.equal(onboardingSource.includes('logs-route-stepper'), true);
  assert.equal(onboardingSource.includes('logs-route-active-panel'), true);
  assert.equal(onboardingSource.includes('logs-route-active-panel flex min-h-0 min-w-0 flex-1'), true);
  assert.equal(onboardingSource.includes('logs-route-task-stack flex min-h-0 min-w-0 flex-col overflow-hidden'), true);
  assert.equal(onboardingSource.includes("if (!sourceReady) return;"), true);
  assert.equal(onboardingSource.includes('if (!active) return null;'), true);
  assert.equal(onboardingSource.includes("const statusLabel = disabled ? '待前置'"), true);
  assert.equal(onboardingSource.includes('logs-route-task-card'), false);
  assert.equal(onboardingSource.includes('logs-route-service-card'), true);
  assert.equal(onboardingSource.includes('logs-route-source-card'), true);
  assert.equal(onboardingSource.includes('logs-route-endpoint-card'), true);
  assert.equal(onboardingSource.includes('logs-route-config-card'), true);
  assert.equal(onboardingSource.includes('logs-route-preview-card'), true);
  assert.equal(onboardingSource.includes('logs-route-summary-card'), true);
  assert.equal(onboardingSource.includes('configSnippet'), false);
  assert.equal(onboardingSource.includes('<SummaryGroup title="配置片段">'), false);
  assert.equal(onboardingSource.includes('xl:grid-cols-[220px_minmax(0,1fr)_340px]'), true);
  assert.equal(onboardingSource.includes('2xl:grid-cols-[240px_minmax(0,1fr)_380px]'), true);
  assert.equal(onboardingSource.includes('lg:grid-cols-[minmax(0,1fr)_320px]'), false);
  assert.equal(onboardingSource.includes('logs-runtime-configuration-panel'), true);
  assert.equal(onboardingSource.includes('logs-runtime-configuration-panel grid items-start'), false);
  assert.equal(onboardingSource.includes('logs-endpoint-picker'), true);
  assert.equal(onboardingSource.includes('<DataPanel title="日志下游端点"'), false);
  assert.equal(onboardingSource.includes('<DataPanel title="业务采集配置"'), false);
  assert.equal(onboardingSource.includes('xl:grid-cols-[minmax(0,1fr)_360px]'), false);
  assert.equal(onboardingSource.includes('<SummaryCard'), false);
  assert.equal(onboardingSource.includes('logs-onboarding-action-bar'), false);
  assert.equal(onboardingSource.includes('lg:sticky lg:bottom-3'), false);
  assert.equal(servicePickerSource.includes('logs-service-picker-table'), true);
  assert.equal(servicePickerSource.includes('搜索服务名称、Key 或 Owner'), true);
  assert.equal(servicePickerSource.includes('logs-service-picker-panel relative flex min-h-[520px] flex-col'), true);
  assert.equal(servicePickerSource.includes('xl:h-full'), true);
});

test('Logs K8s 服务同步必须先显式选择集群和 Namespace', () => {
  assert.equal(onboardingSource.includes("const [syncClusterId, setSyncClusterId] = useState('')"), true);
  assert.equal(onboardingSource.includes("const [syncNamespace, setSyncNamespace] = useState('')"), true);
  assert.equal(servicePickerSource.includes('logs-service-picker-toolbar'), true);
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

test('Logs K8s Workload 默认选择不覆盖用户手动选择', () => {
  assert.equal(onboardingSource.includes('const defaultWorkloadKey = sourceType === \'vm_file\''), true);
  assert.equal(onboardingSource.includes("serviceScopeWorkloadKey || (workloads[0] ? workloadIdentity(workloads[0]) : '')"), true);
  assert.equal(onboardingSource.includes("if (sourceType === 'vm_file' || workloadKey || !defaultWorkloadKey) return;"), true);
  assert.equal(onboardingSource.includes('setWorkloadKey(defaultWorkloadKey)'), true);
  assert.equal(onboardingSource.includes('workloadKey !== serviceScopeWorkloadKey'), false);
  assert.equal(onboardingSource.includes('setWorkloadKey(serviceScopeWorkloadKey)'), false);
});

test('Logs 选择服务后进入采集来源配置', () => {
  assert.equal(onboardingSource.includes("setSetupTask('source')"), true);
  assert.equal(onboardingSource.includes("currentStep === 1 && setupTask === 'source' && sourceReady"), false);
});

test('Logs 创建采集路由来源选择位于左侧任务上下文', () => {
  assert.equal(onboardingSource.includes('logs-source-mode-switch'), true);
  assert.equal(onboardingSource.includes('aria-label="采集来源"'), true);
  assert.equal(onboardingSource.includes('context={sourceModeSwitch}'), true);
  assert.equal(onboardingSource.includes('action={('), true);
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
	assert.equal(onboardingSource.includes("const { productId = '', serviceId: pathServiceId = '', id: onboardingRouteId = '' } = useParams()"), true);
  assert.equal(onboardingSource.includes('const routeUpdateMode = Boolean(onboardingRouteId)'), true);
  assert.equal(onboardingSource.includes('loadRouteDraft'), true);
  assert.equal(onboardingSource.includes('routeScopedServices'), true);
  assert.equal(onboardingSource.includes('clusters.filter((cluster) => !cluster.readOnly)'), true);
  assert.equal(onboardingSource.includes('platformEnvironmentsQuery'), false);
  assert.equal(onboardingSource.includes('route.route.environmentId'), false);
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
  assert.equal(agentsSource.includes('服务 ConfigMap 片段'), true);
  assert.equal(agentsSource.includes('采集域合并视图'), true);
  assert.equal(agentsSource.includes('部署清单 hash'), false);
  assert.equal(agentsSource.includes('部署清单状态'), false);
  assert.equal(agentsSource.includes('采集配置状态'), false);
  assert.equal(agentsSource.includes('采集配置已生成'), false);
  assert.equal(agentsSource.includes('<th>Hash</th>'), false);
  assert.equal(agentsSource.includes('shortHash'), false);
	assert.equal(agentsSource.includes('`${base}/agents/${contextRoute.route.id}/edit`'), true);
  assert.equal(agentsSource.includes('实例状态'), false);
  assert.equal(agentsSource.includes('<DomainMetric label="Audit"'), false);
  assert.equal(agentsSource.includes('<DomainMetric label="Preview"'), false);
  assert.equal(agentsSource.includes('<DomainMetric label="下游端点"'), false);
  assert.equal(agentsSource.includes('<LogsInfoCell label="运行实例"'), false);
  assert.equal(agentsSource.includes('<LogsInfoCell label="运行身份来源"'), false);
  assert.equal(agentsSource.includes('<LogsInfoCell label="采集配置"'), false);
  assert.equal(agentsSource.includes('<LogsInfoCell label="部署状态"'), false);
});

test('Logs Explore 以 kiosk 模式嵌入已同步的产品 Grafana 数据源', () => {
  assert.equal(exploreSource.includes('logs-explore-workbench'), true);
  assert.equal(exploreSource.includes('新窗口'), false);
  assert.equal(exploreSource.includes('getGrafanaProductIntegration'), true);
  assert.equal(exploreSource.includes('buildGrafanaExploreURL'), true);
  assert.equal(exploreSource.includes("kiosk: '1'"), true);
  assert.equal(exploreSource.includes("'service.name'"), true);
  assert.equal(exploreSource.includes('novaapm.service_id'), true);
  assert.equal(exploreSource.includes('":='), false);
  assert.equal(exploreSource.includes('不会回退到 Grafana 的 0:0 默认数据源'), true);
  assert.equal(exploreSource.includes('endpoint_id'), true);
  assert.equal(exploreSource.includes('/logs/targets'), false);
  assert.equal(exploreSource.includes('查看日志目标'), false);
  assert.equal(exploreSource.includes('Log query'), false);
  assert.equal(exploreSource.includes('Rows3'), false);
  assert.equal(exploreSource.includes('Table2'), false);
  assert.equal(exploreSource.includes("viewMode"), false);
  assert.equal(exploreSource.includes('buildVictoriaLogsVMUIURL'), false);
  assert.equal(exploreSource.includes('租户'), true);
});

test('Logs Explore 固定使用路径服务上下文并突出检索主区域', () => {
  assert.equal(exploreSource.includes('<LogsSection title="日志路由"'), false);
  assert.equal(exploreSource.includes('title="日志分析"'), false);
  assert.equal(exploreSource.includes('xl:grid-cols-[minmax(0,1fr)_300px]'), true);
  assert.equal(exploreSource.includes('{routes.length} routes'), false);
	assert.equal(exploreSource.includes('useParams'), true);
	assert.equal(exploreSource.includes("const { productId = '', serviceId = '' } = useParams()"), true);
	assert.equal(exploreSource.includes('<LogsEntitySelector<ServiceLogLink>'), false);
  assert.equal(exploreSource.includes('<ServiceContextSelector'), true);
	assert.equal(exploreSource.includes('service-option-context'), false);
	assert.equal(exploreSource.includes('service_id'), true);
  assert.equal(exploreSource.includes('采集配置 hash'), false);
  assert.equal(exploreSource.includes('采集配置状态'), false);
  assert.equal(exploreSource.includes('Datasource UID'), true);
  assert.equal(exploreSource.includes('选择日志 Endpoint'), true);
  assert.equal(exploreSource.includes('<details'), false);
  assert.equal(exploreSource.includes('routeQuery'), false);
  assert.equal(exploreSource.includes('过滤 service / endpoint'), false);
  assert.equal(exploreSource.includes('打开 VMUI'), false);
  assert.equal(exploreSource.includes('新窗口'), false);
  assert.equal((exploreSource.match(/创建告警/g) ?? []).length, 0);
  assert.equal((exploreSource.match(/查看采集路由/g) ?? []).length, 0);
});

test('Logs 工作台将可用高度传递给采集路由和日志分析内容区域', () => {
  assert.equal(workspaceSource.includes('ModuleWorkbench'), true);
  assert.equal(workspaceSource.includes('module="logs"'), true);
  assert.equal(agentsSource.includes('logs-routes-workbench flex min-h-[720px] flex-col xl:h-full xl:min-h-0'), true);
  assert.equal(agentsSource.includes('logs-routes-content flex min-h-0 flex-1 flex-col'), true);
  assert.equal(agentsSource.includes('采集路由工作区'), true);
  assert.equal((agentsSource.match(/>刷新</g) ?? []).length, 1);
  assert.equal(exploreSource.includes('logs-explore-workbench grid min-h-[720px] gap-3 xl:h-full xl:min-h-0'), true);
  assert.equal(agentsSource.includes('max-h-[720px]'), false);
  assert.equal(exploreSource.includes('max-h-[680px]'), false);
  assert.equal(exploreSource.includes('h-[650px]'), false);
});

test('Logs 模块导航只保留服务级闭环入口', () => {
  assert.equal(workspaceSource.includes('日志分析'), true);
  assert.equal(workspaceSource.includes('接入配置'), false);
  assert.equal(workspaceSource.includes('日志采集'), true);
  assert.equal(workspaceSource.includes('日志告警'), true);
  assert.equal(alertsSource.includes('日志告警规则'), false);
  assert.equal(alertsSource.includes('`${filteredRules.length}/${logRules.length} rules · ${enabledCount} enabled`'), false);
  assert.equal(alertsSource.includes('暂无日志告警'), true);
  assert.equal(alertsSource.includes('告警中心'), false);
  assert.equal(alertRuleSource.includes('告警中心'), false);
  assert.equal(alertsSource.includes('规则上下文'), false);
  assert.equal(alertsSource.includes('规则字段'), false);
});
