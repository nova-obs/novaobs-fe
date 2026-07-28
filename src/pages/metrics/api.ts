import { apiRequest } from '../../services/api';

export type MetricsDesiredState = 'connected' | 'disconnected';
export type MetricsSourceKind = 'kubernetes_infra' | 'host_infra' | 'log_derived';
export type MetricsCollectionMode = 'external_collector' | 'managed_collector';

export interface MetricsIntegration {
  id: string;
  productId: string;
	destinationRef: string;
  desiredState: MetricsDesiredState;
  identityLabelKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface MetricsSourceAccess {
  id: string;
  integrationId: string;
  resourceKind: 'k8s_cluster' | 'host_group' | '';
  resourceRef: string;
  sourceKind: MetricsSourceKind;
  collectionMode: MetricsCollectionMode;
  desiredState: MetricsDesiredState;
  createdAt: string;
  updatedAt: string;
}

export interface MetricsIntegrationView {
  integration: MetricsIntegration;
  sourceAccesses: MetricsSourceAccess[];
	collectorReleases: MetricsCollectorRelease[];
}

export interface MetricsWriteDestinationOption {
  id: string;
  name: string;
  remoteWriteURL: string;
  queryURL: string;
  uiURL: string;
}

export interface MetricsSourceHandoff {
  sourceAccessId: string;
  productId: string;
  resourceRef: string;
  destinationRef: string;
	artifacts: Array<{ kind: 'vmoperator_patch' | 'vmagent_args' | 'prometheus_patch' | 'vmalert_args'; content: string; note: string }>;
}

export type MetricsHealthStatus = 'healthy' | 'degraded' | 'failed' | 'unknown';
export interface MetricsHealthLayer { status: MetricsHealthStatus; message: string; observedAt: string }
export interface MetricsHealthSnapshot {
  id: string;
  integrationId: string;
  productId: string;
  configuration: MetricsHealthLayer;
  destination: MetricsHealthLayer;
  dataFlow: MetricsHealthLayer;
  sources: Array<{ sourceAccessId: string; sourceKind: MetricsSourceKind; status: MetricsHealthStatus; message: string }>;
	signals: Array<{ key: string; label: string; value: number; unit: 'ratio' | 'count'; status: MetricsHealthStatus }>;
  createdAt: string;
}
export interface MetricsOverviewItem extends MetricsIntegrationView { latestSnapshot: MetricsHealthSnapshot | null }
export type MetricsDashboardState = 'unconfigured' | 'disabled' | 'ready';
export interface MetricsDashboard {
	state: MetricsDashboardState;
	embedURL: string;
	updatedAt: string;
}
export interface MetricsCollectorRelease {
  id: string; sourceAccessId: string; generation: number; clusterId: string; namespace: string; image: string; status: 'previewed' | 'applied' | 'failed'; message: string;
  resources: Array<{ apiVersion: string; kind: string; namespace: string; name: string }>;
}
export interface MetricsSourceAssessment { sourceAccessId: string; resourceRef: string; status: MetricsHealthStatus; detectedCollector: string; detectedSignals: string[]; recommendedMode: MetricsCollectionMode; message: string; assessedAt: string }

function mapIntegration(raw: any): MetricsIntegration {
  return {
    id: String(raw?.id ?? ''),
    productId: raw?.product_id ?? raw?.productId ?? '',
    destinationRef: raw?.destination_ref ?? raw?.destinationRef ?? '',
    desiredState: raw?.desired_state ?? raw?.desiredState ?? 'disconnected',
    identityLabelKey: raw?.identity_label_key ?? raw?.identityLabelKey ?? '',
    createdAt: raw?.created_at ?? raw?.createdAt ?? '',
    updatedAt: raw?.updated_at ?? raw?.updatedAt ?? '',
  };
}

function mapSourceAccess(raw: any): MetricsSourceAccess {
  return {
    id: String(raw?.id ?? ''),
    integrationId: raw?.integration_id ?? raw?.integrationId ?? '',
    resourceKind: raw?.resource_kind ?? raw?.resourceKind ?? '',
    resourceRef: raw?.resource_ref ?? raw?.resourceRef ?? '',
    sourceKind: raw?.source_kind ?? raw?.sourceKind ?? 'kubernetes_infra',
    collectionMode: raw?.collection_mode ?? raw?.collectionMode ?? 'external_collector',
    desiredState: raw?.desired_state ?? raw?.desiredState ?? 'disconnected',
    createdAt: raw?.created_at ?? raw?.createdAt ?? '',
    updatedAt: raw?.updated_at ?? raw?.updatedAt ?? '',
  };
}

function mapIntegrationView(raw: any): MetricsIntegrationView {
  return {
    integration: mapIntegration(raw?.integration ?? {}),
    sourceAccesses: Array.isArray(raw?.source_accesses) ? raw.source_accesses.map(mapSourceAccess) : [],
		collectorReleases: Array.isArray(raw?.collector_releases) ? raw.collector_releases.map(mapCollectorRelease) : [],
  };
}

function mapDestination(raw: any): MetricsWriteDestinationOption {
  return {
    id: String(raw?.id ?? ''),
    name: raw?.name ?? '',
    remoteWriteURL: raw?.remote_write_url ?? raw?.remoteWriteURL ?? '',
    queryURL: raw?.query_url ?? raw?.queryURL ?? '',
    uiURL: raw?.ui_url ?? raw?.uiURL ?? '',
  };
}

function mapSourceHandoff(raw: any): MetricsSourceHandoff {
  return {
    sourceAccessId: raw?.source_access_id ?? '',
    productId: raw?.product_id ?? '',
    resourceRef: raw?.resource_ref ?? '',
    destinationRef: raw?.destination_ref ?? '',
    artifacts: Array.isArray(raw?.artifacts) ? raw.artifacts.map((item: any) => ({ kind: item.kind, content: item.content ?? '', note: item.note ?? '' })) : [],
  };
}

function mapHealthLayer(raw: any): MetricsHealthLayer {
  return { status: raw?.status ?? 'unknown', message: raw?.message ?? '', observedAt: raw?.observed_at ?? '' };
}

function mapHealthSnapshot(raw: any): MetricsHealthSnapshot {
  return {
    id: String(raw?.id ?? ''), integrationId: raw?.integration_id ?? '', productId: raw?.product_id ?? '',
    configuration: mapHealthLayer(raw?.configuration), destination: mapHealthLayer(raw?.destination), dataFlow: mapHealthLayer(raw?.data_flow),
		sources: Array.isArray(raw?.sources) ? raw.sources.map((source: any) => ({ sourceAccessId: source.source_access_id ?? '', sourceKind: source.source_kind ?? 'kubernetes_infra', status: source.status ?? 'unknown', message: source.message ?? '' })) : [],
		signals: Array.isArray(raw?.signals) ? raw.signals.map((signal: any) => ({ key: signal.key ?? '', label: signal.label ?? '', value: Number(signal.value ?? 0), unit: signal.unit ?? 'count', status: signal.status ?? 'unknown' })) : [],
    createdAt: raw?.created_at ?? '',
  };
}

function mapCollectorRelease(raw: any): MetricsCollectorRelease {
  return { id: String(raw?.id ?? ''), sourceAccessId: raw?.source_access_id ?? '', generation: Number(raw?.generation ?? 0), clusterId: raw?.cluster_id ?? '', namespace: raw?.namespace ?? '', image: raw?.image ?? '', status: raw?.status ?? 'failed', message: raw?.message ?? '', resources: Array.isArray(raw?.resources) ? raw.resources.map((item: any) => ({ apiVersion: item.api_version ?? '', kind: item.kind ?? '', namespace: item.namespace ?? '', name: item.name ?? '' })) : [] };
}

function mapSourceAssessment(raw: any): MetricsSourceAssessment {
  return { sourceAccessId: raw?.source_access_id ?? '', resourceRef: raw?.resource_ref ?? '', status: raw?.status ?? 'unknown', detectedCollector: raw?.detected_collector ?? '', detectedSignals: Array.isArray(raw?.detected_signals) ? raw.detected_signals : [], recommendedMode: raw?.recommended_mode ?? 'external_collector', message: raw?.message ?? '', assessedAt: raw?.assessed_at ?? '' };
}

export const metricsApi = {
	async listOverview(): Promise<MetricsOverviewItem[]> {
		const raw = await apiRequest<any[]>('/metrics/overview');
		return Array.isArray(raw) ? raw.map((item) => ({ ...mapIntegrationView(item), latestSnapshot: item?.latest_snapshot ? mapHealthSnapshot(item.latest_snapshot) : null })) : [];
	},
	async getDashboard(): Promise<MetricsDashboard> {
		const raw = await apiRequest<any>('/metrics/dashboard');
		return {
			state: raw?.state ?? 'unconfigured',
			embedURL: raw?.embed_url ?? raw?.embedURL ?? '',
			updatedAt: raw?.updated_at ?? raw?.updatedAt ?? '',
		};
	},
  async listIntegrations(): Promise<MetricsIntegrationView[]> {
    const raw = await apiRequest<any[]>('/metrics/integrations');
    return Array.isArray(raw) ? raw.map(mapIntegrationView) : [];
  },
  async getIntegration(id: string): Promise<MetricsIntegrationView> {
    const raw = await apiRequest<any>(`/metrics/integrations/${encodeURIComponent(id)}`);
    return mapIntegrationView(raw);
  },
	async createIntegration(input: { productId: string; destinationRef: string }): Promise<MetricsIntegrationView> {
    const raw = await apiRequest<any>('/metrics/integrations', {
      method: 'POST',
		body: JSON.stringify({ product_id: input.productId, destination_ref: input.destinationRef }),
    });
    return mapIntegrationView(raw);
  },
	async createSourceAccess(integrationId: string, input: { resourceKind: 'k8s_cluster' | 'host_group'; resourceRef: string }): Promise<MetricsSourceAccess> {
		const raw = await apiRequest<any>(`/metrics/integrations/${encodeURIComponent(integrationId)}/sources`, {
			method: 'POST',
			body: JSON.stringify({ resource_kind: input.resourceKind, resource_ref: input.resourceRef }),
		});
		return mapSourceAccess(raw);
	},
	async updateIntegration(integrationId: string, input: { destinationRef: string; desiredState: MetricsDesiredState }): Promise<MetricsIntegrationView> {
		const raw = await apiRequest<any>(`/metrics/integrations/${encodeURIComponent(integrationId)}`, {
			method: 'PATCH',
			body: JSON.stringify({ destination_ref: input.destinationRef, desired_state: input.desiredState }),
		});
		return mapIntegrationView(raw);
	},
	async listWriteDestinationOptions(productId: string): Promise<MetricsWriteDestinationOption[]> {
    const query = new URLSearchParams({ product_id: productId });
    const raw = await apiRequest<any[]>(`/metrics/write-destinations/options?${query.toString()}`);
    return Array.isArray(raw) ? raw.map(mapDestination) : [];
  },
  async updateSourceAccess(id: string, input: Partial<{ collectionMode: MetricsCollectionMode; desiredState: MetricsDesiredState }>): Promise<MetricsSourceAccess> {
    const raw = await apiRequest<any>(`/metrics/source-accesses/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ collection_mode: input.collectionMode, desired_state: input.desiredState }),
    });
    return mapSourceAccess(raw);
  },
  async getSourceHandoff(id: string): Promise<MetricsSourceHandoff> {
    const raw = await apiRequest<any>(`/metrics/source-accesses/${encodeURIComponent(id)}/handoff`);
    return mapSourceHandoff(raw);
  },
	async verifyIntegration(id: string): Promise<MetricsHealthSnapshot> {
		const raw = await apiRequest<any>(`/metrics/integrations/${encodeURIComponent(id)}/verify`, { method: 'POST' });
		return mapHealthSnapshot(raw);
	},
	async previewManagedCollector(sourceAccessId: string, namespace = 'novaapm-system'): Promise<MetricsCollectorRelease> {
		const raw = await apiRequest<any>(`/metrics/source-accesses/${encodeURIComponent(sourceAccessId)}/managed-release/preview`, { method: 'POST', body: JSON.stringify({ namespace }) });
		return mapCollectorRelease(raw);
	},
	async applyManagedCollector(sourceAccessId: string): Promise<MetricsCollectorRelease> {
		const raw = await apiRequest<any>(`/metrics/source-accesses/${encodeURIComponent(sourceAccessId)}/managed-release/apply`, { method: 'POST' });
		return mapCollectorRelease(raw);
	},
	async assessSource(sourceAccessId: string): Promise<MetricsSourceAssessment> {
		const raw = await apiRequest<any>(`/metrics/source-accesses/${encodeURIComponent(sourceAccessId)}/assess`, { method: 'POST' });
		return mapSourceAssessment(raw);
	},
	async enableLogDerivedSource(integrationId: string): Promise<MetricsSourceAccess> {
		const raw = await apiRequest<any>(`/metrics/integrations/${encodeURIComponent(integrationId)}/log-derived-source`, { method: 'POST' });
		return mapSourceAccess(raw);
	},
};
