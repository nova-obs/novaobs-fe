import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getNavigationByPath,
  getNavigationDomainByPath,
  getNavigationDomains,
} from './navigation.ts';

test('超级菜单按业务域组织现有叶子入口且路径唯一', () => {
  const domains = getNavigationDomains();
  const items = domains.flatMap((domain) => domain.groups.flatMap((group) => flattenLeafItems(group.items)));

  assert.deepEqual(domains.map((domain) => domain.label), [
    '工作台',
    '可观测性',
    'K8s 运维',
    '平台管理',
  ]);
  assert.deepEqual(items.map((item) => item.path), [
    '/',
    '/products',
	'/logs/explore',
	'/logs/agents',
	'/logs/alerts',
	'/metrics/overview',
	'/metrics/dashboard',
	'/metrics/alerts',
	'/metrics/integrations',
    '/traces',
    '/k8s',
	'/platform/settings',
    '/platform/identities',
    '/platform/admins',
    '/platform/product-access',
    '/platform/k8s-access-profiles',
    '/platform/break-glass',
    '/platform/k8s-clusters',
    '/platform/observability/endpoints/logs',
    '/platform/observability/endpoints/metrics',
  ]);
  assert.equal(new Set(items.map((item) => item.path)).size, items.length);
});

test('平台管理顶部下拉使用面向任务的统一名称与描述', () => {
  const platform = getNavigationDomains().find((domain) => domain.id === 'platform');
  const items = platform?.groups.flatMap((group) => group.items) ?? [];
  const access = items.find((item) => item.id === 'platform-access');
  const endpoints = items.find((item) => item.id === 'platform-observability-endpoints');

  assert.deepEqual(items.map((item) => [item.label, item.description]), [
    ['平台设置', '镜像模板与 Grafana 入口'],
    ['身份与授权', '用户、用户组与授权'],
    ['K8s 集群接入', '集群登记与控制面凭据'],
    ['观测数据端点', '日志与指标端点'],
  ]);
  assert.equal(access?.path, '/platform/access');
  assert.deepEqual(access?.children?.map((item) => [item.label, item.description]), [
    ['用户与用户组', '管理登录用户、用户组及成员关系'],
    ['平台管理员授权', '授予或撤销平台控制面管理权限'],
    ['产品访问授权', '按用户组授予产品查看或维护权限'],
    ['K8s 集群授权', '按集群、权限级别和命名空间授权用户组'],
    ['K8s 紧急访问', '审批临时集群高权限并查看审计记录'],
  ]);
  assert.deepEqual(access?.children?.map((item) => item.path), [
    '/platform/identities',
    '/platform/admins',
    '/platform/product-access',
    '/platform/k8s-access-profiles',
    '/platform/break-glass',
  ]);
  assert.deepEqual(endpoints?.children?.map((item) => [item.label, item.description]), [
    ['日志数据端点', '配置日志写入与查询端点'],
    ['指标数据端点', '配置指标写入与查询端点'],
  ]);
});

test('可观测性导航只包含产品观测能力，共享端点归平台控制面', () => {
  const observability = getNavigationDomains().find((domain) => domain.id === 'observability');
  const primaryItems = observability?.groups.flatMap((group) => group.items) ?? [];
  const logs = primaryItems.find((item) => item.id === 'logs');
  const metrics = primaryItems.find((item) => item.id === 'metrics');

  assert.deepEqual(primaryItems.map((item) => item.label), ['Logs', '监控', 'Trace']);
  assert.equal(logs?.path, '/logs');
	assert.deepEqual(logs?.children?.map((item) => item.label), ['日志分析', '日志采集', '日志告警']);
	assert.deepEqual(logs?.children?.map((item) => item.path), ['/logs/explore', '/logs/agents', '/logs/alerts']);
  assert.equal(metrics?.path, '/metrics');
	assert.deepEqual(metrics?.children?.map((item) => item.label), ['监控总览', 'Dashboard', '指标告警', '指标接入']);
	assert.deepEqual(metrics?.children?.map((item) => item.path), ['/metrics/overview', '/metrics/dashboard', '/metrics/alerts', '/metrics/integrations']);
  assert.equal(primaryItems.some((item) => item.id === 'alerts'), false);
});

test('K8s 运维导航按默认父模块卡片承载集群入口', () => {
  const k8s = getNavigationDomains().find((domain) => domain.id === 'k8s');
  const primaryItems = k8s?.groups.flatMap((group) => group.items) ?? [];
  const cluster = primaryItems.find((item) => item.id === 'k8s-cluster');

  assert.deepEqual(primaryItems.map((item) => item.label), ['集群']);
  assert.equal(cluster?.path, '/k8s');
  assert.deepEqual(cluster?.children?.map((item) => item.label), ['集群总览']);
  assert.deepEqual(cluster?.children?.map((item) => item.path), ['/k8s']);
});

test('根据路径解析当前导航项', () => {
  assert.equal(getNavigationByPath('/products')?.id, 'products');
  assert.equal(getNavigationByPath('/products/product-1/services')?.id, 'products');
  assert.equal(getNavigationByPath('/logs')?.id, 'logs');
	assert.equal(getNavigationByPath('/logs/explore')?.id, 'logs-explore');
	assert.equal(getNavigationByPath('/logs/format-demo')?.id, 'logs');
	assert.equal(getNavigationByPath('/logs/agents')?.id, 'logs-agents');
	assert.equal(getNavigationByPath('/logs/alerts')?.id, 'logs-alerts');
	assert.equal(getNavigationByPath('/logs/endpoints'), undefined);
	assert.equal(getNavigationByPath('/products/product-1/services/svc-1/logs/agents/new')?.id, 'logs-agents');
	assert.equal(getNavigationByPath('/products/product-1/services/svc-1/logs/format-demo')?.id, 'logs');
	assert.equal(getNavigationByPath('/products/product-1/services/svc-1/logs/alerts/new')?.id, 'logs-alerts');
	assert.equal(getNavigationByPath('/products/product-1/services/svc-1/logs/endpoints'), undefined);
	assert.equal(getNavigationByPath('/observability/endpoints'), undefined);
	assert.equal(getNavigationByPath('/observability/endpoints/logs'), undefined);
	assert.equal(getNavigationByPath('/observability/endpoints/metrics'), undefined);
  assert.equal(getNavigationByPath('/metrics')?.id, 'metrics');
	assert.equal(getNavigationByPath('/metrics/overview')?.id, 'metrics-overview');
	assert.equal(getNavigationByPath('/metrics/dashboard')?.id, 'metrics-dashboard');
	assert.equal(getNavigationByPath('/metrics/monitoring'), undefined);
	assert.equal(getNavigationByPath('/metrics/alerts')?.id, 'metrics-alerts');
	assert.equal(getNavigationByPath('/metrics/alerts/new')?.id, 'metrics-alerts');
	assert.equal(getNavigationByPath('/metrics/integrations')?.id, 'metrics-integrations');
	assert.equal(getNavigationByPath('/metrics/explore')?.id, 'metrics');
  assert.equal(getNavigationByPath('/monitoring'), undefined);
  assert.equal(getNavigationByPath('/traces')?.id, 'traces');
  assert.equal(getNavigationByPath('/platform/settings')?.id, 'platform-settings');
  assert.equal(getNavigationByPath('/platform/access')?.id, 'platform-access');
  assert.equal(getNavigationByPath('/platform/identities')?.id, 'platform-identities');
  assert.equal(getNavigationByPath('/platform/admins')?.id, 'platform-admins');
  assert.equal(getNavigationByPath('/platform/product-access')?.id, 'platform-product-access');
  assert.equal(getNavigationByPath('/platform/k8s-access-profiles')?.id, 'platform-k8s-access-profiles');
  assert.equal(getNavigationByPath('/platform/break-glass')?.id, 'platform-break-glass');
  assert.equal(getNavigationByPath('/platform/k8s-clusters')?.id, 'platform-k8s-clusters');
  assert.equal(getNavigationByPath('/platform/observability/endpoints/logs')?.id, 'platform-observability-logs-endpoints');
  assert.equal(getNavigationByPath('/k8s')?.id, 'k8s-fleet');
  assert.equal(getNavigationByPath('/k8s/access'), undefined);
  assert.equal(getNavigationByPath('/k8s/observability'), undefined);
  assert.equal(getNavigationByPath('/k8s/clusters/prod/namespaces')?.id, 'k8s-fleet');
  assert.equal(getNavigationByPath('/unknown'), undefined);
});

test('根据任意子页面解析当前业务域', () => {
  assert.equal(getNavigationDomainByPath('/services')?.id, 'workspace');
  assert.equal(getNavigationDomainByPath('/products/product-1/services')?.id, 'workspace');
	assert.equal(getNavigationDomainByPath('/products/product-1/services/svc-1/logs/agents/new')?.id, 'observability');
  assert.equal(getNavigationDomainByPath('/agents/agent-1')?.id, 'observability');
  assert.equal(getNavigationDomainByPath('/observability/endpoints')?.id, 'observability');
	assert.equal(getNavigationDomainByPath('/metrics/integrations')?.id, 'observability');
  assert.equal(getNavigationDomainByPath('/monitoring'), undefined);
  assert.equal(getNavigationDomainByPath('/traces')?.id, 'observability');
  assert.equal(getNavigationDomainByPath('/alerts')?.id, 'observability');
  assert.equal(getNavigationDomainByPath('/k8s/clusters/prod/namespaces')?.id, 'k8s');
  assert.equal(getNavigationDomainByPath('/platform/settings')?.id, 'platform');
  assert.equal(getNavigationDomainByPath('/platform/observability')?.id, 'platform');
  assert.equal(getNavigationDomainByPath('/unknown'), undefined);
});

function flattenLeafItems(items) {
  return items.flatMap((item) => item.children?.length ? flattenLeafItems(item.children) : [item]);
}

test('超级菜单默认展示可发现业务域，并按访问上下文隐藏数据与管理员入口', () => {
  const developer = {
    subject: { id: 'user-1', type: 'user', displayName: '开发用户' },
    groups: [],
    platformAdmin: false,
    productAccesses: [{ productId: 'product-1', productName: '订单', role: 'product-viewer' }],
    k8sProfiles: [],
    k8sBreakGlass: [],
    availableModules: ['workspace', 'observability', 'k8s'],
    modules: { workspace: 'read', products: 'read', logs: 'read', metrics: 'read', traces: 'read', k8s: 'hidden', platform: 'hidden' },
  };
  const unassigned = {
    ...developer,
    productAccesses: [],
    availableModules: ['workspace', 'observability', 'k8s'],
    modules: { workspace: 'read' },
  };
  const platformAdmin = {
    ...unassigned,
    platformAdmin: true,
    modules: { workspace: 'read', platform: 'manage' },
  };

  const developerDomains = getNavigationDomains(developer);
  const unassignedDomains = getNavigationDomains(unassigned);
  const adminDomains = getNavigationDomains(platformAdmin);
  const developerItems = developerDomains.flatMap((domain) => domain.groups.flatMap((group) => flattenLeafItems(group.items)));
  const unassignedItems = unassignedDomains.flatMap((domain) => domain.groups.flatMap((group) => flattenLeafItems(group.items)));
  const adminItems = adminDomains.flatMap((domain) => domain.groups.flatMap((group) => flattenLeafItems(group.items)));

  assert.deepEqual(developerDomains.map((domain) => domain.id), ['workspace', 'observability', 'k8s']);
  assert.equal(developerItems.some((item) => item.path === '/observability/endpoints/logs'), false);
  assert.deepEqual(unassignedDomains.map((domain) => domain.id), ['workspace', 'observability', 'k8s']);
  assert.equal(unassignedItems.some((item) => item.path === '/products'), false);
  assert.equal(unassignedItems.some((item) => item.path === '/logs/explore'), true);
  assert.equal(unassignedItems.some((item) => item.path === '/metrics/overview'), true);
  assert.equal(unassignedItems.some((item) => item.path === '/traces'), true);
  assert.equal(unassignedItems.some((item) => item.path.startsWith('/platform/')), false);
  assert.deepEqual(adminDomains.map((domain) => domain.id), ['workspace', 'observability', 'k8s', 'platform']);
  assert.equal(adminItems.some((item) => item.path === '/products'), true);
  assert.equal(adminItems.some((item) => item.path === '/logs/explore'), true);
  assert.equal(adminItems.some((item) => item.path === '/platform/observability/endpoints/logs'), true);
  assert.equal(adminItems.some((item) => item.path === '/platform/k8s-clusters'), true);
  assert.equal(adminItems.some((item) => item.path === '/platform/identities'), true);
  assert.equal(adminItems.some((item) => item.path === '/platform/admins'), true);
  assert.equal(adminItems.some((item) => item.path === '/platform/product-access'), true);
  assert.equal(adminItems.some((item) => item.path === '/platform/k8s-access-profiles'), true);
  assert.equal(adminItems.some((item) => item.path === '/platform/break-glass'), true);
});
