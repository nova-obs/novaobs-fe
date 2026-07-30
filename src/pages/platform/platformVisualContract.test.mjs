import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pageSource = [
  './PlatformAccessAdminPage.tsx',
  './PlatformAccessWorkspaces.tsx',
  './PlatformAccessForms.tsx',
  './platformNavigation.ts',
].map((file) => readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n');
const apiSource = readFileSync(new URL('./accessApi.ts', import.meta.url), 'utf8');

test('平台访问控制只呈现固定授权工作台', () => {
  assert.equal(pageSource.includes('platformAccessNavigationItems'), true);
  assert.equal(pageSource.includes("section: 'identities'"), true);
  assert.equal(pageSource.includes("section: 'platform-admins'"), true);
  assert.equal(pageSource.includes("section: 'product-access'"), true);
  assert.equal(pageSource.includes("section: 'k8s-profiles'"), true);
  assert.equal(pageSource.includes("section: 'break-glass'"), true);
  assert.equal(pageSource.includes('用户与用户组'), true);
  assert.equal(pageSource.includes('平台管理员'), true);
  assert.equal(pageSource.includes('产品授权'), true);
  assert.equal(pageSource.includes('命名空间权限'), true);
  assert.equal(pageSource.includes('紧急访问与审计'), true);
  assert.equal(pageSource.includes('AccessTabNav'), false);
  assert.equal(pageSource.includes('platform-access-tabs'), false);
  assert.equal(pageSource.includes('grid min-w-0'), true);
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
