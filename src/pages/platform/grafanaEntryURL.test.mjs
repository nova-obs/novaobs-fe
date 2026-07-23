import assert from 'node:assert/strict';
import test from 'node:test';
import { validateGrafanaEntryURL } from './grafanaEntryURL.ts';

test('Grafana 工作区允许 Dashboard 列表、Folder、具体 Dashboard 和 Explore', () => {
	const entries = [
		'http://grafana:3000/dashboards',
		'http://grafana:3000/dashboards/f/team-a/service-overview',
		'http://grafana:3000/d/nova/overview?orgId=1&kiosk',
		'http://grafana:3000/explore?orgId=1',
	];
	for (const entry of entries) assert.equal(validateGrafanaEntryURL(entry), '');
});

test('Grafana 工作区拒绝管理入口和凭证参数', () => {
	assert.match(validateGrafanaEntryURL('http://grafana:3000/admin/users'), /入口路径/);
	assert.match(validateGrafanaEntryURL('http://grafana:3000/login'), /入口路径/);
	assert.match(validateGrafanaEntryURL('http://grafana:3000/dashboards-admin'), /入口路径/);
	assert.match(validateGrafanaEntryURL('http://grafana:3000/explore-admin'), /入口路径/);
	assert.match(validateGrafanaEntryURL('http://grafana:3000/dashboards/%2e%2e/admin'), /入口路径/);
	assert.match(validateGrafanaEntryURL('http://grafana:3000/dashboards%2F..%2Fadmin'), /入口路径/);
	assert.match(validateGrafanaEntryURL('http://grafana:3000/explore?Access_Token=secret'), /访问凭证/);
});
