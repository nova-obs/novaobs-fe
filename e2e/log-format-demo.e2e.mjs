import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const frontendPort = 3103;
const apiPort = 18083;
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

test('日志格式改造洽谈 Demo 支持现场编辑、校验和响应式展示', { timeout: 60_000 }, async () => {
  await mkdir(previewDir, { recursive: true });
  const api = start(process.execPath, ['e2e/mock-catalog-api.mjs'], { PORT: String(apiPort) });
  const frontend = start(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['exec', 'vite', '--', '--host', '127.0.0.1', '--port', String(frontendPort)],
    { NOVAAPM_API_PROXY_TARGET: `http://127.0.0.1:${apiPort}` },
  );
  let browser;
  try {
    await waitForURL(`${baseURL}/logs/format-demo`);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${baseURL}/logs/format-demo`);
    await page.getByRole('heading', { name: '日志格式改造' }).waitFor();
    await assert.doesNotReject(() => page.getByText('业务格式已满足').waitFor());
    await page.getByRole('button', { name: '收起模块导航' }).click();
    await page.screenshot({ path: `${previewDir}/logs-format-demo-wide.png`, fullPage: true, animations: 'disabled' });

    await page.getByLabel('选择业务现状样例').selectOption('legacy-json');
    await assert.doesNotReject(() => page.getByText('可联调，仍有建议项').waitFor());
    await page.getByLabel('业务输出建议 JSON').fill('{"level":"info"}');
    await assert.doesNotReject(() => page.getByText('需先完成阻断项').waitFor());
    await assert.doesNotReject(() => page.locator('tr').filter({ hasText: 'message' }).getByText('未提供').waitFor());
    assert.equal(await page.getByRole('button', { name: '复制单行 JSON' }).isDisabled(), true);
    await page.getByLabel('业务输出建议 JSON').fill('{"level":"info","message":"login success","accessToken":"secret-value"}');
    await assert.doesNotReject(() => page.getByRole('alert').getByText(/accessToken/).waitFor());
    assert.equal(await page.getByRole('button', { name: '复制单行 JSON' }).isDisabled(), true);

    await page.getByLabel('选择业务现状样例').selectOption('standard-json');
    await assert.doesNotReject(() => page.getByText('业务格式已满足').waitFor());
    assert.equal(await page.getByRole('button', { name: '复制单行 JSON' }).isEnabled(), true);
    await page.getByRole('tab', { name: '字段责任与校验' }).focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.getByRole('tab', { name: '推荐业务 JSON' }).getAttribute('aria-selected'), 'true');
    await page.keyboard.press('End');
    assert.equal(await page.getByRole('tab', { name: '平台补齐后目标' }).getAttribute('aria-selected'), 'true');
    await assert.doesNotReject(() => page.getByText('"service.name": "checkout"').waitFor());

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.screenshot({ path: `${previewDir}/logs-format-demo-1366.png`, fullPage: true, animations: 'disabled' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.logs-format-demo').evaluate((element) => element.scrollTo({ top: element.scrollHeight, left: 0 }));
    await assert.doesNotReject(() => page.getByRole('tab', { name: '平台补齐后目标' }).waitFor());
    const overflowChecks = await page.evaluate(() => {
      const entries = [
        ['html', document.documentElement],
        ['body', document.body],
        ['content', document.querySelector('.content-workbench-body')],
        ['outlet', document.querySelector('.module-workbench-outlet')],
        ['demo', document.querySelector('.logs-format-demo')],
      ];
      return entries.flatMap(([name, element]) => element ? [{
        name,
        overflow: element.scrollWidth - element.clientWidth,
        scrollLeft: element.scrollLeft,
      }] : []);
    });
    overflowChecks.forEach((item) => {
      assert.ok(item.overflow <= 1, `${item.name} 发生 ${item.overflow}px 横向溢出`);
      assert.equal(item.scrollLeft, 0, `${item.name} 被横向滚动`);
    });
    await page.locator('.logs-format-demo').evaluate((element) => element.scrollTo({ top: 0, left: 0 }));
    await page.getByRole('tablist', { name: '格式评估结果' }).evaluate((element) => element.scrollTo({ left: 0 }));
    await page.screenshot({ path: `${previewDir}/logs-format-demo-narrow.png`, fullPage: true, animations: 'disabled' });
  } finally {
    await browser?.close();
    await stop(frontend);
    await stop(api);
  }
});
