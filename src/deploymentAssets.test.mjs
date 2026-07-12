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
});
