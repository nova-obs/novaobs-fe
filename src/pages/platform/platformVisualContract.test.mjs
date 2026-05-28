import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const platformAccessAdminSource = readFileSync(new URL('./PlatformAccessAdminPage.tsx', import.meta.url), 'utf8');

test('平台用户权限页面不再保留内置角色保护，只保护当前或开发保留账号', () => {
  assert.equal(platformAccessAdminSource.includes('deleteSubjectMutation'), true);
  assert.equal(platformAccessAdminSource.includes('deleteRoleMutation'), true);
  assert.equal(platformAccessAdminSource.includes('deleteBindingMutation'), true);
  assert.equal(platformAccessAdminSource.includes('DeleteActionButton'), true);
  assert.equal(platformAccessAdminSource.includes('isProtectedRole'), false);
  assert.equal(platformAccessAdminSource.includes('isProtectedBinding'), false);
  assert.equal(platformAccessAdminSource.includes('系统内置角色'), false);
  assert.equal(platformAccessAdminSource.includes('当前用户'), true);
  assert.equal(platformAccessAdminSource.includes('保留账号'), true);
  assert.equal(platformAccessAdminSource.includes('确认删除'), true);
});

test('平台用户权限页面使用 Tab 工作台拆分用户、组、角色和授权', () => {
  assert.equal(platformAccessAdminSource.includes('platformAdminTabs'), true);
  assert.equal(platformAccessAdminSource.includes('activeTab'), true);
  assert.equal(platformAccessAdminSource.includes("key: 'users'"), true);
  assert.equal(platformAccessAdminSource.includes("key: 'groups'"), true);
  assert.equal(platformAccessAdminSource.includes("key: 'service-accounts'"), true);
  assert.equal(platformAccessAdminSource.includes("key: 'roles'"), true);
  assert.equal(platformAccessAdminSource.includes("key: 'bindings'"), true);
  assert.equal(platformAccessAdminSource.includes("key: 'effective'"), true);
  assert.equal(platformAccessAdminSource.includes('PlatformTabNav'), true);
  assert.equal(platformAccessAdminSource.includes("activeTab === 'users'"), true);
  assert.equal(platformAccessAdminSource.includes("activeTab === 'groups'"), true);
  assert.equal(platformAccessAdminSource.includes("activeTab === 'roles'"), true);
  assert.equal(platformAccessAdminSource.includes('CreateUserPanel'), true);
  assert.equal(platformAccessAdminSource.includes('CreateRolePanel'), true);
  assert.equal(platformAccessAdminSource.includes('BindingEditorPanel'), true);
});

test('平台用户组成员维护不会把用户组作为默认成员主体提交', () => {
  assert.equal(platformAccessAdminSource.includes('assignableMemberSubjects'), true);
  assert.equal(platformAccessAdminSource.includes('activeMemberSubjectValue'), true);
  assert.equal(platformAccessAdminSource.includes("item.subjectType !== 'group'"), true);
  assert.equal(platformAccessAdminSource.includes('memberSubject || activeSubjectValue'), false);
});
