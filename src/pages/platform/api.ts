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

export interface PlatformMembership {
  id: string;
  groupId: string;
  groupName: string;
  subjectId: string;
  subjectType: string;
  subjectDisplayName: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformEffectivePermission {
  bindingId: string;
  roleId: string;
  roleName: string;
  grantedToSubjectId: string;
  grantedToType: string;
  grantedVia: string;
  permissions: PlatformPermission[];
  scope: PlatformScope;
  createdAt: string;
}

export interface PlatformImage {
  key: string;
  value: string;
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

function mapMembership(raw: any): PlatformMembership {
  return {
    id: String(raw.id ?? ''),
    groupId: raw.group_id ?? raw.groupId ?? '',
    groupName: raw.group_name ?? raw.groupName ?? '',
    subjectId: raw.subject_id ?? raw.subjectId ?? '',
    subjectType: raw.subject_type ?? raw.subjectType ?? '',
    subjectDisplayName: raw.subject_display_name ?? raw.subjectDisplayName ?? '',
    createdAt: raw.created_at ?? raw.createdAt ?? '',
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  };
}

function mapEffectivePermission(raw: any): PlatformEffectivePermission {
  return {
    bindingId: String(raw.binding_id ?? raw.bindingId ?? ''),
    roleId: raw.role_id ?? raw.roleId ?? '',
    roleName: raw.role_name ?? raw.roleName ?? '',
    grantedToSubjectId: raw.granted_to_subject_id ?? raw.grantedToSubjectId ?? '',
    grantedToType: raw.granted_to_type ?? raw.grantedToType ?? '',
    grantedVia: raw.granted_via ?? raw.grantedVia ?? '',
    permissions: Array.isArray(raw.permissions) ? raw.permissions.map(mapPermission) : [],
    scope: mapScope(raw.scope ?? {}),
    createdAt: raw.created_at ?? raw.createdAt ?? '',
  };
}

function mapImage(raw: any): PlatformImage {
  return {
    key: String(raw.key ?? ''),
    value: raw.value ?? '',
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
  async deleteUser(id: string): Promise<PlatformWriteResult<PlatformUser>> {
    const raw = await apiRequest<any>(`/platform/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
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
  async deleteGroup(id: string): Promise<PlatformWriteResult<PlatformGroup>> {
    const raw = await apiRequest<any>(`/platform/groups/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return mapWriteResult(raw, mapGroup);
  },
  async listMemberships(): Promise<PlatformMembership[]> {
    const raw = await apiRequest<any[]>('/platform/group-memberships');
    return raw.map(mapMembership);
  },
  async createMembership(input: { groupId: string; subjectId: string; subjectType: string }): Promise<PlatformWriteResult<PlatformMembership>> {
    const raw = await apiRequest<any>('/platform/group-memberships', {
      method: 'POST',
      body: JSON.stringify({ group_id: input.groupId, subject_id: input.subjectId, subject_type: input.subjectType }),
    });
    return mapWriteResult(raw, mapMembership);
  },
  async deleteMembership(id: string): Promise<PlatformWriteResult<PlatformMembership>> {
    const raw = await apiRequest<any>(`/platform/group-memberships/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return mapWriteResult(raw, mapMembership);
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
  async deleteServiceAccount(id: string): Promise<PlatformWriteResult<PlatformServiceAccount>> {
    const raw = await apiRequest<any>(`/platform/service-accounts/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return mapWriteResult(raw, mapServiceAccount);
  },
  async listRoles(): Promise<PlatformRole[]> {
    const raw = await apiRequest<any[]>('/platform/roles');
    return raw.map(mapRole);
  },
  async createRole(input: { id?: string; name: string; description?: string; permissions: PlatformPermission[] }): Promise<PlatformWriteResult<PlatformRole>> {
    const raw = await apiRequest<any>('/platform/roles', {
      method: 'POST',
      body: JSON.stringify({
        id: input.id ?? '',
        name: input.name,
        description: input.description ?? '',
        permissions: input.permissions.map((permission) => ({
          resource: permission.resource,
          action: permission.action,
          scope_mode: permission.scopeMode,
        })),
      }),
    });
    return mapWriteResult(raw, mapRole);
  },
  async deleteRole(id: string): Promise<PlatformWriteResult<PlatformRole>> {
    const raw = await apiRequest<any>(`/platform/roles/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return mapWriteResult(raw, mapRole);
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
  async deleteBinding(id: string): Promise<PlatformWriteResult<PlatformBinding>> {
    const raw = await apiRequest<any>(`/platform/bindings/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return mapWriteResult(raw, mapBinding);
  },
  async effectivePermissions(input: { subjectId: string; subjectType: string }): Promise<PlatformEffectivePermission[]> {
    const params = new URLSearchParams({ subject_id: input.subjectId, subject_type: input.subjectType });
    const raw = await apiRequest<any[]>(`/platform/effective-permissions?${params.toString()}`);
    return raw.map(mapEffectivePermission);
  },
  async listImages(): Promise<PlatformImage[]> {
    const raw = await apiRequest<any[]>('/platform/images');
    return raw.map(mapImage);
  },
  async updateImage(input: { key: string; value: string }): Promise<PlatformImage> {
    const raw = await apiRequest<any>('/platform/images', {
      method: 'PUT',
      body: JSON.stringify({ key: input.key, value: input.value }),
    });
    return mapImage(raw);
  },
};
