import { apiRequest } from '../../services/api';

export interface K8sCluster {
  id: string;
  name: string;
  version: string;
  region: string;
  description: string;
  status: string;
}

export interface K8sNamespace {
  id: string;
  clusterId: string;
  name: string;
  status: string;
  owner: string;
  phase: string;
  updatedAt: string;
}

export interface K8sResourceIdentity {
  clusterId: string;
  namespace: string;
  apiVersion: string;
  kind: string;
  name: string;
  uid: string;
}

export interface K8sResourceSummary {
  identity: K8sResourceIdentity;
  status: string;
  labels: Record<string, string>;
  updatedAt: string;
}

export interface K8sDeploymentHistory {
  id: string;
  clusterId: string;
  namespace: string;
  workload: string;
  action: string;
  status: string;
  revision: string;
  actor: string;
  startedAt: string;
  finishedAt: string;
}

export interface K8sAuditEvent {
  id: string;
  clusterId: string;
  namespace: string;
  resourceKind: string;
  resourceName: string;
  action: string;
  actor: string;
  status: string;
  traceId: string;
  createdAt: string;
}

export interface K8sCertificate {
  id: string;
  clusterId: string;
  namespace: string;
  name: string;
  commonName: string;
  fingerprint: string;
  notAfter: string;
  status: string;
  source: string;
}

export interface K8sServiceAccount {
  id: string;
  clusterId: string;
  namespace: string;
  name: string;
  uid: string;
  status: string;
  source: string;
  createdAt: string;
}

export interface K8sWriteResult<T> {
  item?: T;
  status?: string;
  auditId: string;
}

export interface K8sRBACRule {
  apiGroups: string[];
  resources: string[];
  verbs: string[];
}

export interface K8sRBACRole {
  id: string;
  clusterId: string;
  namespace: string;
  kind: string;
  name: string;
  uid: string;
  rules: K8sRBACRule[];
  source: string;
  updatedAt: string;
}

export interface K8sRBACSubject {
  kind: string;
  name: string;
  namespace: string;
}

export interface K8sRBACBinding {
  id: string;
  clusterId: string;
  namespace: string;
  kind: string;
  name: string;
  uid: string;
  roleRef: { kind: string; name: string };
  subjects: K8sRBACSubject[];
  source: string;
  updatedAt: string;
}

export interface K8sKubeconfigMetadata {
  secretId: string;
  fingerprint: string;
  expiresAt: string;
  auditId: string;
}

export interface K8sKubeconfigExport {
  kubeconfig: string;
  auditId: string;
}

export interface K8sTemplateVariable {
  name: string;
  description: string;
  defaultValue?: string;
  required: boolean;
}

export interface K8sTemplate {
  id: string;
  name: string;
  type: string;
  yamlContent: string;
  variables: K8sTemplateVariable[];
  description: string;
  source: string;
  createdBy: string;
  updatedAt: string;
}

export interface K8sTemplateRender {
  renderedYAML: string;
  auditId: string;
}

export interface K8sDeploymentIdentity {
  clusterId: string;
  namespace: string;
  apiVersion: string;
  kind: string;
  name: string;
  uid?: string;
}

export interface K8sDeploymentOperationResult {
  status: string;
  message: string;
  auditId: string;
  resources: K8sDeploymentIdentity[];
}

function mapCluster(raw: any): K8sCluster {
  return {
    id: String(raw.id ?? ''),
    name: raw.name ?? '',
    version: raw.version ?? '',
    region: raw.region ?? '',
    description: raw.description ?? '',
    status: raw.status ?? 'unknown',
  };
}

function mapNamespace(raw: any): K8sNamespace {
  return {
    id: String(raw.id ?? ''),
    clusterId: raw.cluster_id ?? raw.clusterId ?? '',
    name: raw.name ?? '',
    status: raw.status ?? 'unknown',
    owner: raw.owner ?? '',
    phase: raw.phase ?? '',
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  };
}

function mapResourceIdentity(raw: any): K8sResourceIdentity {
  return {
    clusterId: raw.cluster_id ?? raw.clusterId ?? '',
    namespace: raw.namespace ?? '',
    apiVersion: raw.api_version ?? raw.apiVersion ?? '',
    kind: raw.kind ?? '',
    name: raw.name ?? '',
    uid: raw.uid ?? '',
  };
}

function mapResource(raw: any): K8sResourceSummary {
  return {
    identity: mapResourceIdentity(raw.identity ?? {}),
    status: raw.status ?? 'unknown',
    labels: raw.labels ?? {},
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  };
}

function mapDeploymentHistory(raw: any): K8sDeploymentHistory {
  return {
    id: String(raw.id ?? ''),
    clusterId: raw.cluster_id ?? raw.clusterId ?? '',
    namespace: raw.namespace ?? '',
    workload: raw.workload ?? '',
    action: raw.action ?? '',
    status: raw.status ?? 'unknown',
    revision: raw.revision ?? '',
    actor: raw.actor ?? '',
    startedAt: raw.started_at ?? raw.startedAt ?? '',
    finishedAt: raw.finished_at ?? raw.finishedAt ?? '',
  };
}

function mapAuditEvent(raw: any): K8sAuditEvent {
  return {
    id: String(raw.id ?? ''),
    clusterId: raw.cluster_id ?? raw.clusterId ?? '',
    namespace: raw.namespace ?? '',
    resourceKind: raw.resource_kind ?? raw.resourceKind ?? '',
    resourceName: raw.resource_name ?? raw.resourceName ?? '',
    action: raw.action ?? '',
    actor: raw.actor ?? '',
    status: raw.status ?? 'unknown',
    traceId: raw.trace_id ?? raw.traceId ?? '',
    createdAt: raw.created_at ?? raw.createdAt ?? '',
  };
}

function mapCertificate(raw: any): K8sCertificate {
  return {
    id: String(raw.id ?? ''),
    clusterId: raw.cluster_id ?? raw.clusterId ?? '',
    namespace: raw.namespace ?? '',
    name: raw.name ?? '',
    commonName: raw.common_name ?? raw.commonName ?? '',
    fingerprint: raw.fingerprint ?? '',
    notAfter: raw.not_after ?? raw.notAfter ?? '',
    status: raw.status ?? 'unknown',
    source: raw.source ?? '',
  };
}

function mapServiceAccount(raw: any): K8sServiceAccount {
  return {
    id: String(raw.id ?? ''),
    clusterId: raw.cluster_id ?? raw.clusterId ?? '',
    namespace: raw.namespace ?? '',
    name: raw.name ?? '',
    uid: raw.uid ?? '',
    status: raw.status ?? 'unknown',
    source: raw.source ?? '',
    createdAt: raw.created_at ?? raw.createdAt ?? '',
  };
}

function mapWriteResult<T>(raw: any, mapItem?: (value: any) => T): K8sWriteResult<T> {
  return {
    item: raw.item && mapItem ? mapItem(raw.item) : undefined,
    status: raw.status ?? undefined,
    auditId: raw.audit_id ?? raw.auditId ?? '',
  };
}

function mapRBACRule(raw: any): K8sRBACRule {
  return {
    apiGroups: Array.isArray(raw.api_groups ?? raw.apiGroups) ? (raw.api_groups ?? raw.apiGroups).map(String) : [],
    resources: Array.isArray(raw.resources) ? raw.resources.map(String) : [],
    verbs: Array.isArray(raw.verbs) ? raw.verbs.map(String) : [],
  };
}

function mapRBACRole(raw: any): K8sRBACRole {
  return {
    id: String(raw.id ?? ''),
    clusterId: raw.cluster_id ?? raw.clusterId ?? '',
    namespace: raw.namespace ?? '',
    kind: raw.kind ?? '',
    name: raw.name ?? '',
    uid: raw.uid ?? '',
    rules: Array.isArray(raw.rules) ? raw.rules.map(mapRBACRule) : [],
    source: raw.source ?? '',
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  };
}

function mapRBACBinding(raw: any): K8sRBACBinding {
  return {
    id: String(raw.id ?? ''),
    clusterId: raw.cluster_id ?? raw.clusterId ?? '',
    namespace: raw.namespace ?? '',
    kind: raw.kind ?? '',
    name: raw.name ?? '',
    uid: raw.uid ?? '',
    roleRef: {
      kind: raw.role_ref?.kind ?? raw.roleRef?.kind ?? '',
      name: raw.role_ref?.name ?? raw.roleRef?.name ?? '',
    },
    subjects: Array.isArray(raw.subjects)
      ? raw.subjects.map((item: any) => ({ kind: item.kind ?? '', name: item.name ?? '', namespace: item.namespace ?? '' }))
      : [],
    source: raw.source ?? '',
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  };
}

function mapKubeconfigMetadata(raw: any): K8sKubeconfigMetadata {
  return {
    secretId: raw.secret_id ?? raw.secretId ?? '',
    fingerprint: raw.fingerprint ?? '',
    expiresAt: raw.expires_at ?? raw.expiresAt ?? '',
    auditId: raw.audit_id ?? raw.auditId ?? '',
  };
}

function mapKubeconfigExport(raw: any): K8sKubeconfigExport {
  return {
    kubeconfig: raw.kubeconfig ?? '',
    auditId: raw.audit_id ?? raw.auditId ?? '',
  };
}

function mapTemplateVariable(raw: any): K8sTemplateVariable {
  return {
    name: raw.name ?? '',
    description: raw.description ?? '',
    defaultValue: raw.default_value ?? raw.defaultValue ?? undefined,
    required: Boolean(raw.required),
  };
}

function mapTemplate(raw: any): K8sTemplate {
  return {
    id: String(raw.id ?? ''),
    name: raw.name ?? '',
    type: raw.type ?? '',
    yamlContent: raw.yaml_content ?? raw.yamlContent ?? '',
    variables: Array.isArray(raw.variables) ? raw.variables.map(mapTemplateVariable) : [],
    description: raw.description ?? '',
    source: raw.source ?? '',
    createdBy: raw.created_by ?? raw.createdBy ?? '',
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  };
}

function mapTemplateRender(raw: any): K8sTemplateRender {
  return {
    renderedYAML: raw.rendered_yaml ?? raw.renderedYAML ?? '',
    auditId: raw.audit_id ?? raw.auditId ?? '',
  };
}

function mapDeploymentIdentity(raw: any): K8sDeploymentIdentity {
  return {
    clusterId: raw.cluster_id ?? raw.clusterId ?? '',
    namespace: raw.namespace ?? '',
    apiVersion: raw.api_version ?? raw.apiVersion ?? '',
    kind: raw.kind ?? '',
    name: raw.name ?? '',
    uid: raw.uid ?? undefined,
  };
}

function mapDeploymentOperationResult(raw: any): K8sDeploymentOperationResult {
  return {
    status: raw.status ?? '',
    message: raw.message ?? '',
    auditId: raw.audit_id ?? raw.auditId ?? '',
    resources: Array.isArray(raw.resources) ? raw.resources.map(mapDeploymentIdentity) : [],
  };
}

export const k8sApi = {
  async listClusters(query = ''): Promise<K8sCluster[]> {
    const search = query.trim();
    const raw = await apiRequest<any[]>(`/k8s/clusters${search ? `?q=${encodeURIComponent(search)}` : ''}`);
    return raw.map(mapCluster);
  },
  async listNamespaces(clusterId = 'prod', query = ''): Promise<K8sNamespace[]> {
    const params = new URLSearchParams();
    if (clusterId) params.set('cluster_id', clusterId);
    if (query.trim()) params.set('q', query.trim());
    const raw = await apiRequest<any[]>(`/k8s/namespaces?${params.toString()}`);
    return raw.map(mapNamespace);
  },
  async listResources(filter: { clusterId?: string; namespace?: string; kind?: string; query?: string } = {}): Promise<K8sResourceSummary[]> {
    const params = new URLSearchParams();
    if (filter.clusterId) params.set('cluster_id', filter.clusterId);
    if (filter.namespace) params.set('namespace', filter.namespace);
    if (filter.kind) params.set('kind', filter.kind);
    if (filter.query?.trim()) params.set('q', filter.query.trim());
    const raw = await apiRequest<any[]>(`/k8s/resources?${params.toString()}`);
    return raw.map(mapResource);
  },
  async listDeploymentHistory(clusterId = 'prod'): Promise<K8sDeploymentHistory[]> {
    const raw = await apiRequest<any[]>(`/k8s/deployment-history?cluster_id=${encodeURIComponent(clusterId)}`);
    return raw.map(mapDeploymentHistory);
  },
  async listAuditEvents(clusterId = 'prod'): Promise<K8sAuditEvent[]> {
    const raw = await apiRequest<any[]>(`/k8s/audit-events?cluster_id=${encodeURIComponent(clusterId)}`);
    return raw.map(mapAuditEvent);
  },
  async listCertificates(clusterId = 'prod'): Promise<K8sCertificate[]> {
    const raw = await apiRequest<any[]>(`/k8s/certificates?cluster_id=${encodeURIComponent(clusterId)}`);
    return raw.map(mapCertificate);
  },
  async listServiceAccounts(clusterId = 'prod', namespace = 'orders'): Promise<K8sServiceAccount[]> {
    const params = new URLSearchParams();
    if (clusterId) params.set('cluster_id', clusterId);
    if (namespace) params.set('namespace', namespace);
    const raw = await apiRequest<any[]>(`/k8s/service-accounts?${params.toString()}`);
    return raw.map(mapServiceAccount);
  },
  async createServiceAccount(input: { clusterId: string; namespace: string; name: string }): Promise<K8sWriteResult<K8sServiceAccount>> {
    const raw = await apiRequest<any>('/k8s/service-accounts', {
      method: 'POST',
      body: JSON.stringify({ cluster_id: input.clusterId, namespace: input.namespace, name: input.name }),
    });
    return mapWriteResult(raw, mapServiceAccount);
  },
  async deleteServiceAccount(input: { clusterId: string; namespace: string; name: string; uid: string }): Promise<K8sWriteResult<never>> {
    const params = new URLSearchParams();
    params.set('cluster_id', input.clusterId);
    params.set('namespace', input.namespace);
    params.set('name', input.name);
    params.set('uid', input.uid);
    const raw = await apiRequest<any>(`/k8s/service-accounts?${params.toString()}`, {
      method: 'DELETE',
    });
    return mapWriteResult(raw);
  },
  async listRBACRoles(clusterId = 'prod', namespace = 'orders'): Promise<K8sRBACRole[]> {
    const params = new URLSearchParams();
    if (clusterId) params.set('cluster_id', clusterId);
    if (namespace) params.set('namespace', namespace);
    const raw = await apiRequest<any[]>(`/k8s/rbac/roles?${params.toString()}`);
    return raw.map(mapRBACRole);
  },
  async listRBACBindings(clusterId = 'prod', namespace = 'orders'): Promise<K8sRBACBinding[]> {
    const params = new URLSearchParams();
    if (clusterId) params.set('cluster_id', clusterId);
    if (namespace) params.set('namespace', namespace);
    const raw = await apiRequest<any[]>(`/k8s/rbac/bindings?${params.toString()}`);
    return raw.map(mapRBACBinding);
  },
  async createRBACRole(input: { clusterId: string; namespace: string; name: string }): Promise<K8sWriteResult<K8sRBACRole>> {
    const raw = await apiRequest<any>('/k8s/rbac/roles', {
      method: 'POST',
      body: JSON.stringify({
        cluster_id: input.clusterId,
        namespace: input.namespace,
        kind: 'Role',
        name: input.name,
        rules: [{ api_groups: [''], resources: ['pods'], verbs: ['get', 'list'] }],
      }),
    });
    return mapWriteResult(raw, mapRBACRole);
  },
  async createRBACBinding(input: { clusterId: string; namespace: string; name: string; roleName: string; serviceAccountName: string }): Promise<K8sWriteResult<K8sRBACBinding>> {
    const raw = await apiRequest<any>('/k8s/rbac/bindings', {
      method: 'POST',
      body: JSON.stringify({
        cluster_id: input.clusterId,
        namespace: input.namespace,
        kind: 'RoleBinding',
        name: input.name,
        role_ref: { kind: 'Role', name: input.roleName },
        subjects: [{ kind: 'ServiceAccount', name: input.serviceAccountName, namespace: input.namespace }],
      }),
    });
    return mapWriteResult(raw, mapRBACBinding);
  },
  async deleteRBACBinding(input: { clusterId: string; namespace: string; kind: string; name: string; uid: string }): Promise<K8sWriteResult<never>> {
    const params = new URLSearchParams();
    params.set('cluster_id', input.clusterId);
    params.set('namespace', input.namespace);
    params.set('kind', input.kind);
    params.set('name', input.name);
    params.set('uid', input.uid);
    const raw = await apiRequest<any>(`/k8s/rbac/bindings?${params.toString()}`, { method: 'DELETE' });
    return mapWriteResult(raw);
  },
  async createKubeconfig(input: { clusterId: string; namespace: string; serviceAccount: string }): Promise<K8sKubeconfigMetadata> {
    const raw = await apiRequest<any>('/k8s/kubeconfigs', {
      method: 'POST',
      body: JSON.stringify({ cluster_id: input.clusterId, namespace: input.namespace, service_account: input.serviceAccount }),
    });
    return mapKubeconfigMetadata(raw);
  },
  async exportKubeconfig(secretId: string): Promise<K8sKubeconfigExport> {
    const raw = await apiRequest<any>('/k8s/kubeconfigs/export', {
      method: 'POST',
      body: JSON.stringify({ secret_id: secretId }),
    });
    return mapKubeconfigExport(raw);
  },
  async listTemplates(type = ''): Promise<K8sTemplate[]> {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    const raw = await apiRequest<any[]>(`/k8s/templates${params.toString() ? `?${params.toString()}` : ''}`);
    return raw.map(mapTemplate);
  },
  async createTemplate(input: { name: string; type: string; yamlContent: string; variables: K8sTemplateVariable[]; description?: string }): Promise<K8sWriteResult<K8sTemplate>> {
    const raw = await apiRequest<any>('/k8s/templates', {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        type: input.type,
        yaml_content: input.yamlContent,
        variables: input.variables.map((item) => ({ name: item.name, description: item.description, default_value: item.defaultValue, required: item.required })),
        description: input.description ?? '',
      }),
    });
    return mapWriteResult(raw, mapTemplate);
  },
  async updateTemplate(input: { id: string; name: string; type: string; yamlContent: string; variables: K8sTemplateVariable[]; description?: string }): Promise<K8sWriteResult<K8sTemplate>> {
    const raw = await apiRequest<any>('/k8s/templates', {
      method: 'PUT',
      body: JSON.stringify({
        id: input.id,
        name: input.name,
        type: input.type,
        yaml_content: input.yamlContent,
        variables: input.variables.map((item) => ({ name: item.name, description: item.description, default_value: item.defaultValue, required: item.required })),
        description: input.description ?? '',
      }),
    });
    return mapWriteResult(raw, mapTemplate);
  },
  async deleteTemplate(id: string): Promise<K8sWriteResult<never>> {
    const raw = await apiRequest<any>(`/k8s/templates/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return mapWriteResult(raw);
  },
  async renderTemplate(id: string, variables: Record<string, string>): Promise<K8sTemplateRender> {
    const raw = await apiRequest<any>('/k8s/templates/render', {
      method: 'POST',
      body: JSON.stringify({ id, variables }),
    });
    return mapTemplateRender(raw);
  },
  async previewDeployment(input: { clusterId: string; yamlContent: string }): Promise<K8sDeploymentOperationResult> {
    const raw = await apiRequest<any>('/k8s/deployments/preview', {
      method: 'POST',
      body: JSON.stringify({ cluster_id: input.clusterId, yaml_content: input.yamlContent }),
    });
    return mapDeploymentOperationResult(raw);
  },
  async applyDeployment(input: { clusterId: string; yamlContent: string }): Promise<K8sDeploymentOperationResult> {
    const raw = await apiRequest<any>('/k8s/deployments', {
      method: 'POST',
      body: JSON.stringify({ cluster_id: input.clusterId, yaml_content: input.yamlContent }),
    });
    return mapDeploymentOperationResult(raw);
  },
  async deleteDeployment(identity: K8sDeploymentIdentity): Promise<K8sDeploymentOperationResult> {
    const raw = await apiRequest<any>('/k8s/deployments', {
      method: 'DELETE',
      body: JSON.stringify({
        identity: {
          cluster_id: identity.clusterId,
          namespace: identity.namespace,
          api_version: identity.apiVersion,
          kind: identity.kind,
          name: identity.name,
          uid: identity.uid,
        },
      }),
    });
    return mapDeploymentOperationResult(raw);
  },
  async rollbackDeployment(input: { identity: K8sDeploymentIdentity; historyId: string }): Promise<K8sDeploymentOperationResult> {
    const raw = await apiRequest<any>('/k8s/deployments/rollback', {
      method: 'POST',
      body: JSON.stringify({
        history_id: input.historyId,
        identity: {
          cluster_id: input.identity.clusterId,
          namespace: input.identity.namespace,
          api_version: input.identity.apiVersion,
          kind: input.identity.kind,
          name: input.identity.name,
          uid: input.identity.uid,
        },
      }),
    });
    return mapDeploymentOperationResult(raw);
  },
};
