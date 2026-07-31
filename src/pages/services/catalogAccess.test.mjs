import test from 'node:test';
import assert from 'node:assert/strict';
import { productCatalogCapabilities } from './catalogAccess.ts';

function context(overrides = {}) {
  return {
    subject: { id: 'user-1', type: 'user', displayName: 'User' },
    groups: [],
    platformAdmin: false,
    productAccesses: [],
    k8sProfiles: [],
    modules: {},
    ...overrides,
  };
}

test('Product Viewer 只能查看产品、服务和集成', () => {
  const capabilities = productCatalogCapabilities(context({
    productAccesses: [{ productId: 'product-commerce', productName: '交易平台', role: 'product-viewer' }],
  }), 'product-commerce');

  assert.deepEqual(capabilities, {
    canCreateProduct: false,
    canArchiveProduct: false,
    canViewProduct: true,
    canMaintainProduct: false,
  });
});

test('Product Maintainer 可以维护服务和集成但不能管理 Product 生命周期', () => {
  const capabilities = productCatalogCapabilities(context({
    productAccesses: [{ productId: 'product-commerce', productName: '交易平台', role: 'product-maintainer' }],
  }), 'product-commerce');

  assert.deepEqual(capabilities, {
    canCreateProduct: false,
    canArchiveProduct: false,
    canViewProduct: true,
    canMaintainProduct: true,
  });
});

test('Platform Administrator 只管理 Product 生命周期且不隐式获得业务维护权限', () => {
  const capabilities = productCatalogCapabilities(context({ platformAdmin: true }), 'product-commerce');

  assert.deepEqual(capabilities, {
    canCreateProduct: true,
    canArchiveProduct: true,
    canViewProduct: false,
    canMaintainProduct: false,
  });
});
