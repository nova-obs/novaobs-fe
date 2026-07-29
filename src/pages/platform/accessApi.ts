import { apiRequest } from '../../services/api';

export type PlatformModule =
  | 'workspace'
  | 'products'
  | 'observability'
  | 'logs'
  | 'metrics'
  | 'traces'
  | 'alerts'
  | 'k8s'
  | 'platform';

export type ModuleAccessLevel = 'hidden' | 'read' | 'manage';
export type ProductAccessRole = 'product-viewer' | 'product-maintainer';
export type K8sAccessLevel = 'developer' | 'namespace-maintainer';

export interface PlatformSubjectRef {
  id: string;
  type: string;
  displayName: string;
}

export interface PlatformGroupRef {
  id: string;
  name: string;
  displayName: string;
}

export interface ProductAccessSummary {
  productId: string;
  productName: string;
  role: ProductAccessRole;
}

export interface K8sAccessProfileSummary {
  id: string;
  name: string;
  clusterId: string;
  accessLevel: K8sAccessLevel;
  namespaces: string[];
  impersonationGroup: string;
  status: string;
  driftState: string;
}

export interface K8sBreakGlassAccessSummary {
  grantId: string;
  clusterId: string;
  expiresAt: string;
  accessLevel: K8sAccessLevel;
}

export interface PlatformAccessContext {
  subject: PlatformSubjectRef;
  groups: PlatformGroupRef[];
  platformAdmin: boolean;
  productAccesses: ProductAccessSummary[];
  k8sProfiles: K8sAccessProfileSummary[];
  k8sBreakGlass: K8sBreakGlassAccessSummary[];
  modules: Partial<Record<PlatformModule, ModuleAccessLevel>>;
}

export interface PlatformAdminGrant {
  id: string;
  subjectType: 'user' | 'group';
  subjectId: string;
  createdBy: string;
  createdAt: string;
}

export interface ProductAccessGrant {
  id: string;
  productId: string;
  subjectType: 'group' | 'service-account';
  subjectId: string;
  role: ProductAccessRole;
  createdBy: string;
  createdAt: string;
}

export interface ProductGrantSubject {
  subjectType: 'group' | 'service-account';
  subjectId: string;
  displayName: string;
}

export interface K8sAccessProfile extends K8sAccessProfileSummary {
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface K8sAccessProfileInput {
  name: string;
  clusterId: string;
  accessLevel: K8sAccessLevel;
  namespaces: string[];
  wholeNamespaceConfirmed: boolean;
}

export interface K8sNamespaceImpact {
  clusterId: string;
  namespace: string;
  productId: string;
  productName: string;
  serviceId: string;
  serviceName: string;
  deploymentId: string;
  deploymentName: string;
  workloadKind: string;
  workloadName: string;
}

export interface K8sAccessGrant {
  id: string;
  groupId: string;
  profileId: string;
  createdBy: string;
  createdAt: string;
}

export interface K8sBreakGlassGrant {
  id: string;
  clusterId: string;
  requesterUserId: string;
  approvedByUserId: string;
  reason: string;
  impersonationGroup: string;
  requestedAt: string;
  approvedAt: string;
  expiresAt: string;
  revokedAt: string;
  revokedByUserId: string;
  status: string;
}

export interface AccessWriteResult<T> {
  item?: T;
  status: string;
  auditId: string;
}

function mapSubject(raw: any): PlatformSubjectRef {
  return {
    id: String(raw?.id ?? ''),
    type: String(raw?.type ?? raw?.subject_type ?? raw?.subjectType ?? ''),
    displayName: raw?.display_name ?? raw?.displayName ?? '',
  };
}

function mapGroup(raw: any): PlatformGroupRef {
  return {
    id: String(raw?.id ?? ''),
    name: raw?.name ?? '',
    displayName: raw?.display_name ?? raw?.displayName ?? '',
  };
}

function mapProductAccess(raw: any): ProductAccessSummary {
  return {
    productId: String(raw?.product_id ?? raw?.productId ?? ''),
    productName: raw?.product_name ?? raw?.productName ?? '',
    role: raw?.role === 'product-maintainer' ? 'product-maintainer' : 'product-viewer',
  };
}

function mapK8sAccessProfileSummary(raw: any): K8sAccessProfileSummary {
  return {
    id: String(raw?.profile_id ?? raw?.profileId ?? raw?.id ?? ''),
    name: raw?.name ?? '',
    clusterId: String(raw?.cluster_id ?? raw?.clusterId ?? ''),
    accessLevel: raw?.access_level === 'namespace-maintainer' || raw?.accessLevel === 'namespace-maintainer'
      ? 'namespace-maintainer'
      : 'developer',
    namespaces: Array.isArray(raw?.namespaces) ? raw.namespaces.map(String).filter(Boolean) : [],
    impersonationGroup: raw?.impersonation_group ?? raw?.impersonationGroup ?? '',
    // /platform/me 只返回已经生效的 Profile 摘要，因此摘要缺少 status 时按 active 处理。
    status: raw?.status ?? 'active',
    driftState: raw?.drift_state ?? raw?.driftState ?? 'unknown',
  };
}

function mapK8sBreakGlassAccess(raw: any): K8sBreakGlassAccessSummary {
  return {
    grantId: String(raw?.grant_id ?? raw?.grantId ?? ''),
    clusterId: String(raw?.cluster_id ?? raw?.clusterId ?? ''),
    expiresAt: raw?.expires_at ?? raw?.expiresAt ?? '',
    accessLevel: raw?.access_level === 'namespace-maintainer' || raw?.accessLevel === 'namespace-maintainer'
      ? 'namespace-maintainer'
      : 'developer',
  };
}

function mapAccessContext(raw: any): PlatformAccessContext {
  const rawModules = raw?.modules && typeof raw.modules === 'object' ? raw.modules : {};
  const modules: Partial<Record<PlatformModule, ModuleAccessLevel>> = {};
  const moduleNames: PlatformModule[] = [
    'workspace',
    'products',
    'observability',
    'logs',
    'metrics',
    'traces',
    'alerts',
    'k8s',
    'platform',
  ];
  moduleNames.forEach((moduleName) => {
    const level = mapModuleAccess(rawModules[moduleName]);
    if (level) modules[moduleName] = level;
  });
  const observability = modules.observability;
  if (observability) {
    modules.logs ??= observability;
    modules.metrics ??= observability;
    modules.traces ??= observability;
    modules.alerts ??= observability;
  }
  const rawGroups = Array.isArray(raw?.groups)
    ? raw.groups.map(mapGroup)
    : Array.isArray(raw?.group_ids ?? raw?.groupIds)
      ? (raw.group_ids ?? raw.groupIds)
        .map(String)
        .filter(Boolean)
        .map((id: string) => ({ id, name: id, displayName: id }))
      : [];
  return {
    subject: mapSubject(raw?.subject),
    groups: rawGroups,
    platformAdmin: Boolean(raw?.platform_admin ?? raw?.platformAdmin),
    productAccesses: Array.isArray(raw?.product_accesses ?? raw?.productAccesses)
      ? (raw.product_accesses ?? raw.productAccesses).map(mapProductAccess)
      : [],
    k8sProfiles: Array.isArray(raw?.k8s_profiles ?? raw?.k8sProfiles)
      ? (raw.k8s_profiles ?? raw.k8sProfiles).map(mapK8sAccessProfileSummary)
      : [],
    k8sBreakGlass: Array.isArray(raw?.k8s_break_glass ?? raw?.k8sBreakGlass)
      ? (raw.k8s_break_glass ?? raw.k8sBreakGlass).map(mapK8sBreakGlassAccess)
      : [],
    modules,
  };
}

function mapModuleAccess(raw: unknown): ModuleAccessLevel | undefined {
  return raw === 'hidden' || raw === 'read' || raw === 'manage' ? raw : undefined;
}

function mapPlatformAdminGrant(raw: any): PlatformAdminGrant {
  return {
    id: String(raw?.id ?? ''),
    subjectType: raw?.subject_type === 'group' || raw?.subjectType === 'group' ? 'group' : 'user',
    subjectId: String(raw?.subject_id ?? raw?.subjectId ?? ''),
    createdBy: raw?.created_by ?? raw?.createdBy ?? '',
    createdAt: raw?.created_at ?? raw?.createdAt ?? '',
  };
}

function mapProductAccessGrant(raw: any): ProductAccessGrant {
  return {
    id: String(raw?.id ?? ''),
    productId: String(raw?.product_id ?? raw?.productId ?? ''),
    subjectType: raw?.subject_type === 'service-account' || raw?.subjectType === 'service-account' ? 'service-account' : 'group',
    subjectId: String(raw?.subject_id ?? raw?.subjectId ?? ''),
    role: raw?.role === 'product-maintainer' ? 'product-maintainer' : 'product-viewer',
    createdBy: raw?.created_by ?? raw?.createdBy ?? '',
    createdAt: raw?.created_at ?? raw?.createdAt ?? '',
  };
}

function mapProductGrantSubject(raw: any): ProductGrantSubject {
  return {
    subjectType: raw?.subject_type === 'service-account' || raw?.subjectType === 'service-account'
      ? 'service-account'
      : 'group',
    subjectId: String(raw?.subject_id ?? raw?.subjectId ?? ''),
    displayName: raw?.display_name ?? raw?.displayName ?? '',
  };
}

function mapK8sAccessProfile(raw: any): K8sAccessProfile {
  return {
    ...mapK8sAccessProfileSummary(raw),
    createdBy: raw?.created_by ?? raw?.createdBy ?? '',
    createdAt: raw?.created_at ?? raw?.createdAt ?? '',
    updatedAt: raw?.updated_at ?? raw?.updatedAt ?? '',
  };
}

function mapK8sAccessGrant(raw: any): K8sAccessGrant {
  return {
    id: String(raw?.id ?? ''),
    groupId: String(raw?.group_id ?? raw?.groupId ?? ''),
    profileId: String(raw?.profile_id ?? raw?.profileId ?? ''),
    createdBy: raw?.created_by ?? raw?.createdBy ?? '',
    createdAt: raw?.created_at ?? raw?.createdAt ?? '',
  };
}

function mapBreakGlassGrant(raw: any): K8sBreakGlassGrant {
  return {
    id: String(raw?.id ?? ''),
    clusterId: String(raw?.cluster_id ?? raw?.clusterId ?? ''),
    requesterUserId: String(raw?.requester_user_id ?? raw?.requesterUserId ?? ''),
    approvedByUserId: String(raw?.approved_by_user_id ?? raw?.approvedByUserId ?? ''),
    reason: raw?.reason ?? '',
    impersonationGroup: raw?.impersonation_group ?? raw?.impersonationGroup ?? '',
    requestedAt: raw?.requested_at ?? raw?.requestedAt ?? '',
    approvedAt: raw?.approved_at ?? raw?.approvedAt ?? '',
    expiresAt: raw?.expires_at ?? raw?.expiresAt ?? '',
    revokedAt: raw?.revoked_at ?? raw?.revokedAt ?? '',
    revokedByUserId: raw?.revoked_by_user_id ?? raw?.revokedByUserId ?? '',
    status: raw?.status ?? 'unknown',
  };
}

function mapK8sNamespaceImpact(raw: any): K8sNamespaceImpact {
  return {
    clusterId: String(raw?.cluster_id ?? raw?.clusterId ?? ''),
    namespace: String(raw?.namespace ?? ''),
    productId: String(raw?.product_id ?? raw?.productId ?? ''),
    productName: String(raw?.product_name ?? raw?.productName ?? ''),
    serviceId: String(raw?.service_id ?? raw?.serviceId ?? ''),
    serviceName: String(raw?.service_name ?? raw?.serviceName ?? ''),
    deploymentId: String(raw?.deployment_id ?? raw?.deploymentId ?? ''),
    deploymentName: String(raw?.deployment_name ?? raw?.deploymentName ?? ''),
    workloadKind: String(raw?.workload_kind ?? raw?.workloadKind ?? ''),
    workloadName: String(raw?.workload_name ?? raw?.workloadName ?? ''),
  };
}

function mapWriteResult<T>(raw: any, mapper: (value: any) => T): AccessWriteResult<T> {
  return {
    item: raw?.item ? mapper(raw.item) : undefined,
    status: raw?.status ?? '',
    auditId: raw?.audit_id ?? raw?.auditId ?? '',
  };
}

function validateK8sAccessProfileInput(input: K8sAccessProfileInput | Omit<K8sAccessProfileInput, 'clusterId'>) {
  if (!input.wholeNamespaceConfirmed) {
    throw new Error('必须确认整 Namespace 风险后才能保存 K8S Access Profile');
  }
  const namespaces = [...new Set(input.namespaces.map((item) => item.trim()).filter(Boolean))];
  if (!namespaces.length || namespaces.some((item) => item === '*' || item.toLowerCase() === 'all_namespaces')) {
    throw new Error('K8S Access Profile 必须指定具体 Namespace，禁止空值、* 或 all_namespaces');
  }
  return namespaces;
}

export const accessApi = {
  async me(): Promise<PlatformAccessContext> {
    return mapAccessContext(await apiRequest<any>('/platform/me'));
  },
  async listPlatformAdminGrants(): Promise<PlatformAdminGrant[]> {
    const raw = await apiRequest<any[]>('/platform/admin-grants');
    return Array.isArray(raw) ? raw.map(mapPlatformAdminGrant) : [];
  },
  async createPlatformAdminGrant(input: Pick<PlatformAdminGrant, 'subjectType' | 'subjectId'>): Promise<AccessWriteResult<PlatformAdminGrant>> {
    const raw = await apiRequest<any>('/platform/admin-grants', {
      method: 'POST',
      body: JSON.stringify({ subject_type: input.subjectType, subject_id: input.subjectId }),
    });
    return mapWriteResult(raw, mapPlatformAdminGrant);
  },
  async deletePlatformAdminGrant(id: string): Promise<AccessWriteResult<PlatformAdminGrant>> {
    return mapWriteResult(
      await apiRequest<any>(`/platform/admin-grants/${encodeURIComponent(id)}`, { method: 'DELETE' }),
      mapPlatformAdminGrant,
    );
  },
  async listProductAccessGrants(productId: string): Promise<ProductAccessGrant[]> {
    const raw = await apiRequest<any[]>(`/products/${encodeURIComponent(productId)}/access-grants`);
    return Array.isArray(raw) ? raw.map(mapProductAccessGrant) : [];
  },
  async listProductGrantSubjects(productId: string): Promise<ProductGrantSubject[]> {
    const raw = await apiRequest<any[]>(`/products/${encodeURIComponent(productId)}/access-subjects`);
    return Array.isArray(raw) ? raw.map(mapProductGrantSubject) : [];
  },
  async createProductAccessGrant(productId: string, input: Pick<ProductAccessGrant, 'subjectType' | 'subjectId' | 'role'>): Promise<AccessWriteResult<ProductAccessGrant>> {
    const raw = await apiRequest<any>(`/products/${encodeURIComponent(productId)}/access-grants`, {
      method: 'POST',
      body: JSON.stringify({ subject_type: input.subjectType, subject_id: input.subjectId, role: input.role }),
    });
    return mapWriteResult(raw, mapProductAccessGrant);
  },
  async deleteProductAccessGrant(productId: string, id: string): Promise<AccessWriteResult<ProductAccessGrant>> {
    return mapWriteResult(
      await apiRequest<any>(`/products/${encodeURIComponent(productId)}/access-grants/${encodeURIComponent(id)}`, { method: 'DELETE' }),
      mapProductAccessGrant,
    );
  },
  async listK8sAccessProfiles(): Promise<K8sAccessProfile[]> {
    const raw = await apiRequest<any[]>('/k8s/access-profiles');
    return Array.isArray(raw) ? raw.map(mapK8sAccessProfile) : [];
  },
  async listK8sNamespaceImpacts(clusterId: string, namespaces: string[]): Promise<K8sNamespaceImpact[]> {
    const query = new URLSearchParams({ cluster_id: clusterId });
    namespaces.forEach((namespace) => query.append('namespace', namespace));
    const raw = await apiRequest<any[]>(`/platform/k8s/namespace-impacts?${query.toString()}`);
    return Array.isArray(raw) ? raw.map(mapK8sNamespaceImpact) : [];
  },
  async createK8sAccessProfile(input: K8sAccessProfileInput): Promise<AccessWriteResult<K8sAccessProfile>> {
    const namespaces = validateK8sAccessProfileInput(input);
    const raw = await apiRequest<any>('/k8s/access-profiles', {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        cluster_id: input.clusterId,
        access_level: input.accessLevel,
        namespaces,
        whole_namespace_confirmed: input.wholeNamespaceConfirmed,
      }),
    });
    return mapWriteResult(raw, mapK8sAccessProfile);
  },
  async updateK8sAccessProfile(id: string, input: Omit<K8sAccessProfileInput, 'clusterId'>): Promise<AccessWriteResult<K8sAccessProfile>> {
    const namespaces = validateK8sAccessProfileInput(input);
    const raw = await apiRequest<any>(`/k8s/access-profiles/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: input.name,
        access_level: input.accessLevel,
        namespaces,
        whole_namespace_confirmed: input.wholeNamespaceConfirmed,
      }),
    });
    return mapWriteResult(raw, mapK8sAccessProfile);
  },
  async deleteK8sAccessProfile(id: string): Promise<AccessWriteResult<K8sAccessProfile>> {
    return mapWriteResult(
      await apiRequest<any>(`/k8s/access-profiles/${encodeURIComponent(id)}`, { method: 'DELETE' }),
      mapK8sAccessProfile,
    );
  },
  async syncK8sAccessProfile(id: string): Promise<AccessWriteResult<K8sAccessProfile>> {
    return mapWriteResult(
      await apiRequest<any>(`/k8s/access-profiles/${encodeURIComponent(id)}/sync`, { method: 'POST' }),
      mapK8sAccessProfile,
    );
  },
  async listK8sAccessGrants(profileId = ''): Promise<K8sAccessGrant[]> {
    const query = profileId ? `?profile_id=${encodeURIComponent(profileId)}` : '';
    const raw = await apiRequest<any[]>(`/k8s/access-grants${query}`);
    return Array.isArray(raw) ? raw.map(mapK8sAccessGrant) : [];
  },
  async createK8sAccessGrant(input: Pick<K8sAccessGrant, 'groupId' | 'profileId'>): Promise<AccessWriteResult<K8sAccessGrant>> {
    const raw = await apiRequest<any>('/k8s/access-grants', {
      method: 'POST',
      body: JSON.stringify({ group_id: input.groupId, profile_id: input.profileId }),
    });
    return mapWriteResult(raw, mapK8sAccessGrant);
  },
  async deleteK8sAccessGrant(id: string): Promise<AccessWriteResult<K8sAccessGrant>> {
    return mapWriteResult(
      await apiRequest<any>(`/k8s/access-grants/${encodeURIComponent(id)}`, { method: 'DELETE' }),
      mapK8sAccessGrant,
    );
  },
  async listBreakGlassGrants(): Promise<K8sBreakGlassGrant[]> {
    const raw = await apiRequest<any[]>('/k8s/break-glass-grants');
    return Array.isArray(raw) ? raw.map(mapBreakGlassGrant) : [];
  },
  async requestBreakGlassGrant(input: Pick<K8sBreakGlassGrant, 'clusterId' | 'reason'>): Promise<AccessWriteResult<K8sBreakGlassGrant>> {
    const raw = await apiRequest<any>('/k8s/break-glass-grants', {
      method: 'POST',
      body: JSON.stringify({ cluster_id: input.clusterId, reason: input.reason }),
    });
    return mapWriteResult(raw, mapBreakGlassGrant);
  },
  async approveBreakGlassGrant(id: string, durationMinutes: number): Promise<AccessWriteResult<K8sBreakGlassGrant>> {
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 120) {
      throw new Error('Break Glass 审批时长必须是 1 到 120 分钟的整数');
    }
    return mapWriteResult(
      await apiRequest<any>(`/k8s/break-glass-grants/${encodeURIComponent(id)}/approve`, {
        method: 'POST',
        body: JSON.stringify({ duration_minutes: durationMinutes }),
      }),
      mapBreakGlassGrant,
    );
  },
  async revokeBreakGlassGrant(id: string): Promise<AccessWriteResult<K8sBreakGlassGrant>> {
    return mapWriteResult(
      await apiRequest<any>(`/k8s/break-glass-grants/${encodeURIComponent(id)}/revoke`, { method: 'POST' }),
      mapBreakGlassGrant,
    );
  },
};
