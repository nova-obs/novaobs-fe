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
    await page.screenshot({ path: `${previewDir}/products-wide.png`, fullPage: true, animations: 'disabled' });

    await page.getByRole('link', { name: '交易平台' }).click();
    await page.getByRole('heading', { name: '交易平台' }).waitFor();
    await assert.doesNotReject(() => page.getByText('结算服务').waitFor());

    await page.getByRole('link', { name: '集成' }).click();
    await assert.doesNotReject(() => page.getByText('np-prd-commerce-01').waitFor());
    await assert.doesNotReject(() => page.getByText('np-vl-commerce-prod').waitFor());

    await page.goto(`${baseURL}/products/prd-commerce-01/services/svc-checkout-01/overview`);
    await assert.doesNotReject(() => page.getByRole('heading', { name: '结算服务' }).waitFor());
    assert.equal(await page.getByRole('link', { name: '运行目标' }).count(), 0);
    await page.getByRole('link', { name: '观测关系' }).click();
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
    await page.waitForURL('**/products/prd-risk-03/services');
    await assert.doesNotReject(() => page.getByRole('heading', { name: '风控平台' }).waitFor());
  } finally {
    await browser?.close();
    await stop(frontend);
    await stop(api);
  }
});
