import { apiRequest } from '../../services/api';

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

export interface PlatformImage {
  key: string;
  value: string;
  updatedAt: string;
}

export interface PlatformGrafanaSetting {
	state: 'unconfigured' | 'disabled' | 'ready';
	entryURL: string;
  tokenConfigured: boolean;
  tokenFingerprint: string;
  tokenRotatedAt: string;
	updatedAt: string;
}

export interface PlatformWriteResult<T> {
  item?: T;
  status: string;
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

function mapImage(raw: any): PlatformImage {
  return {
    key: String(raw.key ?? ''),
    value: raw.value ?? '',
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  };
}

function mapGrafanaSetting(raw: any): PlatformGrafanaSetting {
	return {
		state: raw?.state ?? 'unconfigured',
		entryURL: raw?.entry_url ?? raw?.entryURL ?? '',
    tokenConfigured: Boolean(raw?.token_configured ?? raw?.tokenConfigured),
    tokenFingerprint: raw?.token_fingerprint ?? raw?.tokenFingerprint ?? '',
    tokenRotatedAt: raw?.token_rotated_at ?? raw?.tokenRotatedAt ?? '',
		updatedAt: raw?.updated_at ?? raw?.updatedAt ?? '',
	};
}

function mapWriteResult<T>(raw: any, mapper: (value: any) => T): PlatformWriteResult<T> {
  return {
    item: raw.item ? mapper(raw.item) : undefined,
    status: raw.status ?? '',
  };
}

function mapList<T>(raw: unknown, mapper: (value: any) => T): T[] {
  if (raw === null) return [];
  if (!Array.isArray(raw)) {
    throw new Error('平台列表接口返回格式错误');
  }
  return raw.map(mapper);
}

export const platformApi = {
  async me(): Promise<PlatformSubject> {
    const raw = await apiRequest<any>('/platform/me');
    return mapSubject(raw);
  },
  async listSubjects(): Promise<PlatformSubject[]> {
    const raw = await apiRequest<any[] | null>('/platform/subjects');
    return mapList(raw, mapSubject);
  },
  async listUsers(): Promise<PlatformUser[]> {
    const raw = await apiRequest<any[] | null>('/platform/users');
    return mapList(raw, mapUser);
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
    const raw = await apiRequest<any[] | null>('/platform/groups');
    return mapList(raw, mapGroup);
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
    const raw = await apiRequest<any[] | null>('/platform/group-memberships');
    return mapList(raw, mapMembership);
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
    const raw = await apiRequest<any[] | null>('/platform/service-accounts');
    return mapList(raw, mapServiceAccount);
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
  async listImages(): Promise<PlatformImage[]> {
    const raw = await apiRequest<any[] | null>('/platform/images');
    return mapList(raw, mapImage);
  },
  async updateImage(input: { key: string; value: string }): Promise<PlatformImage> {
    const raw = await apiRequest<any>('/platform/images', {
      method: 'PUT',
      body: JSON.stringify({ key: input.key, value: input.value }),
    });
    return mapImage(raw);
  },
	async getGrafanaSetting(): Promise<PlatformGrafanaSetting> {
		const raw = await apiRequest<any>('/platform/settings/grafana');
		return mapGrafanaSetting(raw);
	},
	async updateGrafanaSetting(entryURL: string, serviceAccountToken = ''): Promise<PlatformGrafanaSetting> {
		const raw = await apiRequest<any>('/platform/settings/grafana', {
			method: 'PUT',
			body: JSON.stringify({ entry_url: entryURL, service_account_token: serviceAccountToken || undefined }),
		});
		return mapGrafanaSetting(raw);
	},
  async testGrafanaConnection(): Promise<boolean> {
    const raw = await apiRequest<any>('/platform/settings/grafana/test', { method: 'POST' });
    return Boolean(raw.healthy);
  },
};
