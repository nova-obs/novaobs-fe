import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const onboarding = readFileSync(new URL('./LogsOnboardingPage.tsx', import.meta.url), 'utf8');
const vmFlow = readFileSync(new URL('./VMOnboardingFlow.tsx', import.meta.url), 'utf8');
const agents = readFileSync(new URL('./LogsAgentsPage.tsx', import.meta.url), 'utf8');
const workspace = readFileSync(new URL('./LogsWorkspace.tsx', import.meta.url), 'utf8');
const explore = readFileSync(new URL('./LogsExplorePage.tsx', import.meta.url), 'utf8');
const publishPreview = readFileSync(new URL('./LogsPublishPreviewPanel.tsx', import.meta.url), 'utf8');

test('Logs 路由创建固定服务上下文并强绑定 ServiceDeployment', () => {
  assert.match(onboarding, /getServiceDeployments/);
  assert.match(onboarding, /serviceDeploymentId: deploymentId/);
  assert.match(onboarding, /部署目标/);
  assert.match(onboarding, /日志路由绑定实际部署/);
  assert.doesNotMatch(onboarding, /setServiceId|ServicePickerPanel|同步服务/);
});

test('K8S 接入从 ServiceDeployment 读取 Workload 范围', () => {
  assert.match(onboarding, /deployment\.kind === 'kubernetes_workload'/);
  assert.match(onboarding, /selectedDeployment\?\.k8sRef\?\.clusterId/);
  assert.match(onboarding, /k8sRef\?\.workloadName/);
  assert.doesNotMatch(onboarding, /listK8sWorkloads|writableClusters|workloadKey/);
});

test('VM 编辑使用主机部署，Supervisor 安装身份在运行页管理', () => {
  assert.match(vmFlow, /deployment\.kind === 'host_set'/);
  assert.match(vmFlow, /allowedLogRoots/);
  assert.match(agents, /issueHostEnrollmentToken/);
  assert.match(agents, /签发安装令牌/);
  assert.doesNotMatch(vmFlow, /hostGroup|listVMAgentEndpoints|createVMAgentEndpoint|probeVMAgentEndpoint|13133/);
});

test('日志路径边界在前端就地反馈且后端仍是最终校验者', () => {
  assert.match(vmFlow, /validateHostLogPath/);
  assert.match(vmFlow, /日志路径必须是绝对路径/);
  assert.match(vmFlow, /日志路径不能包含 \.\./);
  assert.match(vmFlow, /允许的日志根目录内/);
  assert.match(vmFlow, /pathError/);
});

test('接入流程按配置、预览、保存、发布真实生命周期组织', () => {
  assert.match(onboarding, /生成预览/);
  assert.match(onboarding, /保存路由/);
  assert.match(onboarding, /确认发布/);
  assert.match(onboarding, /logsApi\.publishRoute/);
  assert.match(onboarding, /publishConfirmation/);
  assert.doesNotMatch(onboarding, /textarea[\s\S]*collectorConfig|collectorFragmentYAML/);
});

test('接入页使用主工作面加连续摘要，不平铺原始 Collector YAML', () => {
  assert.match(onboarding, /xl:grid-cols-\[minmax\(0,1fr\)_300px\]/);
  assert.match(onboarding, /发布摘要/);
  assert.match(onboarding, /配置 Hash/);
  assert.doesNotMatch(onboarding, /logs-route-config-editor|完整 collector\.yaml|采集域合并视图/);
});

test('运行页按 VM 与 K8S 的真实来源分型展示状态', () => {
  assert.match(agents, /getRouteRuntimeStatus/);
  assert.match(agents, /预期目标/);
  assert.match(agents, /已注册/);
  assert.match(agents, /进程健康/);
  assert.match(agents, /配置收敛/);
  assert.doesNotMatch(agents, /日志流入/);
  assert.doesNotMatch(agents, /最后日志/);
  assert.match(agents, /仅看异常/);
  assert.match(agents, /connectionStatus/);
  assert.match(agents, /processStatus/);
  assert.match(agents, /configStatus/);
  assert.doesNotMatch(agents, /dataStatus/);
  assert.match(agents, /DaemonSet/);
  assert.match(agents, /readyNodes/);
  assert.match(agents, /observedAt/);
  assert.match(agents, /签发安装令牌/);
  assert.match(agents, /retryRouteTarget/);
  assert.match(agents, /发布历史/);
  assert.match(agents, /回滚到此版本/);
  assert.match(agents, /deploymentName/);
  assert.match(agents, /getLogsCollectorRuntimeStatus/);
  assert.match(agents, /路由引用的服务部署不存在/);
  assert.match(agents, /返回服务详情修复部署/);
});

test('一次性令牌弹窗明确控制面入口与过期后的正确操作', () => {
  assert.match(agents, /Collector 控制面的内网地址/);
  assert.match(agents, /节点 IP.*30081/);
  assert.match(agents, /不能使用前端 30080/);
  assert.match(agents, /令牌过期但尚未注册/);
  assert.match(agents, /已注册后请轮换安装凭据/);
});

test('观测接入发布预览继续展示完整 K8S 资源部署 YAML', () => {
  assert.match(publishPreview, /完整资源部署 YAML/);
  assert.match(publishPreview, /preview\.manifestYAML/);
  assert.match(publishPreview, /navigator\.clipboard\?\.writeText\(preview\.manifestYAML/);
});

test('Logs 工作台继续传递可用高度且 Explore 固定服务查询上下文', () => {
  assert.match(workspace, /ModuleWorkbench/);
  assert.match(workspace, /module="logs"/);
  assert.match(agents, /logs-routes-workbench flex min-h-\[720px\] flex-col xl:h-full xl:min-h-0/);
  assert.match(explore, /ServiceContextSelector/);
  assert.match(explore, /buildGrafanaExploreURL/);
});

test('路由编辑页只保留配置预览保存发布，不平铺安装与发布历史', () => {
  assert.doesNotMatch(vmFlow, /主机覆盖与安装/);
  assert.doesNotMatch(vmFlow, /发布历史/);
  assert.doesNotMatch(vmFlow, /签发安装令牌/);
  assert.doesNotMatch(vmFlow, /回滚到此版本/);
});

test('移动端摘要压缩且目标状态使用移动卡片降级', () => {
  assert.match(agents, /grid-cols-2 sm:grid-cols-3 xl:grid-cols-5/);
  assert.match(agents, /runtime-target-mobile-card/);
  assert.match(agents, /hidden md:table/);
});
