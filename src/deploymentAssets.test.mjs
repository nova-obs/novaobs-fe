import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('生产镜像使用多阶段构建并由非 root Nginx 提供服务', async () => {
  const dockerfile = await readFile('Dockerfile', 'utf8');

  assert.match(dockerfile, /FROM node:.* AS builder/);
  assert.match(dockerfile, /npm ci/);
  assert.match(dockerfile, /npm run build/);
  assert.match(dockerfile, /FROM nginx:/);
  assert.match(dockerfile, /USER 101/);
});

test('Nginx 支持 SPA 回退、健康检查和后端同源代理', async () => {
  const config = await readFile('nginx.conf', 'utf8');

  assert.match(config, /listen 8080/);
  assert.match(config, /location = \/healthz/);
  assert.match(config, /try_files \$uri \$uri\/ \/index\.html/);
  assert.match(config, /location \/api\//);
  assert.match(config, /proxy_pass http:\/\/novaapm-backend:8080;/);
  assert.match(config, /location \/v1\/opamp/);
  assert.match(config, /proxy_set_header Upgrade \$http_upgrade/);
  assert.match(config, /proxy_set_header Connection \$connection_upgrade/);
	assert.match(config, /location \/grafana\//);
	assert.match(config, /proxy_buffering off/);
	assert.match(config, /log_format novaapm[^;]*\$request_method \$uri \$server_protocol/s);
	assert.doesNotMatch(config, /access_log \/dev\/stdout;/);
	assert.match(config, /map \$http_x_forwarded_proto \$novaapm_forwarded_proto/);
	assert.match(config, /proxy_set_header X-Forwarded-Proto \$novaapm_forwarded_proto/);
	assert.equal(
		[...config.matchAll(/proxy_set_header Host \$http_host;/g)].length,
		3,
		'所有同源代理都必须保留浏览器访问端口，避免 Grafana Live 的 Origin 校验误判',
	);
	assert.doesNotMatch(config, /proxy_set_header Host \$host;/);
});

test('Vite 本地开发代理转发 Grafana HTTP 和 Live WebSocket', async () => {
	const config = await readFile('vite.config.ts', 'utf8');

	assert.match(config, /'\/grafana':\s*\{[\s\S]*?target:\s*'http:\/\/127\.0\.0\.1:8080'/);
	assert.match(config, /'\/grafana':\s*\{[\s\S]*?changeOrigin:\s*false/);
	assert.match(config, /'\/grafana':\s*\{[\s\S]*?ws:\s*true/);
});

test('Makefile 默认构建 linux amd64 前端镜像并支持直接推送', async () => {
  const makefile = await readFile('Makefile', 'utf8');

  assert.match(makefile, /PLATFORM \?= linux\/amd64/);
  assert.match(makefile, /IMAGE_NAME \?= novaapm-frontend/);
  assert.match(makefile, /docker-build:[\s\S]*buildx build[\s\S]*--platform \$\(PLATFORM\)[\s\S]*--load/);
  assert.match(makefile, /docker-build-push:[\s\S]*buildx build[\s\S]*--platform \$\(PLATFORM\)[\s\S]*--push/);
});
