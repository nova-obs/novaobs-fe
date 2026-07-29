import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pageSource = [
  './PlatformAccessAdminPage.tsx',
  './PlatformAccessWorkspaces.tsx',
  './PlatformAccessForms.tsx',
].map((file) => readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n');
const apiSource = readFileSync(new URL('./accessApi.ts', import.meta.url), 'utf8');

test('平台访问控制只呈现固定授权工作台', () => {
  assert.equal(pageSource.includes('platformAccessTabs'), true);
  assert.equal(pageSource.includes("key: 'identities'"), true);
  assert.equal(pageSource.includes("key: 'platform-admins'"), true);
  assert.equal(pageSource.includes("key: 'product-access'"), true);
  assert.equal(pageSource.includes("key: 'k8s-profiles'"), true);
  assert.equal(pageSource.includes("key: 'break-glass'"), true);
  assert.equal(pageSource.includes('用户与服务身份'), true);
  assert.equal(pageSource.includes('平台管理员'), true);
  assert.equal(pageSource.includes('产品授权'), true);
  assert.equal(pageSource.includes('K8S Access Profile'), true);
  assert.equal(pageSource.includes('Break Glass 与审计'), true);
  assert.equal(pageSource.includes('platform-access-panel'), true);
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

test('K8S Profile 明示整 Namespace 风险并要求确认真实影响边界', () => {
  assert.equal(pageSource.includes('整 Namespace 风险确认'), true);
  assert.equal(pageSource.includes('关联 Product / Service'), true);
  assert.equal(pageSource.includes('ServiceDeployment 生产真值'), true);
  assert.equal(apiSource.includes('/platform/k8s/namespace-impacts'), true);
  assert.equal(pageSource.includes('wholeNamespaceConfirmed'), true);
  assert.equal(apiSource.includes('whole_namespace_confirmed'), true);
  assert.equal(pageSource.includes('禁止使用空 Namespace、* 或 all_namespaces'), true);
  assert.equal(pageSource.includes('onEditProfile'), true);
  assert.equal(pageSource.includes('updateK8sAccessProfile'), true);
  assert.equal(pageSource.includes('保存 Profile'), true);
});

test('Break Glass 强调双人审批、两小时上限和审计入口', () => {
  assert.equal(pageSource.includes('另一名平台管理员审批'), true);
  assert.equal(pageSource.includes('最长 120 分钟'), true);
  assert.equal(pageSource.includes('/audit'), true);
  assert.equal(pageSource.includes('终端输出'), true);
});
