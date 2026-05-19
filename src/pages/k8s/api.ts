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
};
