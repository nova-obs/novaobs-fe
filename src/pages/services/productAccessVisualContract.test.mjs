import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./ProductAccessPage.tsx', import.meta.url), 'utf8');
const catalogSource = readFileSync(new URL('./ServicesPage.tsx', import.meta.url), 'utf8');

test('Product Maintainer 可从产品工作台管理产品级授权', () => {
  assert.equal(source.includes('产品授权'), true);
  assert.equal(source.includes('Product Viewer'), true);
  assert.equal(source.includes('Product Maintainer'), true);
  assert.equal(source.includes('用户组与服务账号'), true);
  assert.equal(source.includes('listProductGrantSubjects'), true);
  assert.equal(catalogSource.includes('onOpenAccess'), true);
});

test('产品授权页不提供用户、角色或权限字符串管理入口', () => {
  assert.equal(source.includes('创建用户'), false);
  assert.equal(source.includes('创建角色'), false);
  assert.equal(source.includes('权限字符串'), false);
  assert.equal(source.includes('Service 级授权'), false);
});
