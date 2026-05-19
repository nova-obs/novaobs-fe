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
      headers: { 'X-NovaObs-User': 'user-1' },
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
      headers: { 'X-NovaObs-User': 'user-1' },
    });
    return mapWriteResult(raw);
  },
};
