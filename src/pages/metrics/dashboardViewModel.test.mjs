import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiRequestError } from '../../services/api.ts';
import { dashboardViewState, grafanaWorkspaceURL } from './dashboardViewModel.ts';

test('Dashboard 页面区分加载、配置、隔离、权限、失败与就绪状态', () => {
  assert.equal(dashboardViewState({ loading: true }).kind, 'loading');
  assert.equal(dashboardViewState({ data: { state: 'unconfigured', embedURL: '', updatedAt: '' } }).kind, 'unconfigured');
  assert.equal(dashboardViewState({ data: { state: 'disabled', embedURL: '', updatedAt: '' } }).kind, 'disabled');
  const unavailable = dashboardViewState({
    data: {
      state: 'isolation_unavailable',
      embedURL: '',
      unavailableReason: '共享 Grafana 无法可靠隔离 Product',
      updatedAt: '',
    },
  });
  assert.equal(unavailable.kind, 'isolation_unavailable');
  assert.equal(unavailable.unavailableReason, '共享 Grafana 无法可靠隔离 Product');
  assert.equal(unavailable.embedURL, '');
  assert.equal(dashboardViewState({ error: new ApiRequestError('无权访问', 403, 'permission_denied') }).kind, 'forbidden');
  assert.equal(dashboardViewState({ error: new Error('上游失败') }).kind, 'error');
  assert.equal(dashboardViewState({ data: { state: 'ready', embedURL: '/grafana/d/nova/overview', updatedAt: '' } }).kind, 'ready');
});

test('Dashboard 慢加载只在 iframe 未完成时提示', () => {
  const data = { state: 'ready', embedURL: '/grafana/d/nova/overview', updatedAt: '' };
  assert.equal(dashboardViewState({ data, slow: true, loaded: false }).slow, true);
  assert.equal(dashboardViewState({ data, slow: true, loaded: true }).slow, false);
});

test('Dashboard 与 Explore 都强制使用 kiosk 模式且保留 Product 代理边界', () => {
  const configured = '/grafana/products/product-1/d/nova/overview?orgId=2&from=now-6h';

  assert.equal(
    grafanaWorkspaceURL(configured, 'dashboard'),
    '/grafana/products/product-1/d/nova/overview?orgId=2&from=now-6h&kiosk=1',
  );
  assert.equal(grafanaWorkspaceURL(configured, 'explore'), '/grafana/products/product-1/explore?orgId=2&kiosk=1');
  assert.equal(
    grafanaWorkspaceURL('/grafana/products/product-1/d/nova/overview?kiosk=tv', 'explore'),
    '/grafana/products/product-1/explore?kiosk=1',
  );
});
