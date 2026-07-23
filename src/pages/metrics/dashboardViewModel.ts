import { ApiRequestError } from '../../services/api';
import type { MetricsDashboard } from './api';

export type DashboardViewKind = 'loading' | 'unconfigured' | 'disabled' | 'forbidden' | 'error' | 'ready';

export interface DashboardViewState {
	kind: DashboardViewKind;
	embedURL: string;
	slow: boolean;
}

export type GrafanaWorkspaceView = 'dashboard' | 'explore';

export function grafanaWorkspaceURL(configuredURL: string, workspace: GrafanaWorkspaceView): string {
	if (workspace === 'dashboard') return configuredURL;

  const configured = new URL(configuredURL, 'http://novaapm.local');
  const query = new URLSearchParams();
  if (configured.searchParams.has('orgId')) {
    query.set('orgId', configured.searchParams.get('orgId') ?? '');
  }
  if (configured.searchParams.has('kiosk')) {
    const kiosk = configured.searchParams.get('kiosk');
    query.set('kiosk', kiosk === '' || kiosk === 'true' ? '1' : (kiosk ?? '1'));
  }
	const suffix = query.toString();
	return `/grafana/explore${suffix ? `?${suffix}` : ''}`;
}

export function dashboardViewState(input: {
	loading?: boolean;
	data?: MetricsDashboard;
	error?: unknown;
	slow?: boolean;
	loaded?: boolean;
}): DashboardViewState {
	if (input.loading) return { kind: 'loading', embedURL: '', slow: false };
	if (input.error instanceof ApiRequestError && input.error.status === 403) {
		return { kind: 'forbidden', embedURL: '', slow: false };
	}
	if (input.error) return { kind: 'error', embedURL: '', slow: false };
	if (input.data?.state === 'ready' && input.data.embedURL) {
		return { kind: 'ready', embedURL: input.data.embedURL, slow: Boolean(input.slow && !input.loaded) };
	}
	if (input.data?.state === 'disabled') return { kind: 'disabled', embedURL: '', slow: false };
	return { kind: 'unconfigured', embedURL: '', slow: false };
}
