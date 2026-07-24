import { createServer } from 'node:http';

const port = Number(process.env.PORT || 18081);
const now = '2026-07-23T08:00:00Z';
const products = [
  {
    id: 'prd-commerce-01',
    key: 'commerce',
    name: '交易平台',
    description: '订单、支付与履约的统一观测边界',
    tenant: { account_id: '0', project_id: 42001 },
    status: 'active',
    created_at: now,
    updated_at: now,
  },
  {
    id: 'prd-growth-02',
    key: 'growth',
    name: '增长平台',
    description: '用户增长与营销服务',
    tenant: { account_id: '0', project_id: 42002 },
    status: 'active',
    created_at: now,
    updated_at: now,
  },
];
const services = {
  'prd-commerce-01': [
    {
      id: 'svc-checkout-01',
      product_id: 'prd-commerce-01',
      key: 'checkout',
      name: '结算服务',
      description: '稳定结算逻辑服务',
      owner_team: '交易 SRE',
      owner: 'checkout-oncall',
      source: 'manual',
      sync_status: 'local',
      status: 'active',
      created_at: now,
      updated_at: now,
    },
  ],
  'prd-growth-02': [],
};
const k8sClusters = [
  {
    id: 'calico-arm',
    name: 'calico-arm',
    status: 'active',
    access_mode: 'direct',
    read_only: false,
  },
  {
    id: 'test03',
    name: 'calico-test03-02',
    status: 'active',
    access_mode: 'direct',
    read_only: false,
  },
  {
    id: 'rocky9',
    name: 'rocky9只读',
    status: 'active',
    access_mode: 'direct',
    read_only: true,
  },
];
const k8sNamespaces = [
  {
    id: 'namespace-orders',
    cluster_id: 'test03',
    name: 'orders',
    status: 'active',
    phase: 'Active',
    updated_at: now,
  },
];
const k8sDeployments = [
  {
    identity: {
      cluster_id: 'test03',
      namespace: 'orders',
      api_version: 'apps/v1',
      kind: 'Deployment',
      name: 'orders-api',
      uid: 'deployment-orders-api',
    },
    status: 'ready',
    labels: { app: 'orders-api' },
    updated_at: now,
  },
];
function envelope(data, meta = {}) {
  return { success: true, data, error: null, meta };
}

function integration(productId) {
  const product = products.find((item) => item.id === productId);
  return {
    product_id: productId,
    state: 'ready',
    folder: { uid: `np-${productId}`, title: product?.name || productId, state: 'ready' },
    datasources: productId === 'prd-commerce-01' ? [
      {
        endpoint_id: 'vl-prod',
        endpoint_name: 'VictoriaLogs 生产集群',
        uid: 'np-vl-commerce-prod',
        name: 'NovaAPM / 交易平台 / VictoriaLogs 生产集群',
        url: 'http://victorialogs:9428',
        state: 'ready',
        health: 'healthy',
        last_error: '',
        last_checked_at: now,
      },
    ] : [],
    last_error: '',
    attempts: 0,
    last_reconciled_at: now,
    updated_at: now,
  };
}

function json(response, status, data) {
  const body = JSON.stringify(data);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  response.end(body);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);
  const path = url.pathname.replace(/^\/api\/v1/, '');
  if (path === '/health') return json(response, 200, envelope({ status: 'ok' }));
  if (path === '/auth/session') {
    return json(response, 200, envelope({
      subject: { id: 'e2e-admin', type: 'user', display_name: '目录验收管理员' },
      expires_at: '2026-07-24T08:00:00Z',
    }));
  }
  if (path === '/k8s/clusters' && request.method === 'GET') {
    return json(response, 200, envelope(k8sClusters, { total: k8sClusters.length }));
  }
  if (path === '/k8s/namespaces' && request.method === 'GET') {
    const clusterId = url.searchParams.get('cluster_id') || '';
    const items = k8sNamespaces.filter((item) => item.cluster_id === clusterId);
    return json(response, 200, envelope(items, { total: items.length }));
  }
  if (path === '/k8s/resources' && request.method === 'GET') {
    const clusterId = url.searchParams.get('cluster_id') || '';
    const namespace = url.searchParams.get('namespace') || '';
    const kind = url.searchParams.get('kind') || '';
    const items = k8sDeployments.filter((item) => (
      item.identity.cluster_id === clusterId
      && item.identity.namespace === namespace
      && (!kind || item.identity.kind === kind)
    ));
    return json(response, 200, envelope(items, { total: items.length }));
  }
  if (path === '/observability/runtimes/logs-collector/status' && request.method === 'GET') {
    const clusterId = url.searchParams.get('cluster_id') || '';
    const namespace = url.searchParams.get('namespace') || 'novaapm-system';
    return json(response, 200, envelope({
      cluster_id: clusterId,
      namespace,
      ready: clusterId === 'test03',
      status: clusterId === 'test03' ? 'ready' : 'missing_resources',
      message: clusterId === 'test03'
        ? '集群 logs_collector 基础组件已就绪，可发布服务采集配置'
        : 'logs_collector 基础组件缺失',
      resources: [],
      missing_resources: [],
    }));
  }
  if (path === '/products' && request.method === 'GET') {
    return json(response, 200, envelope(products, { total: products.length }));
  }
  if (path === '/products' && request.method === 'POST') {
    const input = await readBody(request);
    const product = {
      id: `prd-${String(input.key || 'new')}-03`,
      key: String(input.key || ''),
      name: String(input.name || ''),
      description: String(input.description || ''),
      tenant: { account_id: '0', project_id: 42003 },
      status: 'active',
      created_at: now,
      updated_at: now,
    };
    products.push(product);
    services[product.id] = [];
    return json(response, 201, envelope(product));
  }

  const integrationMatch = path.match(/^\/products\/([^/]+)\/integrations\/grafana(?:\/reconcile)?$/);
  if (integrationMatch) return json(response, 200, envelope(integration(decodeURIComponent(integrationMatch[1]))));

  const graphMatch = path.match(/^\/products\/([^/]+)\/services\/([^/]+)\/observability-graph$/);
  if (graphMatch) {
    const serviceId = decodeURIComponent(graphMatch[2]);
    const productId = decodeURIComponent(graphMatch[1]);
    const service = (services[productId] || []).find((item) => item.id === serviceId);
    return json(response, 200, envelope({
      service,
      agents: [],
      log_routes: {
        total: 1,
        routes: [{
          route: {
            id: 'route-checkout-prod',
            source_type: 'k8s_stdout',
            endpoint_id: 'vl-prod',
            status: 'ready',
            last_publish_status: 'published',
          },
          endpoint: { id: 'vl-prod', name: 'VictoriaLogs 生产集群', sink_type: 'vl' },
        }],
      },
      alert_rules: [],
    }));
  }

  const serviceMatch = path.match(/^\/products\/([^/]+)\/services\/([^/]+)$/);
  if (serviceMatch) {
    const productId = decodeURIComponent(serviceMatch[1]);
    const serviceId = decodeURIComponent(serviceMatch[2]);
    const service = (services[productId] || []).find((item) => item.id === serviceId);
    return json(response, service ? 200 : 404, service ? envelope(service) : {
      success: false, data: null, error: { code: 'not_found', message: '服务不存在' }, meta: {},
    });
  }

  const productServicesMatch = path.match(/^\/products\/([^/]+)\/services$/);
  if (productServicesMatch && request.method === 'GET') {
    const productId = decodeURIComponent(productServicesMatch[1]);
    return json(response, 200, envelope(services[productId] || []));
  }

  const k8sImportMatch = path.match(/^\/products\/([^/]+)\/services\/imports\/k8s$/);
  if (k8sImportMatch && request.method === 'POST') {
    const productId = decodeURIComponent(k8sImportMatch[1]);
    const input = await readBody(request);
    const deployment = k8sDeployments.find((item) => (
      item.identity.cluster_id === input.cluster_id
      && item.identity.namespace === input.namespace
      && item.identity.name === input.deployment_name
      && item.identity.uid === input.deployment_uid
    ));
    if (!deployment) {
      return json(response, 404, {
        success: false,
        data: null,
        error: { code: 'k8s_deployment_not_found', message: 'Deployment 不存在或已被重建' },
        meta: {},
      });
    }
    const service = {
      id: `svc-${deployment.identity.name}-02`,
      product_id: productId,
      key: deployment.identity.name,
      name: deployment.identity.name,
      description: '',
      source: 'k8s',
      sync_status: 'local',
      status: 'active',
      created_at: now,
      updated_at: now,
    };
    services[productId] = [...(services[productId] || []), service];
    return json(response, 201, envelope(service));
  }

  const productMatch = path.match(/^\/products\/([^/]+)$/);
  if (productMatch) {
    const product = products.find((item) => item.id === decodeURIComponent(productMatch[1]));
    return json(response, product ? 200 : 404, product ? envelope(product) : {
      success: false, data: null, error: { code: 'not_found', message: '产品不存在' }, meta: {},
    });
  }

  return json(response, 200, envelope([]));
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`mock-catalog-api:${port}\n`);
});
