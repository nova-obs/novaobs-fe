import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dialogSource = readFileSync(new URL('./LogsParseRuleDialog.tsx', import.meta.url), 'utf8');
const apiSource = readFileSync(new URL('./api.ts', import.meta.url), 'utf8');
const onboardingSource = readFileSync(new URL('./LogsOnboardingPage.tsx', import.meta.url), 'utf8');

test('日志路由提供 novaapm-json-v1 的 OTel JSON 解析模式', () => {
  assert.match(dialogSource, /'otel_json'/);
  assert.match(dialogSource, /value="otel_json"/);
  assert.match(dialogSource, /OTel JSON/);
  assert.match(dialogSource, /novaapm-json-v1/);
  assert.match(dialogSource, /parserDraftMode === 'regex'/);
  assert.match(apiSource, /'regex'\s*\|\s*'json'\s*\|\s*'otel_json'/);
  assert.match(onboardingSource, /OTel JSON/);
});
