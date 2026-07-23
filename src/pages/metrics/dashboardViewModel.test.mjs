import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiRequestError } from '../../services/api.ts';
import { dashboardViewState, grafanaWorkspaceURL } from './dashboardViewModel.ts';

test('Dashboard 页面区分加载、配置、权限、失败与就绪状态', () => {
  assert.equal(dashboardViewState({ loading: true }).kind, 'loading');
  assert.equal(dashboardViewState({ data: { state: 'unconfigured', embedURL: '', updatedAt: '' } }).kind, 'unconfigured');
  assert.equal(dashboardViewState({ data: { state: 'disabled', embedURL: '', updatedAt: '' } }).kind, 'disabled');
  assert.equal(dashboardViewState({ error: new ApiRequestError('无权访问', 403, 'permission_denied') }).kind, 'forbidden');
  assert.equal(dashboardViewState({ error: new Error('上游失败') }).kind, 'error');
  assert.equal(dashboardViewState({ data: { state: 'ready', embedURL: '/grafana/d/nova/overview', updatedAt: '' } }).kind, 'ready');
});

test('Dashboard 慢加载只在 iframe 未完成时提示', () => {
  const data = { state: 'ready', embedURL: '/grafana/d/nova/overview', updatedAt: '' };
  assert.equal(dashboardViewState({ data, slow: true, loaded: false }).slow, true);
  assert.equal(dashboardViewState({ data, slow: true, loaded: true }).slow, false);
});

test('Explore 使用同源固定路径并只继承组织与 kiosk 参数', () => {
  const configured = '/grafana/d/nova/overview?orgId=2&kiosk&from=now-6h&access_token=ignored';

  assert.equal(grafanaWorkspaceURL(configured, 'dashboard'), configured);
  assert.equal(grafanaWorkspaceURL(configured, 'explore'), '/grafana/explore?orgId=2&kiosk=1');
  assert.equal(
    grafanaWorkspaceURL('/grafana/d/nova/overview?kiosk=tv', 'explore'),
    '/grafana/explore?kiosk=tv',
  );
});
