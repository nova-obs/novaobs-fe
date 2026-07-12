import { apiRequest } from '../../services/api';

export interface VictoriaMetricsEndpointInput {
  name: string;
  description: string;
  scopeType: string;
  clusterId: string;
  remoteWriteURL: string;
  queryURL: string;
  uiURL: string;
  status: string;
}

export interface VictoriaMetricsEndpoint extends VictoriaMetricsEndpointInput {
  id: string;
  kind: 'victoriametrics';
  signalTypes: string[];
  health: { status: string; message: string; checkedAt: string; responseTimeMS: number };
  createdAt: string;
  updatedAt: string;
}

export interface EndpointTestResult {
  status: string;
  message: string;
  responseTimeMS: number;
  checkedAt: string;
}

function mapVictoriaMetricsEndpoint(raw: any): VictoriaMetricsEndpoint {
  return {
    id: String(raw?.id ?? ''),
    name: raw?.name ?? '',
    description: raw?.description ?? '',
    kind: 'victoriametrics',
    signalTypes: Array.isArray(raw?.signal_types) ? raw.signal_types.map(String) : [],
    scopeType: raw?.scope?.type ?? 'global',
    clusterId: raw?.scope?.cluster_id ?? '',
    remoteWriteURL: raw?.urls?.remote_write_url ?? raw?.urls?.write_url ?? '',
    queryURL: raw?.urls?.query_url ?? '',
    uiURL: raw?.urls?.ui_url ?? '',
    status: raw?.status ?? 'active',
    health: {
      status: raw?.health?.status ?? 'unknown',
      message: raw?.health?.message ?? '',
      checkedAt: raw?.health?.checked_at ?? '',
      responseTimeMS: Number(raw?.health?.response_time_ms ?? 0),
    },
    createdAt: raw?.created_at ?? '',
    updatedAt: raw?.updated_at ?? '',
  };
}

function payload(input: VictoriaMetricsEndpointInput) {
  return {
    name: input.name,
    description: input.description,
    kind: 'victoriametrics',
    signal_types: ['metrics'],
    scope: { type: input.scopeType, cluster_id: input.clusterId },
    urls: {
      remote_write_url: input.remoteWriteURL,
      query_url: input.queryURL,
      ui_url: input.uiURL,
    },
    status: input.status,
  };
}

export const observabilityEndpointsApi = {
  async listVictoriaMetrics(): Promise<VictoriaMetricsEndpoint[]> {
    const raw = await apiRequest<any[]>('/observability/endpoints?signal_type=metrics&kind=victoriametrics');
    return Array.isArray(raw) ? raw.map(mapVictoriaMetricsEndpoint) : [];
  },
  async createVictoriaMetrics(input: VictoriaMetricsEndpointInput): Promise<VictoriaMetricsEndpoint> {
    const raw = await apiRequest<any>('/observability/endpoints', { method: 'POST', body: JSON.stringify(payload(input)) });
    return mapVictoriaMetricsEndpoint(raw);
  },
  async updateVictoriaMetrics(id: string, input: VictoriaMetricsEndpointInput): Promise<VictoriaMetricsEndpoint> {
    const raw = await apiRequest<any>(`/observability/endpoints/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload(input)) });
    return mapVictoriaMetricsEndpoint(raw);
  },
  async test(id: string): Promise<EndpointTestResult> {
    const raw = await apiRequest<any>(`/observability/endpoints/${encodeURIComponent(id)}/test`, { method: 'POST' });
    return { status: raw?.status ?? 'unknown', message: raw?.message ?? '', responseTimeMS: Number(raw?.response_time_ms ?? 0), checkedAt: raw?.checked_at ?? '' };
  },
};
