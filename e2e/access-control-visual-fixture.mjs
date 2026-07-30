import http from 'node:http';

const port = Number(process.env.NOVAAPM_VISUAL_FIXTURE_PORT || 18080);
let activeRole = 'developer';

const roles = Object.freeze({
  developer: Object.freeze({
    subject: { id: 'developer-chen', type: 'user', display_name: '开发工程师 陈晨' },
    group_ids: ['commerce-developers'],
    available_modules: ['workspace', 'observability', 'k8s'],
    platform_admin: false,
    product_accesses: [],
    k8s_profiles: [{
      profile_id: 'profile-commerce-dev',
      name: '交易开发只读',
      cluster_id: 'prod-shanghai',
      access_level: 'developer',
      namespaces: ['commerce'],
      impersonation_group: 'novaapm:profile:profile-commerce-dev',
      status: 'active',
      drift_state: 'in_sync',
    }],
    modules: { workspace: 'read', k8s: 'read' },
  }),
  maintainer: Object.freeze({
    subject: { id: 'lead-li', type: 'user', display_name: '开发组长 李岚' },
    group_ids: ['commerce-maintainers'],
    available_modules: ['workspace', 'observability', 'k8s'],
    platform_admin: false,
    product_accesses: [],
    k8s_profiles: [{
      profile_id: 'profile-commerce-maintainer',
      name: '交易 Namespace 维护',
      cluster_id: 'prod-shanghai',
      access_level: 'namespace-maintainer',
      namespaces: ['commerce', 'commerce-test'],
      impersonation_group: 'novaapm:profile:profile-commerce-maintainer',
      status: 'active',
      drift_state: 'in_sync',
    }],
    modules: { workspace: 'read', k8s: 'manage' },
  }),
  'product-viewer': Object.freeze({
    subject: { id: 'viewer-wang', type: 'user', display_name: '产品观察者 王维' },
    group_ids: ['commerce-viewers'],
    available_modules: ['workspace', 'observability', 'k8s'],
    platform_admin: false,
    product_accesses: [{ product_id: 'product-commerce', product_name: '交易平台', role: 'product-viewer' }],
    k8s_profiles: [],
    modules: {
      workspace: 'read',
      products: 'read',
      observability: 'read',
      logs: 'read',
      metrics: 'read',
      alerts: 'read',
    },
  }),
  'product-maintainer': Object.freeze({
    subject: { id: 'owner-zhao', type: 'user', display_name: '产品维护者 赵哲' },
    group_ids: ['commerce-owners'],
    available_modules: ['workspace', 'observability', 'k8s'],
    platform_admin: false,
    product_accesses: [{ product_id: 'product-commerce', product_name: '交易平台', role: 'product-maintainer' }],
    k8s_profiles: [],
    modules: {
      workspace: 'read',
      products: 'manage',
      observability: 'manage',
      logs: 'manage',
      metrics: 'manage',
      alerts: 'manage',
    },
  }),
  'platform-admin': Object.freeze({
    subject: { id: 'platform-admin', type: 'user', display_name: '平台管理员' },
    group_ids: ['platform-owners'],
    available_modules: ['workspace', 'observability', 'k8s'],
    platform_admin: true,
    product_accesses: [],
    k8s_profiles: [],
    modules: { workspace: 'read', platform: 'manage' },
  }),
});

const products = Object.freeze([{
  id: 'product-commerce',
  key: 'commerce',
  name: '交易平台',
  description: '订单、支付和结算服务',
  project_id: 'commerce',
  status: 'active',
  created_at: '2026-07-20T08:00:00Z',
  updated_at: '2026-07-29T08:00:00Z',
}]);

const services = Object.freeze([{
  id: 'service-orders',
  product_id: 'product-commerce',
  key: 'orders-api',
  name: '订单服务',
  description: '核心订单 API',
  source: 'manual',
  status: 'active',
  owner_team: '交易研发',
  created_at: '2026-07-20T08:00:00Z',
  updated_at: '2026-07-29T08:00:00Z',
}, {
  id: 'service-payments',
  product_id: 'product-commerce',
  key: 'payments-api',
  name: '支付服务',
  description: '支付与退款处理',
  source: 'k8s',
  status: 'active',
  owner_team: '交易研发',
  created_at: '2026-07-20T08:00:00Z',
  updated_at: '2026-07-29T08:00:00Z',
}]);

const clusters = Object.freeze([{
  id: 'prod-shanghai',
  name: '生产集群 · 上海',
  version: 'v1.31.4',
  region: 'cn-sh2',
  description: '交易业务生产集群',
  status: 'healthy',
  access_mode: 'impersonation-broker',
  read_only: false,
  last_probe: {
    status: 'connected',
    server_version: 'v1.31.4',
    resource_count: 48,
    warnings: [],
    checked_at: '2026-07-29T08:00:00Z',
  },
}]);

function envelope(data) {
  return { success: true, data, error: null, meta: {} };
}

function dashboard() {
  return {
    stats: {
      health: 'healthy',
      workloads: 18,
      namespaces: activeRole === 'maintainer' ? 2 : 1,
      pods: { ready: 42, total: 43, warning: 1 },
    },
    signals: [{
      key: 'api-server',
      label: 'API Server',
      source: 'Kubernetes API',
      status: 'healthy',
      checked_at: '2026-07-29T08:00:00Z',
    }],
    sync: {
      source: 'Impersonation Broker',
      status: 'in_sync',
      checked_at: '2026-07-29T08:00:00Z',
    },
  };
}

function routeData(pathname) {
  const role = roles[activeRole] || roles.developer;
  if (pathname === '/api/v1/auth/session') {
    return { subject: role.subject, expires_at: '2026-07-29T18:00:00Z' };
  }
  if (pathname === '/api/v1/platform/me') return role;
  if (pathname === '/api/v1/products') return products;
  if (pathname === '/api/v1/platform/catalog/products') return products;
  if (pathname === '/api/v1/products/product-commerce/services') return services;
  if (pathname === '/api/v1/k8s/clusters') return role.k8s_profiles.length > 0 ? clusters : [];
  if (pathname === '/api/v1/platform/k8s/clusters') return clusters;
  if (pathname === '/api/v1/platform/k8s/namespace-impacts') {
    return [{
      cluster_id: 'prod-shanghai',
      namespace: 'commerce',
      product_id: 'product-commerce',
      product_name: '交易平台',
      service_id: 'service-orders',
      service_name: '订单服务',
      deployment_id: 'deployment-orders',
      deployment_name: '订单生产',
      workload_kind: 'Deployment',
      workload_name: 'orders-api',
    }];
  }
  if (pathname === '/api/v1/k8sops/dashboard') return dashboard();
  if (pathname === '/api/v1/platform/users') {
    return [
      { id: 'platform-admin', username: 'platform-admin', display_name: '平台管理员', email: 'platform@example.com', status: 'active', source: 'local' },
      { id: 'owner-zhao', username: 'owner-zhao', display_name: '产品维护者 赵哲', email: 'owner@example.com', status: 'active', source: 'oidc' },
    ];
  }
  if (pathname === '/api/v1/platform/groups') {
    return [
      { id: 'commerce-viewers', name: 'commerce-viewers', display_name: '交易平台观察者', status: 'active' },
      { id: 'commerce-maintainers', name: 'commerce-maintainers', display_name: '交易 Namespace 维护者', status: 'active' },
    ];
  }
  if (pathname === '/api/v1/platform/group-memberships') return [];
  if (pathname === '/api/v1/platform/admin-grants') {
    return [{ id: 'admin:user:platform-admin', subject_type: 'user', subject_id: 'platform-admin', created_by: 'bootstrap', created_at: '2026-07-20T08:00:00Z' }];
  }
  if (pathname === '/api/v1/products/product-commerce/access-grants') {
    return [
      { id: 'grant-commerce-viewers', product_id: 'product-commerce', group_id: 'commerce-viewers', role: 'product-viewer', created_by: 'platform-admin', created_at: '2026-07-20T08:00:00Z' },
      { id: 'grant-commerce-owners', product_id: 'product-commerce', group_id: 'commerce-owners', role: 'product-maintainer', created_by: 'platform-admin', created_at: '2026-07-20T08:00:00Z' },
    ];
  }
  if (pathname === '/api/v1/products/product-commerce/access-groups') {
    return [
      { group_id: 'commerce-viewers', display_name: '交易平台观察者' },
      { group_id: 'commerce-owners', display_name: '交易平台维护者' },
    ];
  }
  if (pathname === '/api/v1/k8s/access-profiles') {
    return [
      roles.developer.k8s_profiles[0],
      roles.maintainer.k8s_profiles[0],
    ];
  }
  if (pathname === '/api/v1/k8s/access-grants') {
    return [
      { id: 'k8s-grant-dev', group_id: 'commerce-developers', profile_id: 'profile-commerce-dev', created_by: 'platform-admin', created_at: '2026-07-20T08:00:00Z' },
      { id: 'k8s-grant-maintainer', group_id: 'commerce-maintainers', profile_id: 'profile-commerce-maintainer', created_by: 'platform-admin', created_at: '2026-07-20T08:00:00Z' },
    ];
  }
  if (pathname === '/api/v1/k8s/break-glass-grants') return [];
  if (pathname === '/api/v1/k8s/audit-events') return [];
  if (pathname === '/api/v1/k8s/resources') return [];
  if (pathname === '/api/v1/k8s/namespaces') {
    return (role.k8s_profiles[0]?.namespaces || []).map((namespace) => ({
      id: `prod-shanghai:${namespace}`,
      cluster_id: 'prod-shanghai',
      name: namespace,
      status: 'active',
      phase: 'Active',
      owner: 'profile',
      updated_at: '2026-07-29T08:00:00Z',
    }));
  }
  return [];
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);
  if (url.pathname.startsWith('/__role/')) {
    const role = decodeURIComponent(url.pathname.slice('/__role/'.length));
    if (!Object.hasOwn(roles, role)) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('unknown role');
      return;
    }
    activeRole = role;
    response.writeHead(204, { 'Cache-Control': 'no-store' });
    response.end();
    return;
  }
  response.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(envelope(routeData(url.pathname))));
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`NovaAPM access visual fixture listening on http://127.0.0.1:${port}\n`);
});
