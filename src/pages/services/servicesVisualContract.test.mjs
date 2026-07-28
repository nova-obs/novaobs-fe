import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./ServicesPage.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../styles/index.css', import.meta.url), 'utf8');

test('产品与服务在同一工作面展示产品及其服务', () => {
	assert.equal(source.includes('<div className="page-header">'), true);
	assert.equal(source.includes('<h1 className="page-title">产品与服务</h1>'), true);
  assert.equal(source.includes('productServiceQueries'), true);
  assert.equal(source.includes('ProductServiceRows'), true);
  assert.equal(source.includes('产品下暂无服务'), true);
  assert.equal(source.includes('统一租户'), true);
  assert.equal(source.includes('VictoriaLogs 租户'), false);
  assert.equal(source.includes('VL 租户'), false);
});

test('产品与服务列表状态使用轻量圆点文本而不是多层标签', () => {
  assert.equal(source.includes('appearance="inline"'), true);
  assert.equal(source.includes('<span className="w-7 text-[10px] text-muted">产品</span>'), false);
  assert.equal(source.includes('<span className="w-7 text-[10px] text-muted">集成</span>'), false);
});

test('产品分组支持折叠且列表提供查询过滤排序工具栏', () => {
  assert.equal(source.includes('collapsedProductIds'), true);
  assert.equal(source.includes('toggleProductCollapsed'), true);
  assert.equal(source.includes('查询产品或服务'), true);
  assert.equal(source.includes('筛选对象状态'), true);
  assert.equal(source.includes('筛选服务来源'), true);
  assert.equal(source.includes('列表排序'), true);
  assert.equal(source.includes('buildProductCatalogGroups'), true);
});

test('产品分组行与服务子行使用明确但克制的树形视觉层级', () => {
  assert.equal(source.includes('product-catalog-product-row'), true);
  assert.equal(source.includes('product-catalog-service-row'), true);
  assert.equal(source.includes('product-catalog-service-cell'), true);
  assert.equal(source.includes('product-catalog-mobile-header'), true);
  assert.equal(source.includes('totalServiceCount'), true);
  assert.equal(styles.includes('.product-catalog-product-row td'), true);
  assert.equal(styles.includes('.product-catalog-service-cell::before'), true);
  assert.equal(styles.includes('.product-catalog-service-cell::after'), true);
});

test('产品与服务行操作使用无常驻描边的轻量动作', () => {
  assert.equal(source.includes('product-catalog-row-action'), true);
  assert.equal(source.includes('product-catalog-row-action-danger'), true);
  assert.equal(styles.includes('.product-catalog-row-action {'), true);
  assert.equal(styles.includes('.product-catalog-row-action-danger {'), true);
});

test('服务详情使用部署目标作为运行位置生产真值并保留独立维护任务路由', () => {
  assert.equal(source.includes('<DetailSection title="观测关系"'), false);
  assert.equal(source.includes('部署目标'), true);
  assert.equal(source.includes('DeploymentLogSummary'), true);
  assert.equal(source.includes('ServiceDeployment'), true);
  assert.equal(source.includes('getServiceDeployments'), true);
  assert.equal(source.includes('/deployments/new'), true);
  assert.equal(source.includes('/deployments/${encodeURIComponent(deployment.id)}/edit'), true);
  assert.equal(source.includes('ProductIntegrationDrawer'), true);
  assert.equal(source.includes('ServiceDetailDrawer'), true);
  assert.equal(source.includes('integrationMode'), false);
  assert.equal(source.includes('ProductTab'), false);
  assert.equal(source.includes("type ServiceSection = 'overview' | 'graph' | 'settings'"), false);
  assert.equal(source.includes('archiveService'), true);
  assert.equal(source.includes('确认归档服务'), true);
  assert.equal(source.includes('syslog_device'), false);
  assert.equal(source.includes('environmentId: input.environmentId'), false);
});

test('服务详情先展示部署与日志状态再展示身份细节，并提供采集深链', () => {
  const deploymentsIndex = source.indexOf('<DetailSection title="部署与日志采集"');
  const identityIndex = source.indexOf('<DetailSection title="服务身份"');
  assert.ok(deploymentsIndex >= 0);
  assert.ok(identityIndex > deploymentsIndex);
  assert.match(source, /<table className="console-table w-full min-w-\[700px\]">/);
  assert.doesNotMatch(source, /<table className="console-table w-full min-w-\[760px\]">/);
  assert.match(source, /配置采集/);
  assert.match(source, /查看采集/);
  assert.match(source, /buildLogsRuntimeURL/);
});

test('新增服务提供手动创建与 Kubernetes Deployment 导入两种入口', () => {
  assert.equal(source.includes('手动创建'), true);
  assert.equal(source.includes('从 Kubernetes 导入'), true);
  assert.equal(source.includes('选择集群'), true);
  assert.equal(source.includes('选择 Namespace'), true);
  assert.equal(source.includes('选择 Deployment'), true);
  assert.equal(source.includes('k8sApi.listResources'), true);
  assert.equal(source.includes("kind: 'Deployment'"), true);
});
