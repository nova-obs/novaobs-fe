import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildServiceModulePath,
  resolveRestorableService,
  serviceModuleEntryFromPath,
  serviceScopePreferenceKey,
} from './serviceScope.ts';

const workbenchSource = readFileSync(new URL('./ServiceScopedModuleWorkbench.tsx', import.meta.url), 'utf8');
const selectorSource = readFileSync(new URL('./ServiceContextSelector.tsx', import.meta.url), 'utf8');
const logsExploreSource = readFileSync(new URL('../../pages/logs/LogsExplorePage.tsx', import.meta.url), 'utf8');

test('日志服务作用域路径保留产品、服务和当前入口', () => {
  assert.equal(
    buildServiceModulePath('logs', 'product/a', 'service b', 'agents'),
    '/products/product%2Fa/services/service%20b/logs/agents',
  );
});

test('平台级端点不进入服务嵌套路径', () => {
  assert.equal(buildServiceModulePath('logs', 'product-1', 'service-1', 'endpoints'), '/logs/endpoints');
});

test('从入口和嵌套 URL 中解析当前模块功能', () => {
  assert.equal(serviceModuleEntryFromPath('/logs/alerts', 'logs'), 'alerts');
  assert.equal(serviceModuleEntryFromPath('/products/p/services/s/logs', 'logs'), 'explore');
});

test('Logs 保存最近服务偏好并使用产品、服务两级上下文', () => {
  assert.equal(serviceScopePreferenceKey('logs'), 'novaapm.service-scope.logs');
  assert.match(workbenchSource, /api\.getProducts/);
  assert.match(workbenchSource, /api\.getServices/);
  assert.match(selectorSource, /aria-label="选择产品"/);
  assert.match(selectorSource, /aria-label="选择产品内服务"/);
  assert.doesNotMatch(workbenchSource, /<select/);
  assert.doesNotMatch(workbenchSource, /toolbar=/);
  assert.match(selectorSource, /<select/);
  assert.doesNotMatch(selectorSource, /<optgroup/);
  assert.doesNotMatch(selectorSource, /<table/);
  assert.doesNotMatch(selectorSource, />服务作用域</);
  assert.match(selectorSource, /选择产品/);
  assert.doesNotMatch(selectorSource, /product_id/);
});

test('服务上下文显式区分产品和产品内服务', () => {
  assert.match(selectorSource, /activeProduct/);
  assert.match(selectorSource, /productServices/);
  assert.match(selectorSource, /selectProduct/);
  assert.match(selectorSource, /selectService/);
  assert.doesNotMatch(selectorSource, /absolute inset-0/);
  assert.doesNotMatch(selectorSource, /opacity-0/);
  assert.doesNotMatch(selectorSource, /triggerMeta=\{activeService\?\.id/);
  assert.doesNotMatch(selectorSource, /· \{service\.id\}/);
  assert.match(logsExploreSource, /查询上下文/);
  assert.match(logsExploreSource, /<ServiceContextSelector/);
  assert.doesNotMatch(workbenchSource, /ServiceScopeToolbar/);
});

test('最近服务必须仍存在于当前有权限的服务列表中', () => {
  const services = [
    { id: 'service-1', productId: 'product-1' },
    { id: 'service-2', productId: 'product-2' },
  ];
  assert.equal(resolveRestorableService(services, 'service-2')?.id, 'service-2');
  assert.equal(resolveRestorableService(services, 'missing'), null);
  assert.equal(resolveRestorableService([services[0]], 'missing')?.id, 'service-1');
});
