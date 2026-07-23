import { createContext, useContext } from 'react';
import type { Product, Service } from '../../services/types';

export interface ServiceScopeContextValue {
  products: Product[];
  services: Service[];
  activeProduct: Product | null;
  activeService: Service | null;
  loading: boolean;
  error: unknown;
  retry: () => void;
  selectProduct: (productId: string) => void;
  selectService: (serviceId: string) => void;
}

export const ServiceScopeContext = createContext<ServiceScopeContextValue | null>(null);

export function useServiceScope(): ServiceScopeContextValue {
  const value = useContext(ServiceScopeContext);
  if (!value) throw new Error('ServiceContextSelector 必须在服务模块工作台内使用');
  return value;
}
