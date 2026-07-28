import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const frontendPort = 3101;
const apiPort = 18081;
const baseURL = `http://127.0.0.1:${frontendPort}`;
const previewDir = fileURLToPath(new URL('../docs/design/previews/', import.meta.url));

async function waitForURL(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // 服务仍在启动。
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`等待服务超时: ${url}`);
}

function start(command, args, env = {}) {
  return spawn(command, args, {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
}

test('产品—服务目录关键路径与响应式布局', { timeout: 60_000 }, async () => {
  await mkdir(previewDir, { recursive: true });
  const api = start(process.execPath, ['e2e/mock-catalog-api.mjs'], { PORT: String(apiPort) });
  const frontend = start(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['exec', 'vite', '--', '--host', '127.0.0.1', '--port', String(frontendPort)],
    { NOVAAPM_API_PROXY_TARGET: `http://127.0.0.1:${apiPort}` },
  );
  let browser;
  try {
    await waitForURL(`${baseURL}/products`);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${baseURL}/products`);
    await page.getByRole('heading', { name: '产品与服务' }).waitFor();
    await assert.doesNotReject(() => page.locator('td').filter({ hasText: '0:42001' }).waitFor());
    await assert.doesNotReject(() => page.locator('tr').filter({ hasText: '结算服务' }).waitFor());
    assert.equal(await page.getByText('VictoriaLogs 租户', { exact: true }).count(), 0);
    const productRowStyle = await page.locator('table [data-product-id="prd-commerce-01"] td').first().evaluate((cell) => ({
      backgroundColor: getComputedStyle(cell).backgroundColor,
      height: cell.getBoundingClientRect().height,
    }));
    const serviceRowStyle = await page.locator('table [data-service-id="svc-checkout-01"] td').first().evaluate((cell) => ({
      backgroundColor: getComputedStyle(cell).backgroundColor,
      height: cell.getBoundingClientRect().height,
    }));
    assert.notEqual(productRowStyle.backgroundColor, serviceRowStyle.backgroundColor);
    assert.ok(productRowStyle.height > serviceRowStyle.height);
    const productActionStyle = await page
      .locator('table [data-product-id="prd-commerce-01"]')
      .getByRole('button', { name: '集成', exact: true })
      .evaluate((button) => ({
        borderWidth: getComputedStyle(button).borderWidth,
        height: button.getBoundingClientRect().height,
      }));
    assert.equal(productActionStyle.borderWidth, '0px');
    assert.ok(productActionStyle.height <= 28);

    await page.getByRole('button', { name: '折叠产品 交易平台' }).click();
    assert.equal(await page.locator('table [data-service-id="svc-checkout-01"]').count(), 0);
    await page.getByLabel('查询产品或服务').fill('checkout-oncall');
    await assert.doesNotReject(() => page.locator('table [data-product-id="prd-commerce-01"]').waitFor());
    await assert.doesNotReject(() => page.locator('table [data-service-id="svc-checkout-01"]').waitFor());
    assert.equal(await page.locator('table [data-product-id="prd-growth-02"]').count(), 0);
    await page.getByLabel('查询产品或服务').fill('');
    assert.equal(await page.locator('table [data-service-id="svc-checkout-01"]').count(), 0);
    await page.getByRole('button', { name: '展开产品 交易平台' }).click();
    await assert.doesNotReject(() => page.locator('table [data-service-id="svc-checkout-01"]').waitFor());

    await page.getByLabel('筛选服务来源').selectOption('manual');
    await assert.doesNotReject(() => page.locator('table [data-service-id="svc-checkout-01"]').waitFor());
    assert.equal(await page.locator('table [data-product-id="prd-growth-02"]').count(), 0);
    await page.getByRole('button', { name: '清除筛选' }).click();

    await page.getByLabel('列表排序').selectOption('name_asc');
    const ascendingProducts = await page.locator('table [data-product-id]').allTextContents();
    await page.getByLabel('列表排序').selectOption('name_desc');
    const descendingProducts = await page.locator('table [data-product-id]').allTextContents();
    assert.deepEqual(descendingProducts, [...ascendingProducts].reverse());
    await page.getByLabel('列表排序').selectOption('updated_desc');

    await page.screenshot({ path: `${previewDir}/products-wide.png`, fullPage: true, animations: 'disabled' });

    await page.getByRole('button', { name: '服务', exact: true }).first().click();
    await page.getByRole('radio', { name: /从 Kubernetes 导入/ }).click();
    await page.getByLabel('选择集群 *').selectOption('test03');
    await page.getByLabel('选择 Namespace *').selectOption('orders');
    await page.getByLabel('选择 Deployment *').selectOption('deployment-orders-api');
    await assert.doesNotReject(() => page.getByText('将创建的服务身份').waitFor());
    await page.screenshot({ path: `${previewDir}/service-import-k8s-wide.png`, fullPage: true, animations: 'disabled' });
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.screenshot({ path: `${previewDir}/service-import-k8s-1366.png`, fullPage: true, animations: 'disabled' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${previewDir}/service-import-k8s-narrow.png`, fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: '导入并创建服务' }).click();
    await page.waitForURL('**/products/prd-commerce-01/services/svc-orders-api-02');
    await page.locator('#service-detail-title').filter({ hasText: 'orders-api' }).waitFor();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: `${previewDir}/service-detail-drawer-wide.png`, fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: '关闭服务详情', exact: true }).click();

    await page.getByRole('button', { name: '集成', exact: true }).first().click();
    await assert.doesNotReject(() => page.getByText('np-prd-commerce-01').waitFor());
    await assert.doesNotReject(() => page.getByText('np-vl-commerce-prod').waitFor());
    await assert.doesNotReject(() => page.getByText('Datasource 通过请求 Header 透传产品统一租户，不改变平台的租户定义。').waitFor());
    await page.screenshot({ path: `${previewDir}/product-integration-drawer-wide.png`, fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: '关闭产品集成', exact: true }).click();

    await page.goto(`${baseURL}/products/prd-commerce-01/services/svc-checkout-01/overview`);
    await page.waitForURL('**/products/prd-commerce-01/services/svc-checkout-01');
    await assert.doesNotReject(() => page.locator('#service-detail-title').filter({ hasText: '结算服务' }).waitFor());
    assert.equal(await page.getByRole('link', { name: '运行目标' }).count(), 0);
    await assert.doesNotReject(() => page.getByText('route-checkout-prod').waitFor());

    await page.goto(`${baseURL}/products`);
    await page.getByRole('heading', { name: '产品与服务' }).waitFor();
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.screenshot({ path: `${previewDir}/products-1366.png`, fullPage: true, animations: 'disabled' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${previewDir}/products-narrow.png`, fullPage: true, animations: 'disabled' });

    await page.getByRole('button', { name: '新增产品' }).click();
    await page.getByLabel('产品 Key *').fill('risk');
    await page.getByLabel('产品名称 *').fill('风控平台');
    await page.getByRole('button', { name: '创建产品' }).click();
    await page.waitForURL('**/products');
    await assert.doesNotReject(() => page.getByText('风控平台', { exact: true }).first().waitFor());
    await assert.doesNotReject(() => page.getByRole('button', { name: '产品下暂无服务，立即新增' }).first().waitFor());
  } finally {
    await browser?.close();
    await stop(frontend);
    await stop(api);
  }
});
