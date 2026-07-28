import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const frontendPort = 3103;
const apiPort = 18083;
const baseURL = `http://127.0.0.1:${frontendPort}`;
const previewDir = fileURLToPath(new URL('../tmp/ui-previews/', import.meta.url));

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

test('删除后同名重登记集群必须按 ID 显式重绑定', { timeout: 60_000 }, async () => {
  await mkdir(previewDir, { recursive: true });
  const api = start(process.execPath, ['e2e/mock-catalog-api.mjs'], { PORT: String(apiPort) });
  const frontend = start(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['exec', 'vite', '--', '--host', '127.0.0.1', '--port', String(frontendPort)],
    { NOVAAPM_API_PROXY_TARGET: `http://127.0.0.1:${apiPort}` },
  );
  let browser;
  try {
    await waitForURL(`${baseURL}/k8s/observability`);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    await page.goto(`${baseURL}/k8s/observability?cluster_id=calico-test03-02&namespace=novaapm-system&task=incremental`);

    await page.getByText('目标集群 ID“calico-test03-02”未登记；平台不会按名称自动改绑').waitFor();
    assert.equal(await page.getByRole('option', { name: 'calico-test03-02 · ID: test03' }).count(), 1);
    await page.screenshot({ path: `${previewDir}/k8s-observability-cluster-rebind-1366.png`, fullPage: true, animations: 'disabled' });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${previewDir}/k8s-observability-cluster-rebind-narrow.png`, fullPage: true, animations: 'disabled' });

    await page.getByRole('button', { name: '切换至 ID: test03' }).click();
    await page.waitForURL('**cluster_id=test03**');
    await page.getByText('集群 logs_collector 基础组件已就绪，可发布服务采集配置').waitFor();
    assert.equal(await page.getByText('目标集群 ID“calico-test03-02”未登记；平台不会按名称自动改绑').count(), 0);
    assert.equal(await page.getByText('test03', { exact: true }).count() > 0, true);
  } finally {
    await browser?.close();
    await stop(frontend);
    await stop(api);
  }
});
