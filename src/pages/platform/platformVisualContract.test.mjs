import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pageSource = [
  './PlatformAccessAdminPage.tsx',
  './PlatformAccessWorkspaces.tsx',
  './PlatformAccessForms.tsx',
  './PlatformGroupDetailPage.tsx',
  './identityValidation.ts',
  './platformNavigation.ts',
].map((file) => readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n');
const apiSource = readFileSync(new URL('./accessApi.ts', import.meta.url), 'utf8');
const adminSource = readFileSync(new URL('./PlatformAccessAdminPage.tsx', import.meta.url), 'utf8');
const workspaceSource = readFileSync(new URL('./PlatformAccessWorkspaces.tsx', import.meta.url), 'utf8');
const formSource = readFileSync(new URL('./PlatformAccessForms.tsx', import.meta.url), 'utf8');
const navigationSource = readFileSync(new URL('./platformNavigation.ts', import.meta.url), 'utf8');

test('平台访问控制只呈现固定授权工作台', () => {
  assert.equal(pageSource.includes('platformAccessNavigationItems'), true);
  assert.equal(pageSource.includes("section: 'identities'"), true);
  assert.equal(pageSource.includes("section: 'platform-admins'"), true);
  assert.equal(pageSource.includes("section: 'product-access'"), true);
  assert.equal(pageSource.includes("section: 'k8s-profiles'"), true);
  assert.equal(pageSource.includes("section: 'break-glass'"), true);
  assert.equal(pageSource.includes('用户与用户组'), true);
  for (const label of ['平台管理员授权', '产品访问授权', 'K8s 集群授权', 'K8s 紧急访问']) {
    assert.equal(navigationSource.includes(`label: '${label}'`), true);
    assert.equal(workspaceSource.includes(`title="${label}"`), true);
  }
  assert.equal(pageSource.includes('AccessTabNav'), false);
  assert.equal(pageSource.includes('platform-access-tabs'), false);
  assert.equal(pageSource.includes('grid min-w-0'), true);
});

test('平台授权帮助文案统一使用 K8s 与产品术语', () => {
  assert.equal(workspaceSource.includes('K8S'), false);
  assert.equal(formSource.includes('K8S'), false);
  assert.equal(workspaceSource.includes('Product 数据'), false);
  assert.equal(formSource.includes('Product 数据'), false);
});

test('平台产品访问授权直接展示并维护授权关系', () => {
  assert.equal(apiSource.includes('listProductAccessGrantsForAdministration'), true);
  assert.equal(adminSource.includes("['fixed-access', 'product-grants', 'administration']"), true);
  assert.equal(workspaceSource.includes("headers={['产品', '权限等级', '生效范围', '已授权', '最近更新', '操作']}"), true);
  assert.equal(workspaceSource.includes('产品下全部服务'), true);
  assert.equal(workspaceSource.includes('onEdit'), true);
  assert.equal(workspaceSource.includes('onDelete'), true);
  assert.equal(workspaceSource.includes('管理产品授权'), false);
  assert.equal(workspaceSource.includes('/products/${encodeURIComponent(product.id)}/access'), false);
  assert.equal(pageSource.includes('/products/${encodeURIComponent(grant.productId)}/access'), false);
});

test('产品访问授权按产品折叠，用户组收在子行', () => {
  assert.equal(workspaceSource.includes('buildProductAccessRows'), true);
  assert.equal(workspaceSource.includes('expandedProductIds'), true);
  assert.equal(workspaceSource.includes('toggleProduct'), true);
  assert.equal(workspaceSource.includes('data-product-id={row.productId}'), true);
  assert.equal(workspaceSource.includes('的已授权用户组'), true);
  assert.equal(workspaceSource.includes('{row.grants.length} 个用户组'), true);
  // 产品目录里已删除的 productId 仍要成行，否则残留授权无法撤销。
  assert.equal(workspaceSource.includes("product?.name || '未知产品'"), true);
  assert.equal(adminSource.includes('onCreate={(productId) =>'), true);
});

test('平台访问控制不再提供自由角色、权限字符串和 ScopeMode UI', () => {
  assert.equal(pageSource.includes('PlatformRole'), false);
  assert.equal(pageSource.includes('PlatformPermission'), false);
  assert.equal(pageSource.includes('PlatformBinding'), false);
  assert.equal(pageSource.includes('rolePermissions'), false);
  assert.equal(pageSource.includes('scopeMode'), false);
  assert.equal(pageSource.includes('有效权限'), false);
  assert.equal(pageSource.includes('创建角色'), false);
  assert.equal(pageSource.includes('创建授权绑定'), false);
  assert.equal(pageSource.includes('权限字符串'), false);
});

test('用户与用户组表单对齐稳定标识规则并在抽屉内反馈错误', () => {
  assert.equal(pageSource.includes('用户组标识'), true);
  assert.equal(pageSource.includes('用户名'), true);
  assert.equal(pageSource.includes('identityIdentifierError'), true);
  assert.equal(pageSource.includes('error={createIdentity.error}'), true);
  assert.equal(pageSource.includes('role="alert"'), true);
});

test('用户只保留用户名且成员标识列展示邮箱', () => {
  assert.equal(pageSource.includes("kind === 'group' &&"), true);
  assert.equal(pageSource.includes('user.displayName'), false);
  assert.equal(pageSource.includes('userDisplayName'), false);
  assert.equal(pageSource.includes("searchPlaceholder=\"搜索用户名、邮箱\""), true);
  assert.equal(pageSource.includes("headers={['用户', '邮箱', '操作']}"), true);
  assert.equal(pageSource.includes('emailsById.get(membership.userId)'), true);
});

test('身份创建请求提交期间保持表单和 mutation 状态锁定', () => {
  assert.equal(pageSource.includes('disabled={pending}'), true);
  const guardedResetCount = pageSource.match(/!createIdentity\.isPending\) createIdentity\.reset\(\)/g)?.length ?? 0;
  assert.equal(guardedResetCount, 3);
  assert.equal(pageSource.includes("if (activeEditor === 'identity') createIdentity.reset();"), false);
});

test('命名空间权限明示整命名空间风险并要求确认真实影响边界', () => {
  assert.equal(pageSource.includes('<HelpTip'), true);
  assert.equal(pageSource.includes('开发只读'), true);
  assert.equal(pageSource.includes('命名空间维护'), true);
  assert.equal(pageSource.includes('整命名空间风险确认'), true);
  assert.equal(pageSource.includes('关联产品与服务'), true);
  assert.equal(pageSource.includes('关联的服务部署关系'), true);
  assert.equal(apiSource.includes('/platform/k8s/namespace-impacts'), true);
  assert.equal(pageSource.includes('wholeNamespaceConfirmed'), true);
  assert.equal(apiSource.includes('whole_namespace_confirmed'), true);
  assert.equal(pageSource.includes('禁止使用空命名空间、* 或全局范围'), true);
  assert.equal(pageSource.includes('onEditProfile'), true);
  assert.equal(pageSource.includes('updateK8sAccessProfile'), true);
  assert.equal(pageSource.includes('保存命名空间权限'), true);
  assert.equal(pageSource.includes("profile.status === 'active'"), true);
  assert.equal(pageSource.includes('请先下发至少一条命名空间权限'), true);
});

test('Break Glass 强调双人审批、两小时上限和审计入口', () => {
  assert.equal(pageSource.includes('另一名平台管理员审批'), true);
  assert.equal(pageSource.includes('最长 120 分钟'), true);
  assert.equal(pageSource.includes('/audit'), true);
  assert.equal(pageSource.includes('终端输出'), true);
});
