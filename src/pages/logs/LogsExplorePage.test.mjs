import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildGrafanaExploreURL, buildLogsServiceFilter } from './LogsExplorePage.tsx';

const source = readFileSync(new URL('./LogsExplorePage.tsx', import.meta.url), 'utf8');

test('Logs Explore 优先使用 service.name 且采用冒号精确匹配语法', () => {
  assert.equal(
    buildLogsServiceFilter('checkout-api', 'svc-checkout-01'),
    '"service.name":"checkout-api"',
  );
});

test('服务名称尚未加载时回退稳定服务 ID 且不生成 := 语法', () => {
  assert.equal(
    buildLogsServiceFilter('', 'svc-checkout-01'),
    '"novaapm.service_id":"svc-checkout-01"',
  );
});

test('服务名称中的引号会被安全编码到 LogsQL 字符串', () => {
  assert.equal(
    buildLogsServiceFilter('checkout "blue"', 'svc-checkout-01'),
    '"service.name":"checkout \\"blue\\""',
  );
});

test('Grafana Explore URL 使用产品数据源 UID、Raw Logs 查询、服务过滤并强制 kiosk 模式', () => {
  const url = buildGrafanaExploreURL(
    { uid: 'np-vl-commerce-prod' },
    '"service.name":"checkout-api"',
  );

  const parsed = new URL(url, 'http://novaapm.local');
  const panes = JSON.parse(parsed.searchParams.get('panes'));
  const pane = panes['novaapm-logs'];
  assert.equal(parsed.pathname, '/grafana/explore');
  assert.equal(parsed.searchParams.get('kiosk'), '1');
  assert.equal(pane.datasource, 'np-vl-commerce-prod');
  assert.equal(pane.queries[0].datasource.uid, 'np-vl-commerce-prod');
  assert.equal(pane.queries[0].expr, '"service.name":"checkout-api"');
  assert.equal(pane.queries[0].queryType, 'instant');
  assert.notEqual(pane.datasource, '0:0');
});

test('Logs Explore 只提供平台内嵌查询，不暴露跳转 Grafana 的入口', () => {
  assert.doesNotMatch(source, /target="_blank"/);
  assert.doesNotMatch(source, /ExternalLink/);
});
