import { apiRequest } from '../../services/api';

export interface PlatformScope {
  global: boolean;
  clusterId: string;
  namespace: string;
  environment: string;
  serviceId: string;
}

export interface PlatformPermission {
  resource: string;
  action: string;
  scopeMode: string;
}

export interface PlatformSubject {
  id: string;
  subjectId: string;
  subjectType: string;
  displayName: string;
  email: string;
  status: string;
  source: string;
  bindingRefs: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  passwordSet: boolean;
  status: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformGroup {
  id: string;
  name: string;
  displayName: string;
  description: string;
  status: string;
  source: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformServiceAccount {
  id: string;
  name: string;
  displayName: string;
  description: string;
  status: string;
  owner: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformRole {
  id: string;
  name: string;
  description: string;
  permissions: PlatformPermission[];
  createdAt: string;
  updatedAt: string;
}

export interface PlatformBinding {
  id: string;
  subjectId: string;
  subjectType: string;
  roleId: string;
  roleName: string;
  scope: PlatformScope;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformWriteResult<T> {
  item?: T;
  status: string;
}

function mapScope(raw: any): PlatformScope {
  return {
    global: Boolean(raw?.global),
    clusterId: raw?.cluster_id ?? raw?.clusterId ?? '',
    namespace: raw?.namespace ?? '',
    environment: raw?.environment ?? '',
    serviceId: raw?.service_id ?? raw?.serviceId ?? '',
  };
}

function mapPermission(raw: any): PlatformPermission {
  return {
    resource: raw.resource ?? '',
    action: raw.action ?? '',
    scopeMode: raw.scope_mode ?? raw.scopeMode ?? '',
  };
}

function mapSubject(raw: any): PlatformSubject {
  return {
    id: String(raw.id ?? ''),
    subjectId: raw.subject_id ?? raw.subjectId ?? '',
    subjectType: raw.subject_type ?? raw.subjectType ?? '',
    displayName: raw.display_name ?? raw.displayName ?? '',
    email: raw.email ?? '',
    status: raw.status ?? 'unknown',
    source: raw.source ?? '',
    bindingRefs: raw.binding_refs ?? raw.bindingRefs ?? 0,
    createdAt: raw.created_at ?? raw.createdAt ?? '',
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  };
}

function mapUser(raw: any): PlatformUser {
  return {
    id: String(raw.id ?? ''),
    username: raw.username ?? '',
    displayName: raw.display_name ?? raw.displayName ?? '',
    email: raw.email ?? '',
    passwordSet: Boolean(raw.password_set ?? raw.passwordSet),
    status: raw.status ?? 'unknown',
    source: raw.source ?? '',
    createdAt: raw.created_at ?? raw.createdAt ?? '',
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  };
}

function mapGroup(raw: any): PlatformGroup {
  return {
    id: String(raw.id ?? ''),
    name: raw.name ?? '',
    displayName: raw.display_name ?? raw.displayName ?? '',
    description: raw.description ?? '',
    status: raw.status ?? 'unknown',
    source: raw.source ?? '',
    memberCount: raw.member_count ?? raw.memberCount ?? 0,
    createdAt: raw.created_at ?? raw.createdAt ?? '',
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  };
}

function mapServiceAccount(raw: any): PlatformServiceAccount {
  return {
    id: String(raw.id ?? ''),
    name: raw.name ?? '',
    displayName: raw.display_name ?? raw.displayName ?? '',
    description: raw.description ?? '',
    status: raw.status ?? 'unknown',
    owner: raw.owner ?? '',
    createdAt: raw.created_at ?? raw.createdAt ?? '',
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  };
}

function mapRole(raw: any): PlatformRole {
  return {
    id: String(raw.id ?? ''),
    name: raw.name ?? '',
    description: raw.description ?? '',
    permissions: Array.isArray(raw.permissions) ? raw.permissions.map(mapPermission) : [],
    createdAt: raw.created_at ?? raw.createdAt ?? '',
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  };
}

function mapBinding(raw: any): PlatformBinding {
  return {
    id: String(raw.id ?? ''),
    subjectId: raw.subject_id ?? raw.subjectId ?? '',
    subjectType: raw.subject_type ?? raw.subjectType ?? '',
    roleId: raw.role_id ?? raw.roleId ?? '',
    roleName: raw.role_name ?? raw.roleName ?? '',
    scope: mapScope(raw.scope ?? {}),
    createdAt: raw.created_at ?? raw.createdAt ?? '',
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  };
}

function mapWriteResult<T>(raw: any, mapper: (value: any) => T): PlatformWriteResult<T> {
  return {
    item: raw.item ? mapper(raw.item) : undefined,
    status: raw.status ?? '',
  };
}

export const platformApi = {
  async me(): Promise<PlatformSubject> {
    const raw = await apiRequest<any>('/platform/me');
    return mapSubject(raw);
  },
  async listSubjects(): Promise<PlatformSubject[]> {
    const raw = await apiRequest<any[]>('/platform/subjects');
    return raw.map(mapSubject);
  },
  async listUsers(): Promise<PlatformUser[]> {
    const raw = await apiRequest<any[]>('/platform/users');
    return raw.map(mapUser);
  },
  async createUser(input: { username: string; displayName: string; email?: string; password?: string }): Promise<PlatformWriteResult<PlatformUser>> {
    const raw = await apiRequest<any>('/platform/users', {
      method: 'POST',
      body: JSON.stringify({ username: input.username, display_name: input.displayName, email: input.email ?? '', password: input.password ?? '' }),
    });
    return mapWriteResult(raw, mapUser);
  },
  async listGroups(): Promise<PlatformGroup[]> {
    const raw = await apiRequest<any[]>('/platform/groups');
    return raw.map(mapGroup);
  },
  async createGroup(input: { name: string; displayName: string; description?: string }): Promise<PlatformWriteResult<PlatformGroup>> {
    const raw = await apiRequest<any>('/platform/groups', {
      method: 'POST',
      body: JSON.stringify({ name: input.name, display_name: input.displayName, description: input.description ?? '' }),
    });
    return mapWriteResult(raw, mapGroup);
  },
  async listServiceAccounts(): Promise<PlatformServiceAccount[]> {
    const raw = await apiRequest<any[]>('/platform/service-accounts');
    return raw.map(mapServiceAccount);
  },
  async createServiceAccount(input: { name: string; displayName: string; owner?: string; description?: string }): Promise<PlatformWriteResult<PlatformServiceAccount>> {
    const raw = await apiRequest<any>('/platform/service-accounts', {
      method: 'POST',
      body: JSON.stringify({ name: input.name, display_name: input.displayName, owner: input.owner ?? '', description: input.description ?? '' }),
    });
    return mapWriteResult(raw, mapServiceAccount);
  },
  async listRoles(): Promise<PlatformRole[]> {
    const raw = await apiRequest<any[]>('/platform/roles');
    return raw.map(mapRole);
  },
  async listBindings(): Promise<PlatformBinding[]> {
    const raw = await apiRequest<any[]>('/platform/bindings');
    return raw.map(mapBinding);
  },
  async createBinding(input: { subjectId: string; subjectType: string; roleId: string; scope: Partial<PlatformScope> }): Promise<PlatformWriteResult<PlatformBinding>> {
    const raw = await apiRequest<any>('/platform/bindings', {
      method: 'POST',
      body: JSON.stringify({
        subject_id: input.subjectId,
        subject_type: input.subjectType,
        role_id: input.roleId,
        scope: {
          global: Boolean(input.scope.global),
          cluster_id: input.scope.clusterId ?? '',
          namespace: input.scope.namespace ?? '',
          environment: input.scope.environment ?? '',
          service_id: input.scope.serviceId ?? '',
        },
      }),
    });
    return mapWriteResult(raw, mapBinding);
  },
};
