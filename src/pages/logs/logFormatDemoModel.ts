export type FormatAssessmentStatus = 'blocked' | 'ready_with_advice' | 'ready';
export type FormatCheckStatus = 'pass' | 'change' | 'missing' | 'invalid';

export interface FormatDemoScenario {
  id: 'java-text' | 'legacy-json' | 'standard-json';
  label: string;
  summary: string;
  currentSample: string;
  proposal: string;
}

export interface FormatCheck {
  field: string;
  requirement: '必填' | '推荐';
  owner: '业务';
  status: FormatCheckStatus;
  currentValue: string;
  message: string;
}

export interface BusinessLogAssessment {
  status: FormatAssessmentStatus;
  parseError: string;
  checks: FormatCheck[];
  blockingIssues: string[];
  advice: string[];
  recommendation: Record<string, unknown> | null;
}

export interface PlatformLogContext {
  serviceKey: string;
  serviceId: string;
  ownerTeam: string;
  alertRoute: string;
}

export interface CollectedLogPreview {
  business: Record<string, unknown>;
  platform: {
    'service.name': string;
    'novaapm.service_id': string;
    'novaapm.source_type': string;
    owner_team: string;
    alert_route: string;
  };
}

const canonicalLevels = new Set(['debug', 'info', 'warn', 'error', 'fatal']);
const levelAliases: Record<string, string> = {
  warning: 'warn',
  err: 'error',
};
const orderedBusinessFields = ['timestamp', 'level', 'message', 'trace_id', 'span_id', 'request_id'];
const sensitiveKeyPatterns = [
  /^(?:[a-z0-9]+_)*(?:password|passwd|pwd)(?:_value)?$/,
  /^(?:[a-z0-9]+_)*token(?:_value)?$/,
  /^(?:[a-z0-9]+_)*(?:secret|secret_(?:access_)?key)(?:_value)?$/,
  /^(?:[a-z0-9]+_)*(?:api_key|private_key)$/,
  /^(?:[a-z0-9]+_)*authorization(?:_header)?$/,
  /^(?:[a-z0-9]+_)*(?:set_)?cookie(?:_value)?$/,
  /^(?:[a-z0-9]+_)*session(?:_id|_key)?$/,
  /^(?:[a-z0-9]+_)*credentials?$/,
  /^(?:[a-z0-9]+_)*(?:id_card|identity_card|identity_number|citizen_id|id_number)$/,
  /^(?:[a-z0-9]+_)*(?:phone|phone_number|mobile|mobile_phone|email|email_address)$/,
];
const platformReservedFields = new Set([
  'novaapm.product_id',
  'novaapm.service_id',
  'novaapm.source_type',
  'novaapm.collector_group',
  'service.name',
  'service.runtime.type',
  'host.name',
  'owner_team',
  'alert_route',
  'victorialogs.endpoint_id',
  'cluster.id',
  'idc',
  'availability_zone',
  'cmdb.service_id',
  'business_id',
  'application_id',
]);
const platformReservedPrefixes = ['k8s.', 'vm.'];
export const maxBusinessLogProposalLength = 20_000;
const maxBusinessLogProposalDepth = 20;
const maxBusinessLogProposalFields = 200;

export const formatDemoScenarios: FormatDemoScenario[] = [
  {
    id: 'java-text',
    label: 'Java 文本日志',
    summary: '字段藏在文本中，检索和告警依赖正则。',
    currentSample: '2026-07-24 10:32:18.245 ERROR [orders-api,4bf92f3577b34da6a3ce929d0e0e4736,00f067aa0ba902b7] create order failed requestId=req-20260724-001 errorCode=ORDER_CREATE_FAILED',
    proposal: JSON.stringify({
      timestamp: '2026-07-24T10:32:18.245+08:00',
      level: 'error',
      message: 'create order failed',
      trace_id: '4bf92f3577b34da6a3ce929d0e0e4736',
      span_id: '00f067aa0ba902b7',
      request_id: 'req-20260724-001',
      error_code: 'ORDER_CREATE_FAILED',
      order_id: 'order-20260724-001',
    }, null, 2),
  },
  {
    id: 'legacy-json',
    label: '旧 JSON 字段',
    summary: '已经结构化，但字段名和日志级别不统一。',
    currentSample: '{"time":"2026-07-24 10:32:18","severity":"WARNING","msg":"payment timeout","traceId":"4bf92f3577b34da6a3ce929d0e0e4736","orderNo":"order-20260724-001"}',
    proposal: JSON.stringify({
      timestamp: '2026-07-24T10:32:18+08:00',
      level: 'WARNING',
      message: 'payment timeout',
      trace_id: '4bf92f3577b34da6a3ce929d0e0e4736',
      order_id: 'order-20260724-001',
    }, null, 2),
  },
  {
    id: 'standard-json',
    label: '达标 JSON',
    summary: '用于向业务方展示最小推荐输出。',
    currentSample: '{"timestamp":"2026-07-24T10:32:18.245+08:00","level":"error","message":"create order failed","trace_id":"4bf92f3577b34da6a3ce929d0e0e4736","span_id":"00f067aa0ba902b7","request_id":"req-20260724-001","error_code":"ORDER_CREATE_FAILED"}',
    proposal: JSON.stringify({
      timestamp: '2026-07-24T10:32:18.245+08:00',
      level: 'error',
      message: 'create order failed',
      trace_id: '4bf92f3577b34da6a3ce929d0e0e4736',
      span_id: '00f067aa0ba902b7',
      request_id: 'req-20260724-001',
      error_code: 'ORDER_CREATE_FAILED',
    }, null, 2),
  },
];

export function assessBusinessLogProposal(source: string): BusinessLogAssessment {
  if (source.length > maxBusinessLogProposalLength) {
    return blockedAssessment(`建议格式不能超过 ${maxBusinessLogProposalLength.toLocaleString('zh-CN')} 个字符。`);
  }
  const parsed = parseJSONObject(source);
  if (!parsed.value) return blockedAssessment(parsed.error);
  const structureError = validateJSONStructure(parsed.value);
  if (structureError) return blockedAssessment(structureError);

  const blockingIssues: string[] = [];
  const advice: string[] = [];
  const checks = [
    assessLevel(parsed.value.level, blockingIssues, advice),
    assessMessage(parsed.value.message, blockingIssues),
    assessRecommendedField('timestamp', parsed.value.timestamp, isRFC3339WithTimezone, '使用 RFC 3339 且必须带时区。', advice),
    assessRecommendedField('trace_id', parsed.value.trace_id, (value) => /^[a-f0-9]{32}$/i.test(value), '使用 32 位十六进制 Trace ID。', advice),
    assessRecommendedField('span_id', parsed.value.span_id, (value) => /^[a-f0-9]{16}$/i.test(value), '使用 16 位十六进制 Span ID。', advice),
    assessRecommendedField('request_id', parsed.value.request_id, (value) => Boolean(value.trim()), '保持请求链路内稳定且非空。', advice),
  ];
  const sensitivePaths = findSensitivePaths(parsed.value);
  if (sensitivePaths.length > 0) {
    blockingIssues.push(`禁止输出凭据或个人信息：${sensitivePaths.join('、')}`);
  }
  const reservedPaths = findPlatformReservedPaths(parsed.value);
  if (reservedPaths.length > 0) {
    blockingIssues.push(`以下字段由平台补齐，业务不得输出：${reservedPaths.join('、')}`);
  }
  const recommendation = buildRecommendation(parsed.value);

  return {
    status: blockingIssues.length > 0 ? 'blocked' : advice.length > 0 ? 'ready_with_advice' : 'ready',
    parseError: '',
    checks,
    blockingIssues,
    advice,
    recommendation,
  };
}

export function buildCollectedLogPreview(
  recommendation: Record<string, unknown> | null,
  context: PlatformLogContext,
): CollectedLogPreview {
  return {
    business: recommendation ?? {},
    platform: {
      'service.name': context.serviceKey || '<当前服务 Key>',
      'novaapm.service_id': context.serviceId || '<当前稳定服务 ID>',
      'novaapm.source_type': '<由采集路由注入：k8s 或 vm>',
      owner_team: context.ownerTeam || '<由服务目录注入>',
      alert_route: context.alertRoute || '<由服务目录/采集配置注入>',
    },
  };
}

function blockedAssessment(message: string): BusinessLogAssessment {
  return {
    status: 'blocked',
    parseError: message,
    checks: [],
    blockingIssues: [message],
    advice: [],
    recommendation: null,
  };
}

function parseJSONObject(source: string): { value: Record<string, unknown> | null; error: string } {
  try {
    const value = JSON.parse(source) as unknown;
    if (!isRecord(value)) return { value: null, error: '建议格式必须是一个 JSON 对象。' };
    return { value, error: '' };
  } catch {
    return { value: null, error: '建议格式不是有效 JSON，请检查引号、逗号和括号。' };
  }
}

function assessLevel(value: unknown, blockingIssues: string[], advice: string[]): FormatCheck {
  if (typeof value !== 'string' || !value.trim()) {
    blockingIssues.push('缺少必填字段 level。');
    return createCheck('level', '必填', 'missing', '', '统一使用 debug/info/warn/error/fatal。');
  }
  const original = value.trim();
  const normalized = normalizeLevel(original);
  if (!normalized) {
    blockingIssues.push(`level 的值“${original}”不在允许范围内。`);
    return createCheck('level', '必填', 'invalid', original, '统一使用 debug/info/warn/error/fatal。');
  }
  if (original !== normalized) {
    advice.push(`level 建议由“${original}”改为“${normalized}”。`);
    return createCheck('level', '必填', 'change', original, `推荐输出 ${normalized}。`);
  }
  return createCheck('level', '必填', 'pass', original, '格式符合规范。');
}

function assessMessage(value: unknown, blockingIssues: string[]): FormatCheck {
  if (typeof value !== 'string' || !value.trim()) {
    blockingIssues.push('缺少必填字段 message。');
    return createCheck('message', '必填', 'missing', '', '使用非空字符串描述当前日志事件。');
  }
  return createCheck('message', '必填', 'pass', isSensitiveString(value) ? '<敏感内容已隐藏>' : value, '格式符合规范。');
}

function assessRecommendedField(
  field: string,
  value: unknown,
  validate: (value: string) => boolean,
  guidance: string,
  advice: string[],
): FormatCheck {
  if (value === undefined || value === null || value === '') {
    advice.push(`建议补充 ${field}：${guidance}`);
    return createCheck(field, '推荐', 'missing', '', guidance);
  }
  const currentValue = typeof value === 'string' ? value : String(value);
  if (typeof value !== 'string' || !validate(value)) {
    advice.push(`${field} 格式需要调整：${guidance}`);
    return createCheck(field, '推荐', 'invalid', currentValue, guidance);
  }
  return createCheck(field, '推荐', 'pass', currentValue, '格式符合规范。');
}

function createCheck(
  field: string,
  requirement: FormatCheck['requirement'],
  status: FormatCheckStatus,
  currentValue: string,
  message: string,
): FormatCheck {
  return { field, requirement, owner: '业务', status, currentValue, message };
}

function normalizeLevel(value: string): string {
  const lower = value.toLowerCase();
  if (canonicalLevels.has(lower)) return lower;
  return levelAliases[lower] ?? '';
}

function isRFC3339WithTimezone(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && !Number.isNaN(Date.parse(value));
}

function buildRecommendation(value: Record<string, unknown>): Record<string, unknown> {
  const sanitized = sanitizeRecord(value);
  const normalizedLevel = typeof sanitized.level === 'string' ? normalizeLevel(sanitized.level) : '';
  const normalized = normalizedLevel ? { ...sanitized, level: normalizedLevel } : sanitized;
  return Object.fromEntries([
    ...orderedBusinessFields
      .filter((field) => normalized[field] !== undefined)
      .map((field) => [field, normalized[field]] as const),
    ...Object.keys(normalized)
      .filter((field) => !orderedBusinessFields.includes(field))
      .sort()
      .map((field) => [field, normalized[field]] as const),
  ]);
}

function sanitizeRecord(value: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isSensitiveKey(key) || isPlatformReservedPath(path)) return [];
    return [[key, sanitizeValue(child, path)]];
  }));
}

function sanitizeValue(value: unknown, path: string): unknown {
  if (typeof value === 'string' && isSensitiveString(value)) return '<敏感内容已移除>';
  if (Array.isArray(value)) return value.map((item, index) => sanitizeValue(item, `${path}[${index}]`));
  if (isRecord(value)) return sanitizeRecord(value, path);
  return value;
}

function findSensitivePaths(value: Record<string, unknown>, prefix = ''): string[] {
  return findSensitiveValuePaths(value, prefix);
}

function findSensitiveValuePaths(value: unknown, prefix: string): string[] {
  if (typeof value === 'string') return isSensitiveString(value) ? [prefix] : [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findSensitiveValuePaths(item, `${prefix}[${index}]`));
  }
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isSensitiveKey(key)) return [path];
    return findSensitiveValuePaths(child, path);
  });
}

function findPlatformReservedPaths(value: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    const ownPath = isPlatformReservedPath(path) ? [path] : [];
    if (isRecord(child)) return [...ownPath, ...findPlatformReservedPaths(child, path)];
    if (Array.isArray(child)) {
      return [
        ...ownPath,
        ...child.flatMap((item, index) => (
          isRecord(item) ? findPlatformReservedPaths(item, `${path}[${index}]`) : []
        )),
      ];
    }
    return ownPath;
  });
}

function validateJSONStructure(root: Record<string, unknown>): string {
  const stack: Array<{ value: unknown; depth: number }> = [{ value: root, depth: 1 }];
  let fieldCount = 0;
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) break;
    if (current.depth > maxBusinessLogProposalDepth) {
      return `建议格式最多允许 ${maxBusinessLogProposalDepth} 层嵌套。`;
    }
    const children = Array.isArray(current.value)
      ? current.value
      : isRecord(current.value)
        ? Object.values(current.value)
        : [];
    fieldCount += children.length;
    if (fieldCount > maxBusinessLogProposalFields) {
      return `建议格式最多允许 ${maxBusinessLogProposalFields} 个字段或数组项。`;
    }
    children.forEach((child) => {
      if (Array.isArray(child) || isRecord(child)) stack.push({ value: child, depth: current.depth + 1 });
    });
  }
  return '';
}

function isSensitiveKey(key: string): boolean {
  const normalized = key
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[.\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
  return sensitiveKeyPatterns.some((pattern) => pattern.test(normalized));
}

function isSensitiveString(value: string): boolean {
  return /\bBearer\s+[A-Za-z0-9._~+/-]+=*/i.test(value)
    || /\bBasic\s+[A-Za-z0-9+/]{8,}={0,2}(?![A-Za-z0-9+/=])/i.test(value)
    || /(?:^|[^A-Za-z0-9_-])eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?![A-Za-z0-9_-])/.test(value)
    || /(?:password|token|secret|api[_-]?key)\s*[=:]\s*[^\s&]+/i.test(value)
    || /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value)
    || /\b1[3-9]\d{9}\b/.test(value)
    || /\b\d{17}[\dXx]\b/.test(value);
}

function isPlatformReservedPath(path: string): boolean {
  const normalized = path.replace(/\[\d+\]/g, '');
  return platformReservedFields.has(normalized)
    || platformReservedPrefixes.some((prefix) => normalized.startsWith(prefix));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
