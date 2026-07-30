import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const frontendPort = 3102;
const apiPort = 18082;
const baseURL = `http://127.0.0.1:${frontendPort}`;
const apiURL = `http://127.0.0.1:${apiPort}`;
const previewDir = fileURLToPath(new URL('../docs/design/previews/', import.meta.url));

const roles = Object.freeze([
  Object.freeze({ id: 'developer', path: '/k8s/clusters/prod-shanghai', expected: '控制面状态', accessText: '只读查看' }),
  Object.freeze({ id: 'maintainer', path: '/k8s/clusters/prod-shanghai', expected: '控制面状态', accessText: '允许命名空间维护' }),
  Object.freeze({ id: 'product-viewer', path: '/products', expected: '产品与服务' }),
  Object.freeze({ id: 'product-maintainer', path: '/products', expected: '产品与服务' }),
  Object.freeze({ id: 'platform-admin', path: '/platform/k8s-access-profiles', expected: '命名空间权限' }),
]);

const viewports = Object.freeze([
  Object.freeze({ id: 'wide', width: 1440, height: 900 }),
  Object.freeze({ id: 'standard', width: 1366, height: 768 }),
  Object.freeze({ id: 'narrow', width: 390, height: 844 }),
]);

function start(command, args, env = {}) {
  return spawn(command, args, {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

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

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
}

async function selectRole(role) {
  const response = await fetch(`${apiURL}/__role/${encodeURIComponent(role)}`);
  assert.equal(response.status, 204);
}

async function waitForAnimations(locator) {
  await locator.evaluate(async (element) => {
    const animations = element.getAnimations({ subtree: true });
    await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
  });
}

test('固定权限五种身份视图与集群接入响应式布局', { timeout: 120_000 }, async () => {
  await mkdir(previewDir, { recursive: true });
  const api = start(process.execPath, ['e2e/access-control-visual-fixture.mjs'], {
    NOVAAPM_VISUAL_FIXTURE_PORT: String(apiPort),
  });
  const frontend = start(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['exec', 'vite', '--', '--host', '127.0.0.1', '--port', String(frontendPort)],
    { NOVAAPM_API_PROXY_TARGET: apiURL },
  );
  let browser;
  try {
    await waitForURL(`${apiURL}/api/v1/auth/session`);
    await waitForURL(`${baseURL}/`);
    browser = await chromium.launch({ headless: true });

    for (const role of roles) {
      await selectRole(role.id);
      for (const viewport of viewports) {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        await page.goto(`${baseURL}${role.path}`);
        await page.getByText(role.expected, { exact: true }).first().waitFor();
        await waitForAnimations(page.locator('body'));
        if (role.accessText) {
          await page.getByText(role.accessText, { exact: true }).waitFor();
          const forbidden = role.id === 'developer' ? '允许命名空间维护' : '只读查看';
          assert.equal(await page.getByText(forbidden, { exact: true }).count(), 0);
        }
        if (role.id === 'product-viewer') {
          assert.equal(await page.getByRole('button', { name: '授权', exact: true }).count(), 0);
        }
        if (role.id === 'product-maintainer') {
          await page.getByRole('button', { name: '授权', exact: true }).first().waitFor();
        }
        if (role.id === 'platform-admin') {
          await page.getByRole('button', { name: '创建命名空间权限', exact: true }).waitFor();
        }
        const horizontalOverflow = await page.evaluate(() => (
          document.documentElement.scrollWidth > document.documentElement.clientWidth
        ));
        assert.equal(horizontalOverflow, false, `${role.id}/${viewport.id} 不应出现页面级横向溢出`);
        await page.screenshot({
          path: `${previewDir}/access-${role.id}-${viewport.id}.png`,
          fullPage: true,
        });
        await context.close();
      }
    }

    await selectRole('platform-admin');
    const emptyContext = await browser.newContext({ viewport: viewports[1] });
    const emptyPage = await emptyContext.newPage();
    await emptyPage.goto(`${baseURL}/k8s`);
    await emptyPage.getByText('暂无可访问集群', { exact: true }).waitFor();
    await waitForAnimations(emptyPage.locator('body'));
    await emptyPage.screenshot({
      path: `${previewDir}/access-platform-admin-k8s-empty.png`,
      fullPage: true,
    });
    await emptyContext.close();

    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await page.goto(`${baseURL}/platform/k8s-clusters`);
      await page.getByText('K8S 集群接入', { exact: true }).waitFor();
      await page.getByText('连接正常', { exact: true }).waitFor();
      await page.getByRole('button', { name: /打开凭据管理/ }).click();
      const dialog = page.getByRole('dialog', { name: /集群管理凭据/ });
      await dialog.waitFor();
      await dialog.getByText('已加密保存的版本', { exact: true }).waitFor();
      await waitForAnimations(dialog);
      const horizontalOverflow = await page.evaluate(() => (
        document.documentElement.scrollWidth > document.documentElement.clientWidth
      ));
      assert.equal(horizontalOverflow, false, `集群接入/${viewport.id} 不应出现页面级横向溢出`);
      await page.screenshot({
        path: `${previewDir}/access-k8s-clusters-${viewport.id}.png`,
        fullPage: true,
      });
      await context.close();
    }
  } finally {
    await browser?.close();
    await stop(frontend);
    await stop(api);
  }
});
