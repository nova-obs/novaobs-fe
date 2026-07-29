import { ApiRequestError } from '../../services/api';
import type { MetricsDashboard } from './api';

export type DashboardViewKind = 'loading' | 'unconfigured' | 'disabled' | 'isolation_unavailable' | 'forbidden' | 'error' | 'ready';

export interface DashboardViewState {
	kind: DashboardViewKind;
	embedURL: string;
	unavailableReason: string;
	slow: boolean;
}

export type GrafanaWorkspaceView = 'dashboard' | 'explore';

export function grafanaWorkspaceURL(configuredURL: string, workspace: GrafanaWorkspaceView): string {
  const configured = new URL(configuredURL, 'http://novaapm.local');
  if (workspace === 'dashboard') {
    configured.searchParams.set('kiosk', '1');
    const suffix = configured.searchParams.toString();
    return `${configured.pathname}${suffix ? `?${suffix}` : ''}`;
  }

  const query = new URLSearchParams();
  if (configured.searchParams.has('orgId')) {
    query.set('orgId', configured.searchParams.get('orgId') ?? '');
  }
  query.set('kiosk', '1');
	const suffix = query.toString();
  const productProxy = /^\/grafana\/products\/[^/]+/.exec(configured.pathname)?.[0];
  if (!productProxy) return '';
	return `${productProxy}/explore${suffix ? `?${suffix}` : ''}`;
}

export function dashboardViewState(input: {
	loading?: boolean;
	data?: MetricsDashboard;
	error?: unknown;
	slow?: boolean;
	loaded?: boolean;
}): DashboardViewState {
	if (input.loading) return { kind: 'loading', embedURL: '', unavailableReason: '', slow: false };
	if (input.error instanceof ApiRequestError && input.error.status === 403) {
		return { kind: 'forbidden', embedURL: '', unavailableReason: '', slow: false };
	}
	if (input.error) return { kind: 'error', embedURL: '', unavailableReason: '', slow: false };
	if (input.data?.state === 'ready' && input.data.embedURL) {
		return { kind: 'ready', embedURL: input.data.embedURL, unavailableReason: '', slow: Boolean(input.slow && !input.loaded) };
	}
	if (input.data?.state === 'disabled') return { kind: 'disabled', embedURL: '', unavailableReason: '', slow: false };
	if (input.data?.state === 'isolation_unavailable') {
		return {
			kind: 'isolation_unavailable',
			embedURL: '',
			unavailableReason: input.data.unavailableReason,
			slow: false,
		};
	}
	return { kind: 'unconfigured', embedURL: '', unavailableReason: '', slow: false };
}
