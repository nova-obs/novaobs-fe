import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const appRoot = resolve(import.meta.dirname, '../..');

test('浏览器标签页图标使用 NovaObs 设计系统主色', () => {
  const indexHtml = readFileSync(resolve(appRoot, 'index.html'), 'utf8');
  const faviconPath = resolve(appRoot, 'public/favicon.svg');

  assert.match(indexHtml, /<link\s+rel="icon"\s+href="\/favicon\.svg"\s+type="image\/svg\+xml"\s*\/>/);
  assert.equal(existsSync(faviconPath), true);

  const faviconSvg = readFileSync(faviconPath, 'utf8');

  assert.match(faviconSvg, /viewBox="0 0 32 32"/);
  assert.match(faviconSvg, /#0d5bd7/i);
  assert.doesNotMatch(faviconSvg, /#1f7a76/i);
});
