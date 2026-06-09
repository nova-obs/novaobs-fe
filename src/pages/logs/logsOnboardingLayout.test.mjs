import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./LogsOnboardingPage.tsx', import.meta.url), 'utf8');
const servicePickerSource = readFileSync(new URL('./ServicePickerPanel.tsx', import.meta.url), 'utf8');
const pageAndServicePickerSource = `${source}\n${servicePickerSource}`;
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
  assert.equal(source.includes('xl:grid-cols-[380px_minmax(0,1fr)]'), true);
  assert.equal(source.includes('<ServicePickerPanel'), true);
  assert.equal(servicePickerSource.includes('function ServiceAccessCard'), true);
  assert.equal(servicePickerSource.includes('export function ServicePickerPanel'), true);
  assert.equal(servicePickerSource.includes('logs-service-picker-panel'), true);
  assert.equal(pageAndServicePickerSource.includes('搜索服务'), true);
  assert.equal(source.includes('applyServiceRuntimeScope'), true);
  assert.equal(source.includes('resolveServiceWorkloadKey'), true);
  assert.equal(source.includes('service.cluster'), true);
  assert.equal(source.includes('service.namespace'), true);
  assert.equal(servicePickerSource.includes('service-card-runtime-grid'), true);
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
  assert.equal(source.includes('管理端点'), true);
  assert.equal(source.includes('to="/platform/observability"'), true);
  assert.equal(source.includes('接入配置只选择已登记端点'), true);
  assert.equal(source.includes('新增端点'), false);
  assert.equal(source.includes('编辑端点'), false);
  assert.equal(source.includes('endpointEditId'), false);
  assert.equal(source.includes('endpointCreateOpen'), false);
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

test('Logs 接入配置不把只读 K8s 集群作为可选接入目标', () => {
  assert.equal(source.includes('writableClusters'), true);
  assert.equal(source.includes('clusters.filter((cluster) => !cluster.readOnly)'), true);
  assert.equal(source.includes('writableClusterIds'), true);
  assert.equal(source.includes('service.cluster && !writableClusterIds.has(service.cluster)'), true);
  assert.equal(source.includes('writableClusters.length === 0 ? <Empty label="暂无可发布集群" />'), true);
  assert.equal(source.includes('writableClusters.map((cluster)'), true);
  assert.equal(source.includes('cluster.readOnly ?'), false);
  assert.equal(source.includes("{cluster.readOnly ? '只读' : '可发布'}"), false);
});

test('Logs 接入配置服务列表展示接入状态，避免重复选择生产服务', () => {
  assert.equal(source.includes('serviceRoutesByService'), true);
  assert.equal(source.includes('runningRouteServiceIds'), true);
  assert.equal(source.includes('routes.filter(isCollectingRoute).map((route) => route.route.serviceId)'), true);
  assert.equal(source.includes('accessServices'), true);
  assert.equal(source.includes('editingRouteScopedServices'), true);
  assert.equal(source.includes('sourceServices.filter((service) => !runningRouteServiceIds.has(service.id))'), true);
  assert.equal(source.includes('serviceListSourceCount'), true);
  assert.equal(source.includes('editingRouteScopedServices ? accessServices.length : sourceServices.length'), true);
  assert.equal(source.includes('serviceListTotalCount'), true);
  assert.equal(source.includes('editingRouteScopedServices ? accessServices.length : services.length'), true);
  assert.equal(pageAndServicePickerSource.includes('serviceAccessState'), true);
  assert.equal(pageAndServicePickerSource.includes('采集中'), true);
  assert.equal(pageAndServicePickerSource.includes('未接入'), true);
  assert.equal(servicePickerSource.includes('logs-service-access-card'), true);
  assert.equal(servicePickerSource.includes('serviceAccessCardClass'), true);
  assert.equal(servicePickerSource.includes('selectedServiceAccessCardClass'), true);
  assert.equal(servicePickerSource.includes('runningServiceAccessCardClass'), true);
  assert.equal(servicePickerSource.includes('bg-primary-soft/80'), false);
  assert.equal(servicePickerSource.includes('0_0_0_1px_rgba(13,91,215,0.18)'), true);
  assert.equal(pageAndServicePickerSource.includes('routeAccessPriority'), true);
  assert.equal(servicePickerSource.includes('routeLifecycle(serviceRoutes[0])'), true);
  assert.equal(servicePickerSource.includes('查看配置'), false);
  assert.equal(servicePickerSource.includes('查看中'), false);
  assert.equal(servicePickerSource.includes('onViewRoute'), false);
  assert.equal(source.includes('route.route.serviceId'), true);
  assert.equal(pageAndServicePickerSource.includes('已有日志路由'), false);
});

test('Logs 接入配置选择未发布登记路由服务时回填草稿', () => {
  assert.equal(source.includes('nonRunningServiceRoute'), true);
  assert.equal(source.includes('serviceRoutesByService.get(service.id)?.find((route) => !isCollectingRoute(route))'), true);
  assert.equal(source.includes('beginRouteEdit(nonRunningRoute);'), true);
  assert.equal(source.includes('viewRouteConfig(serviceRoute);'), false);
});

test('Logs 接入配置运行路由更新态锁定当前 route 上下文', () => {
  assert.equal(source.includes('routeScopedServices'), true);
  assert.equal(source.includes('if (!routeUpdateMode) return null;'), true);
  assert.equal(source.includes('if (!selectedRoute) return [];'), true);
  assert.equal(source.includes('routeScopedServices ?? sourceServices.filter'), true);
  assert.equal(source.includes('routeUpdateMode && selectedRoute'), true);
  assert.equal(source.includes('loadRouteDraft(selectedRoute, { edit: true })'), true);
  assert.equal(source.includes('disabled={routeUpdateMode}'), true);
  assert.equal(source.includes('locked={routeUpdateMode}'), true);
  assert.equal(servicePickerSource.includes('locked?: boolean'), true);
  assert.equal(servicePickerSource.includes('disabled={locked}'), true);
  assert.equal(servicePickerSource.includes("placeholder={locked ? '当前路由服务' : '搜索服务'}"), true);
  assert.equal(source.includes('if (routeUpdateMode) return;'), true);
  assert.equal(source.includes('未找到待更新的采集路由'), true);
  assert.equal(source.includes('routeUpdateMode || sourceType ==='), true);
});

test('Logs 接入配置运行路由回填优先使用 route 里的 K8s 范围', () => {
  assert.equal(source.includes('namespaceOptions'), true);
  assert.equal(source.includes('routeUpdateMode && namespace && !items.some((item) => item.name === namespace)'), true);
  assert.equal(source.includes('selectedWorkloadFromApi'), true);
  assert.equal(source.includes('restoredWorkload'), true);
  assert.equal(source.includes('selectedWorkloadFromApi ?? (routeUpdateMode ? restoredWorkload : null)'), true);
  assert.equal(source.includes('displayedWorkloads'), true);
  assert.equal(source.includes('displayedWorkloadTotal'), true);
  assert.equal(source.includes('if (routeUpdateMode) return;'), true);
  assert.equal(source.includes('workloadFromRouteSource(restoredSource)'), true);
  assert.equal(source.includes('namespaceOptions.map((item)'), true);
  assert.equal(source.includes('displayedWorkloads.map((item)'), true);
  assert.equal(source.includes('Math.max(workloads.length, displayedWorkloads.length)'), true);
  assert.equal(source.includes('workloadName: selectedWorkload?.name || restoredSource?.workloadName'), true);
  assert.equal(source.includes('workloadKind: selectedWorkload?.kind || restoredSource?.workloadKind'), true);
});

test('Logs 接入配置服务列表充分展示服务上下文', () => {
  assert.equal(source.includes('xl:grid-cols-[380px_minmax(0,1fr)]'), true);
  assert.equal(servicePickerSource.includes('service-card-primary'), true);
  assert.equal(servicePickerSource.includes('service-card-meta-grid'), true);
  assert.equal(servicePickerSource.includes('service-card-runtime-grid'), true);
  assert.equal(servicePickerSource.includes('flex min-h-[560px] flex-col'), true);
  assert.equal(servicePickerSource.includes('min-h-0 flex-1 overflow-auto p-2'), true);
  assert.equal(servicePickerSource.includes('whitespace-normal break-words'), true);
  assert.equal(servicePickerSource.includes('break-all'), true);
  assert.equal(servicePickerSource.includes('max-h-72 overflow-auto p-2'), false);
  assert.equal(servicePickerSource.includes('min-w-0 truncate text-sm font-semibold'), false);
  assert.equal(servicePickerSource.includes('truncate font-mono text-[11px] font-semibold text-muted'), false);
  assert.equal(servicePickerSource.includes('服务选择后绑定运行目标 ·'), false);
});

test('Logs 接入配置采集中服务默认锁定已生效配置', () => {
  assert.equal(source.includes('routeEditMode'), true);
  assert.equal(source.includes('collectingRoute'), true);
  assert.equal(source.includes('isCollectingRoute'), true);
  assert.equal(source.includes('collectingConfigLocked'), true);
  assert.equal(source.includes('RunningConfigVeil'), true);
  assert.equal(source.includes('running-config-veil'), true);
  assert.equal(source.includes('pointer-events-auto absolute inset-0'), true);
  assert.equal(source.includes('<section className="relative overflow-hidden rounded-lg border border-outline bg-surface-lowest">'), true);
  assert.equal(source.includes('pointer-events-none absolute inset-0'), false);
  assert.equal(source.includes('onEditRoute={beginRouteEdit}'), true);
  assert.equal(servicePickerSource.includes('onEditRoute(serviceRoute);'), true);
  assert.equal(servicePickerSource.includes('event.stopPropagation();'), true);
  assert.equal(pageAndServicePickerSource.includes('更新配置'), true);
  assert.equal(servicePickerSource.includes('查看配置'), false);
  assert.equal(source.includes('CollectingModeNotice'), false);
  assert.equal(source.includes('logs-collecting-mode-notice'), false);
  assert.equal(source.includes('退出编辑'), false);
  assert.equal(source.includes('当前服务正在采集'), false);
  assert.equal(source.includes('右侧区域展示当前生产采集配置'), false);
  assert.equal(source.includes('当前采集配置'), true);
  assert.equal(source.includes('当前采集配置处于查看态'), true);
  assert.equal(source.includes('function viewRouteConfig'), false);
  assert.equal(source.includes('viewRouteConfig(serviceRoute);'), false);
  assert.equal(source.includes('loadRouteDraft(serviceRoute);'), false);
  assert.equal(source.includes('function RunningConfigVeil()'), true);
  assert.equal(source.includes('right-3 top-3'), false);
  assert.equal(source.includes('onEdit={() => setRouteEditMode(true)}'), false);
  assert.equal(source.includes('onRestore={() => collectingRoute && loadRouteDraft(collectingRoute)}'), false);
  assert.equal(source.includes('collectingRuntimeRows'), false);
  assert.equal(source.includes('collectingEndpointRows'), false);
  assert.equal(source.includes('collectingCollectorRows'), false);
  assert.equal(source.includes('LockedConfigOverlay'), false);
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
  assert.equal(source.includes('选择当前集群可用的日志下游端点'), true);
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

test('Logs 接入配置不再维护日志下游端点', () => {
  assert.equal(source.includes('logsApi.createEndpoint'), false);
  assert.equal(source.includes('logsApi.updateEndpoint'), false);
  assert.equal(source.includes('endpointToForm(endpoint)'), false);
  assert.equal(source.includes('平台管理统一维护'), true);
});

test('Logs 接入配置刷新后可从已登记路由恢复草稿', () => {
  assert.equal(source.includes('selectedRouteId'), true);
  assert.equal(source.includes('routeParamAppliedRef'), true);
  assert.equal(source.includes('const [routeParams] = useSearchParams()'), true);
  assert.equal(source.includes("const onboardingRouteId = routeParams.get('route_id') ?? ''"), true);
  assert.equal(source.includes("const routeUpdateMode = routeParams.get('mode') === 'update'"), true);
  assert.equal(source.includes('suspendDraftResetRef'), true);
  assert.equal(source.includes('loadRouteDraft'), true);
  assert.equal(source.includes('parserFormFromRules'), true);
  assert.equal(source.includes("setCollectorConfigYaml(source.sourceType === 'vm_file' ? source.collectorYAML ?? '' : '')"), true);
  assert.equal(source.includes('setCreatedRoute(route)'), true);
  assert.equal(source.includes('logsApi.updateRoute(selectedRouteId'), true);
  assert.equal(source.includes('routeId: selectedRouteId'), true);
  assert.equal(source.includes('openRouteCollectorYaml(route)'), false);
  assert.equal(source.includes('routes[0].route.id'), false);
  assert.equal(pageAndServicePickerSource.includes('查看配置'), false);
  assert.equal(source.includes('载入配置'), false);
  assert.equal(source.includes('已载入'), false);
});

test('Logs 接入配置切换服务后不会复用已查看路由的 Collector YAML', () => {
  assert.equal(source.includes('routeMatchesCurrentDraft'), true);
  assert.equal(source.includes('selectedRouteMatchesDraft'), true);
  assert.equal(source.includes('shouldUseSavedCollectorYaml'), true);
  assert.equal(source.includes("sourceType === 'vm_file' && Boolean(collectorConfigYaml.trim() && selectedRouteMatchesDraft)"), true);
  assert.equal(source.includes("setSelectedRouteId('')"), true);
  assert.equal(source.includes("setCollectorConfigYaml('')"), true);
  assert.equal(source.includes('shouldUseSavedCollectorYaml ? collectorConfigYaml : routeCollectorPatchDraft'), true);
});

test('Logs 接入配置让已接入服务状态可读', () => {
  assert.equal(servicePickerSource.includes('function routeLifecycle'), true);
  assert.equal(source.includes('接入状态'), true);
  assert.equal(pageAndServicePickerSource.includes('已发布'), true);
  assert.equal(pageAndServicePickerSource.includes('待发布'), true);
  assert.equal(pageAndServicePickerSource.includes('待确认'), true);
  assert.equal(pageAndServicePickerSource.includes('未发布'), true);
  assert.equal(pageAndServicePickerSource.includes('配置已变更'), true);
  assert.equal(source.includes('function RouteStatusCell'), false);
  assert.equal(source.includes('function StatusPill'), false);
  assert.equal(agentsSource.includes('routeLifecycle(route)'), true);
  assert.equal(agentsSource.includes('statusPillClass(lifecycle.tone)'), true);
  assert.equal(pageAndServicePickerSource.includes('lastPublishMessage'), true);
  assert.equal(agentsSource.includes('lastAuditId'), true);
  assert.equal(agentsSource.includes('lastPreviewId'), true);
});

test('Logs 接入配置使用采集域只读配置弹层和解析自检', () => {
  assert.equal(source.includes('Collector 配置'), true);
  assert.equal(source.includes('采集域配置'), true);
  assert.equal(source.includes('当前运行配置'), true);
  assert.equal(source.includes('Patch 后配置'), true);
  assert.equal(source.includes('本次 Collector YAML'), true);
  assert.equal(source.includes('本服务采集配置'), true);
  assert.equal(source.includes('collector-config-compare-grid'), true);
  assert.equal(source.includes('currentCollectorDomainConfig'), true);
  assert.equal(source.includes('patchedCollectorDomainConfig'), true);
  assert.equal(source.includes('runningCollectorDomainConfig'), true);
  assert.equal(source.includes('routeCollectorPatchDraft'), true);
  assert.equal(source.includes('collectorYamlRoute'), false);
  assert.equal(source.includes('collectorYamlViewerOpen'), false);
  assert.equal(source.includes('openRouteCollectorYaml(route)'), false);
  assert.equal(source.includes('logsApi.getRouteCollectorConfig'), false);
  assert.equal(source.includes('collector-yaml-hash-viewer'), false);
  assert.equal(source.includes('完整 collector.yaml'), false);
  assert.equal(source.includes('非 K8s 部署清单'), false);
  assert.equal(source.includes('部署清单 hash'), false);
  assert.equal(source.includes('collectorConfigHash'), true);
  assert.equal(source.includes('configHash'), false);
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
  assert.equal(source.includes('kind: DaemonSet'), false);
  assert.equal(source.includes('日志样本'), true);
  assert.equal(source.includes('解析规则自检'), true);
  assert.equal(source.includes("sourceType === 'vm_file' ? <button"), true);
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

test('Logs 接入配置采集中查看态不展示右侧配置检查', () => {
  assert.equal(source.includes('showRequirements={!collectingConfigLocked}'), true);
  assert.equal(source.includes('showRequirements ? ('), true);
  assert.equal(source.includes('配置检查'), true);
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
  assert.equal(source.includes('Runtime 日志目录'), false);
  assert.equal(source.includes('/data/docker/containers'), false);
  assert.equal(source.includes('runtimeLogPathsText'), false);
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
  assert.equal(workspaceSource.includes('采集路由'), true);
  assert.equal(workspaceSource.includes('采集 Agent'), false);
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

test('Logs 采集路由只展示运行中路由并承接配置查看和变更', () => {
  assert.equal(agentsSource.includes('logs-routes-workbench'), true);
  assert.equal(agentsSource.includes('runningRoutes'), true);
  assert.equal(agentsSource.includes('(workspace?.routes ?? []).filter(isCollectingRoute)'), true);
  assert.equal(agentsSource.includes('运行中路由'), true);
  assert.equal(agentsSource.includes('采集配置'), true);
  assert.equal(agentsSource.includes('logsApi.getRouteCollectorConfig'), true);
  assert.equal(agentsSource.includes("import { createPortal } from 'react-dom';"), true);
  assert.equal(agentsSource.includes('createPortal(('), true);
  assert.equal(agentsSource.includes('document.body'), true);
  assert.equal(agentsSource.includes('route-collector-config-viewer'), true);
  assert.equal(agentsSource.includes('route-collector-config-viewer grid h-[86vh] max-h-[86vh]'), true);
  assert.equal(agentsSource.includes('grid-rows-[auto_minmax(0,1fr)]'), true);
  assert.equal(agentsSource.includes('grid min-h-0 overflow-hidden bg-surface-lowest p-4'), true);
  assert.equal(agentsSource.includes('min-h-0 overflow-auto rounded border border-outline bg-white p-4'), true);
  assert.equal(agentsSource.includes('route-collector-config-viewer flex max-h-[86vh]'), false);
  assert.equal(agentsSource.includes('shrink-0'), true);
  assert.equal(agentsSource.includes('完整 collector.yaml'), true);
  assert.equal(agentsSource.includes('非 K8s 部署清单'), true);
  assert.equal(agentsSource.includes('部署清单 hash'), true);
  assert.equal(agentsSource.includes('关闭'), true);
  assert.equal(agentsSource.includes('aria-label="关闭采集配置"'), true);
  assert.equal(agentsSource.includes('/logs/onboarding?mode=update&route_id='), true);
  assert.equal(agentsSource.includes('更新配置'), true);
  assert.equal(agentsSource.includes('实例状态'), true);
  assert.equal(agentsSource.includes('运行身份'), true);
  assert.equal(agentsSource.includes('K8s 范围'), true);
  assert.equal(agentsSource.includes('Pod / Node'), true);
  assert.equal(agentsSource.includes('runtimeIdentity'), true);
  assert.equal(agentsSource.includes('opampInstanceUid'), true);
  assert.equal(agentsSource.includes('clusterId'), true);
  assert.equal(agentsSource.includes('agentNamespace'), true);
  assert.equal(agentsSource.includes('podUid'), true);
  assert.equal(agentsSource.includes('podIp'), true);
  assert.equal(agentsSource.includes('collectorDomainScope(activeGroup'), true);
  assert.equal(agentsSource.includes('Remote Config'), true);
  assert.equal(agentsSource.includes('confirmDeleteGroupId'), false);
  assert.equal(agentsSource.includes('deleteCollectorGroup'), false);
  assert.equal(agentsSource.includes('删除采集域'), false);
  assert.equal(agentsSource.includes('采集域为空'), false);
  assert.equal(alertsSource.includes('logs-alerts-workbench'), true);
  assert.equal(alertsSource.includes('日志告警规则'), true);
  assert.equal(alertsSource.includes('规则上下文'), true);
});
