import test from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../../services/api.ts';

function response(data) {
  return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ success: true, data, error: null }) };
}

async function captureRequest(callApi, responseData = {}) {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, init = {}) => {
    requests.push({ path, init, body: init.body ? JSON.parse(init.body) : undefined });
    return response(responseData);
  };
  try {
    const result = await callApi();
    assert.equal(requests.length, 1);
    return { request: requests[0], result };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('读取服务部署目标并映射 host_set 生产真值', async () => {
  const { request, result } = await captureRequest(
    () => api.getServiceDeployments('product-1', 'service-1'),
    [{
      id: 'deployment-1', product_id: 'product-1', service_id: 'service-1',
      name: '华东二进制集群', kind: 'host_set', status: 'active', source: 'manual',
      allowed_log_roots: ['/data/logs', '/var/log/orders'],
      host_targets: [{
        id: 'host-1', identity_source: 'manual', identity_scope: 'global',
        external_id: 'cmdb-100', display_name: 'orders-01', hostname: 'orders-01.local',
        status: 'active', ip_addresses: ['10.0.0.8'],
      }],
    }],
  );
  assert.equal(request.path, '/api/v1/products/product-1/services/service-1/deployments');
  assert.equal(result[0].kind, 'host_set');
  assert.deepEqual(result[0].allowedLogRoots, ['/data/logs', '/var/log/orders']);
  assert.equal(result[0].hostTargets[0].id, 'host-1');
});

test('创建 host_set 部署时只提交主机部署字段', async () => {
  const { request } = await captureRequest(
    () => api.createServiceDeployment('product-1', 'service-1', {
      name: '华东二进制集群', kind: 'host_set', source: 'manual',
      allowedLogRoots: ['/data/logs'], hostIds: ['host-1', 'host-2'],
    }),
    { id: 'deployment-1', product_id: 'product-1', service_id: 'service-1', name: '华东二进制集群', kind: 'host_set' },
  );
  assert.equal(request.init.method, 'POST');
  assert.deepEqual(request.body, {
    name: '华东二进制集群', kind: 'host_set', source: 'manual',
    allowed_log_roots: ['/data/logs'],
  });
});

test('替换部署主机时提交稳定 HostAsset 身份', async () => {
  const { request } = await captureRequest(
    () => api.replaceServiceDeploymentHosts('product-1', 'service-1', 'deployment-1', ['host-1', 'host-2']),
    { id: 'deployment-1', product_id: 'product-1', service_id: 'service-1', name: '华东二进制集群', kind: 'host_set' },
  );
  assert.equal(request.init.method, 'PUT');
  assert.deepEqual(request.body, { host_asset_ids: ['host-1', 'host-2'] });
});

test('主机库 API 通过平台统一请求路径读取主机资产', async () => {
  const { request, result } = await captureRequest(
    () => api.getHostAssets({ q: 'orders', status: 'active' }),
    [{
      id: 'host-1', identity_source: 'manual', identity_scope: 'global',
      external_id: 'cmdb-100', display_name: 'orders-01', hostname: 'orders-01.local',
      status: 'active', ip_addresses: ['10.0.0.8'], region: 'cn-sh2', zone: 'cn-sh2-01',
      labels: { env: 'prod' },
    }],
  );
  assert.equal(request.path, '/api/v1/platform/hosts?q=orders&status=active');
  assert.equal(result[0].externalId, 'cmdb-100');
  assert.equal(result[0].identitySource, 'manual');
  assert.equal(result[0].identityScope, 'global');
  assert.equal(result[0].displayName, 'orders-01');
  assert.equal(result[0].hostname, 'orders-01.local');
  assert.deepEqual(result[0].ipAddresses, ['10.0.0.8']);
});

test('新增主机资产严格提交稳定外部身份与展示字段', async () => {
  const { request } = await captureRequest(
    () => api.createHostAsset({
      identitySource: 'manual',
      identityScope: 'global',
      externalId: 'asset-orders-01',
      displayName: '订单服务 01',
      hostname: 'orders-01.local',
      status: 'active',
      ipAddresses: ['10.0.0.8'],
      region: 'cn-sh2',
      zone: 'cn-sh2-01',
      labels: { env: 'prod' },
    }),
    {
      id: 'host-1', identity_source: 'manual', identity_scope: 'global',
      external_id: 'asset-orders-01', display_name: '订单服务 01', hostname: 'orders-01.local',
      status: 'active', ip_addresses: ['10.0.0.8'],
    },
  );
  assert.equal(request.path, '/api/v1/platform/hosts');
  assert.equal(request.init.method, 'POST');
  assert.deepEqual(request.body, {
    identity_source: 'manual',
    identity_scope: 'global',
    external_id: 'asset-orders-01',
    display_name: '订单服务 01',
    hostname: 'orders-01.local',
    status: 'active',
    ip_addresses: ['10.0.0.8'],
    region: 'cn-sh2',
    zone: 'cn-sh2-01',
    labels: { env: 'prod' },
  });
});

test('主机详情、受限字段更新和退役使用平台主机资源契约', async () => {
  const host = {
    id: 'host-1', identity_source: 'manual', identity_scope: 'global',
    external_id: 'asset-orders-01', display_name: '订单服务 01', hostname: 'orders-01.local',
    status: 'active', ip_addresses: ['10.0.0.8'],
  };
  const detail = await captureRequest(() => api.getHostAsset('host-1'), host);
  assert.equal(detail.request.path, '/api/v1/platform/hosts/host-1');

  const updated = await captureRequest(() => api.updateHostAsset('host-1', {
    displayName: '订单服务 A',
    hostname: 'orders-a.local',
    ipAddresses: ['10.0.0.9'],
    region: 'cn-sh2',
    zone: 'cn-sh2-02',
    labels: { env: 'prod' },
  }), { ...host, display_name: '订单服务 A' });
  assert.equal(updated.request.path, '/api/v1/platform/hosts/host-1');
  assert.equal(updated.request.init.method, 'PATCH');
  assert.deepEqual(updated.request.body, {
    display_name: '订单服务 A',
    hostname: 'orders-a.local',
    ip_addresses: ['10.0.0.9'],
    region: 'cn-sh2',
    zone: 'cn-sh2-02',
    labels: { env: 'prod' },
  });

  const retired = await captureRequest(() => api.retireHostAsset('host-1'), { ...host, status: 'retired' });
  assert.equal(retired.request.path, '/api/v1/platform/hosts/host-1/retire');
  assert.equal(retired.request.init.method, 'POST');
  assert.equal(retired.result.status, 'retired');
});

test('主机批量导入使用事务导入数组契约', async () => {
  const input = {
    identitySource: 'cmdb',
    identityScope: 'tenant-a',
    externalId: 'cmdb-100',
    displayName: '订单服务 01',
    hostname: 'orders-01.local',
    status: 'active',
    ipAddresses: ['10.0.0.8'],
    region: 'cn-sh2',
    zone: 'cn-sh2-01',
    labels: { env: 'prod' },
  };
  const { request, result } = await captureRequest(
    () => api.importHostAssets([input]),
    [{
      id: 'host-1', identity_source: 'cmdb', identity_scope: 'tenant-a',
      external_id: 'cmdb-100', display_name: '订单服务 01', hostname: 'orders-01.local',
      status: 'active', ip_addresses: ['10.0.0.8'],
    }],
  );
  assert.equal(request.path, '/api/v1/platform/hosts/import');
  assert.equal(request.init.method, 'POST');
  assert.deepEqual(request.body, {
    hosts: [{
      identity_source: 'cmdb',
      identity_scope: 'tenant-a',
      external_id: 'cmdb-100',
      display_name: '订单服务 01',
      hostname: 'orders-01.local',
      status: 'active',
      ip_addresses: ['10.0.0.8'],
      region: 'cn-sh2',
      zone: 'cn-sh2-01',
      labels: { env: 'prod' },
    }],
  });
  assert.equal(result[0].identityScope, 'tenant-a');
});

test('Collector 注册令牌与人工轮换凭据只从一次性响应字段读取', async () => {
  const installation = {
    id: 'installation-1',
    installation_id: 'installation-1',
    host_asset_id: 'host-1',
    agent_role: 'logs_agent',
    status: 'pending',
  };
  const enrollment = await captureRequest(
    () => api.issueCollectorEnrollmentToken('installation-1'),
    { installation, enrollment_token: 'enroll-once' },
  );
  assert.equal(enrollment.request.path, '/api/v1/collector/installations/installation-1/enrollment-token');
  assert.equal(enrollment.request.init.method, 'POST');
  assert.equal(enrollment.result.installation.installationId, 'installation-1');
  assert.equal(enrollment.result.token, 'enroll-once');
  assert.equal('expiresAt' in enrollment.result, false);

  const rotated = await captureRequest(
    () => api.rotateCollectorInstallationCredential('installation-1'),
    { installation: { ...installation, status: 'active' }, installation_credential: 'credential-once' },
  );
  assert.equal(rotated.request.path, '/api/v1/collector/installations/installation-1/rotate-credential');
  assert.equal(rotated.request.init.method, 'POST');
  assert.equal(rotated.result.installation.status, 'active');
  assert.equal(rotated.result.credential, 'credential-once');
});

test('Collector Installation 列表映射待注册、已注册和已吊销状态', async () => {
  const { request, result } = await captureRequest(
    () => api.getCollectorInstallations(),
    [
      {
        id: 'installation-pending',
        host_asset_id: 'host-1',
        agent_role: 'logs_agent',
        active: true,
        enrollment_state: 'pending',
      },
      {
        id: 'installation-active',
        host_asset_id: 'host-2',
        agent_role: 'logs_agent',
        active: true,
        enrollment_state: 'enrolled',
      },
      {
        id: 'installation-revoked',
        host_asset_id: 'host-3',
        agent_role: 'logs_agent',
        active: false,
        enrollment_state: 'enrolled',
        revoked_at: '2026-07-27T10:00:00Z',
      },
    ],
  );

  assert.equal(request.path, '/api/v1/collector/installations');
  assert.deepEqual(result.map((installation) => installation.status), ['pending', 'active', 'revoked']);
});
