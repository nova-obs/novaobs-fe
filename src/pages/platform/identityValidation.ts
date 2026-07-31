export const identityIdentifierHelp = '以字母或数字开头，只能包含字母、数字及 ._:@-，最长 128 个字符。';

const identityIdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/;

export function identityIdentifierError(value: string): string {
  const identifier = value.trim();
  if (identifier.length > 128) {
    return '稳定标识最长 128 个字符。';
  }
  if (identifier && !identityIdentifierPattern.test(identifier)) {
    return '稳定标识必须以字母或数字开头，只能包含字母、数字及 ._:@-。';
  }
  return '';
}
