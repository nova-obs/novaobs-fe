import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const catalogSource = readFileSync(new URL('./ServicesPage.tsx', import.meta.url), 'utf8');
const routesSource = readFileSync(new URL('../../app/routes.tsx', import.meta.url), 'utf8');

test('产品工作台不展示任何授权入口', () => {
  assert.equal(catalogSource.includes('onOpenAccess'), false);
  assert.equal(catalogSource.includes('>授权</button>'), false);
  assert.equal(catalogSource.includes('>访问成员</button>'), false);
  assert.equal(catalogSource.includes('/access`'), false);
});

test('产品授权页面和路由已删除', () => {
  assert.equal(routesSource.includes("path: '/products/:productId/access'"), false);
  assert.equal(routesSource.includes('ProductAccessPage'), false);
});

test('产品维护能力与平台授权管理能力不混用', () => {
  assert.equal(catalogSource.includes('canMaintainProduct ? <button className="product-catalog-row-action" onClick={onCreateService}'), true);
  assert.equal(catalogSource.includes('canMaintainProduct ? <button className="product-catalog-row-action" onClick={onOpenAccess}'), false);
});
