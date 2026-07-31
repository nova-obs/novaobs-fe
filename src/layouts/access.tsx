import { createContext, useContext, type PropsWithChildren, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import {
  accessApi,
  type K8sAccessLevel,
  type ModuleAccessLevel,
  type PlatformAccessContext,
  type PlatformModule,
  type ProductAccessRole,
} from '../pages/platform/accessApi';

export type AccessRequirement =
  | { kind: 'platform-admin' }
  | { kind: 'module'; module: PlatformModule; minimum?: Exclude<ModuleAccessLevel, 'hidden'> }
  | { kind: 'product'; productId?: string; minimum: ProductAccessRole }
  | { kind: 'k8s'; clusterId?: string; minimum: K8sAccessLevel }
  | { kind: 'k8s-module' };

interface PlatformAccessContextValue {
  data: PlatformAccessContext | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
}

const AccessContext = createContext<PlatformAccessContextValue | null>(null);

export const platformAccessQueryKey = (subjectId: string) => ['platform-me', subjectId] as const;

export function PlatformAccessContextProvider({
  children,
  subjectId,
}: PropsWithChildren<{ subjectId: string }>) {
  const query = useQuery({
    queryKey: platformAccessQueryKey(subjectId),
    queryFn: () => accessApi.me(),
    enabled: Boolean(subjectId),
    retry: false,
    staleTime: 30_000,
  });
  return (
    <AccessContext.Provider
      value={{
        data: query.data ?? null,
        isLoading: query.isLoading,
        error: query.error instanceof Error ? query.error : query.error ? new Error('访问上下文读取失败') : null,
        refetch: query.refetch,
      }}
    >
      {children}
    </AccessContext.Provider>
  );
}

export function usePlatformAccess() {
  const context = useContext(AccessContext);
  if (!context) {
    throw new Error('usePlatformAccess 必须在 PlatformAccessContextProvider 中使用');
  }
  return context;
}

export function k8sAccessLevelForCluster(context: PlatformAccessContext, clusterId: string): K8sAccessLevel | null {
  const breakGlass = (context.k8sBreakGlass ?? []).some((grant) => (
    grant.clusterId === clusterId && new Date(grant.expiresAt).getTime() > Date.now()
  ));
  if (breakGlass) return 'namespace-maintainer';
  const profiles = context.k8sProfiles.filter((profile) => profile.clusterId === clusterId && profile.status === 'active');
  if (profiles.some((profile) => profile.accessLevel === 'namespace-maintainer')) return 'namespace-maintainer';
  if (profiles.some((profile) => profile.accessLevel === 'developer')) return 'developer';
  return null;
}

export function hasBreakGlassAccess(context: PlatformAccessContext, clusterId: string): boolean {
  return (context.k8sBreakGlass ?? []).some((grant) => (
    grant.clusterId === clusterId && new Date(grant.expiresAt).getTime() > Date.now()
  ));
}

export function k8sNamespacesForLevel(
  context: PlatformAccessContext,
  clusterId: string,
  minimum: K8sAccessLevel,
): string[] {
  const namespaces = context.k8sProfiles
    .filter((profile) => (
      profile.clusterId === clusterId
      && profile.status === 'active'
      && k8sRank(profile.accessLevel) >= k8sRank(minimum)
    ))
    .flatMap((profile) => profile.namespaces);
  return [...new Set(namespaces)].sort();
}

export function accessAllows(context: PlatformAccessContext, requirement: AccessRequirement): boolean {
  switch (requirement.kind) {
    case 'platform-admin':
      return context.platformAdmin;
    case 'module':
      return moduleRank(context.modules[requirement.module] ?? 'hidden') >= moduleRank(requirement.minimum ?? 'read');
    case 'product': {
      const access = context.productAccesses.find((item) => item.productId === requirement.productId);
      return Boolean(access && productRank(access.role) >= productRank(requirement.minimum));
    }
    case 'k8s': {
      if (!requirement.clusterId) return false;
      const level = k8sAccessLevelForCluster(context, requirement.clusterId);
      return Boolean(level && k8sRank(level) >= k8sRank(requirement.minimum));
    }
    case 'k8s-module':
      return (context.availableModules ?? []).includes('k8s')
        || context.k8sProfiles.some((profile) => profile.status === 'active')
        || (context.k8sBreakGlass ?? []).some((grant) => new Date(grant.expiresAt).getTime() > Date.now());
  }
}

export function AccessGate({
  children,
  requirement,
}: {
  children: ReactNode;
  requirement: AccessRequirement;
}) {
  const { clusterId = '', productId = '' } = useParams();
  const access = usePlatformAccess();
  const resolvedRequirement = resolveRouteRequirement(requirement, clusterId, productId);

  if (access.isLoading) {
    return (
      <div className="console-panel p-5" aria-live="polite">
        <div className="console-skeleton h-5 w-40" />
        <div className="console-skeleton mt-3 h-4 w-72 max-w-full" />
      </div>
    );
  }
  if (access.error || !access.data) {
    return (
      <AccessDenied
        title="无法校验访问范围"
        message={access.error?.message || '平台没有返回当前主体的访问上下文。'}
      />
    );
  }
  if (!accessAllows(access.data, resolvedRequirement)) {
    return (
      <AccessDenied
        title="当前主体无权访问"
        message={`主体 ${access.data.subject.displayName || access.data.subject.id} 缺少${requirementLabel(resolvedRequirement)}。`}
      />
    );
  }
  return children;
}

function resolveRouteRequirement(
  requirement: AccessRequirement,
  clusterId: string,
  productId: string,
): AccessRequirement {
  if (requirement.kind === 'k8s' && !requirement.clusterId) return { ...requirement, clusterId };
  if (requirement.kind === 'product' && !requirement.productId) return { ...requirement, productId };
  return requirement;
}

function AccessDenied({ title, message }: { title: string; message: string }) {
  return (
    <section className="console-panel mx-auto max-w-2xl p-6" role="alert">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-50 text-warning">
          <ShieldAlert className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-on-surface">{title}</h1>
          <p className="mt-1 text-sm leading-6 text-muted">{message}</p>
          <Link className="console-button mt-4 inline-flex" to="/">返回平台总览</Link>
        </div>
      </div>
    </section>
  );
}

function requirementLabel(requirement: AccessRequirement) {
  if (requirement.kind === 'platform-admin') return '平台管理员权限';
  if (requirement.kind === 'module') return `${requirement.module} 模块 ${requirement.minimum ?? 'read'} 权限`;
  if (requirement.kind === 'product') return `产品 ${requirement.productId || '-'} 的 ${requirement.minimum} 权限`;
  if (requirement.kind === 'k8s') return `集群 ${requirement.clusterId || '-'} 的 ${requirement.minimum} 权限`;
  return 'K8s 模块访问权限';
}

function moduleRank(level: ModuleAccessLevel) {
  return level === 'manage' ? 2 : level === 'read' ? 1 : 0;
}

function productRank(role: ProductAccessRole) {
  return role === 'product-maintainer' ? 2 : 1;
}

function k8sRank(level: K8sAccessLevel) {
  return level === 'namespace-maintainer' ? 2 : 1;
}
