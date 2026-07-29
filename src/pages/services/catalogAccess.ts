import type { PlatformAccessContext } from '../platform/accessApi';

export interface ProductCatalogCapabilities {
  canCreateProduct: boolean;
  canArchiveProduct: boolean;
  canViewProduct: boolean;
  canMaintainProduct: boolean;
}

export function productCatalogCapabilities(
  context: PlatformAccessContext | null,
  productId: string,
): ProductCatalogCapabilities {
  const access = context?.productAccesses.find((item) => item.productId === productId);
  return {
    canCreateProduct: Boolean(context?.platformAdmin),
    canArchiveProduct: Boolean(context?.platformAdmin),
    canViewProduct: Boolean(access),
    canMaintainProduct: access?.role === 'product-maintainer',
  };
}
