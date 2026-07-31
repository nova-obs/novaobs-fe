import assert from 'node:assert/strict';
import test from 'node:test';
import {
  identityIdentifierError,
  identityIdentifierHelp,
} from './identityValidation.ts';

test('身份标识帮助只描述用户名自身规则', () => {
  assert.equal(identityIdentifierError('developers'), '');
  assert.doesNotMatch(identityIdentifierHelp, /显示名称/);
});

test('身份标识拒绝中文、空格和超长输入', () => {
  assert.match(identityIdentifierError('研发组'), /字母或数字开头/);
  assert.match(identityIdentifierError('developer group'), /字母或数字开头/);
  assert.match(identityIdentifierError(`a${'b'.repeat(128)}`), /最长 128 个字符/);
});

test('身份标识允许后端约定的完整字符集', () => {
  assert.equal(identityIdentifierError('team.dev_ops:cn@prod-1'), '');
});
