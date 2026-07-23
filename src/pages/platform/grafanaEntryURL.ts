const credentialQueryKeys = new Set([
	'token',
	'accesstoken',
	'refreshtoken',
	'idtoken',
	'authtoken',
	'apitoken',
	'apikey',
	'jwt',
	'bearer',
	'authorization',
	'auth',
	'password',
	'passwd',
	'secret',
	'clientsecret',
	'session',
	'sessionid',
]);

export function validateGrafanaEntryURL(value: string) {
	if (!value.trim()) return 'Grafana 入口地址不能为空';
	let parsed: URL;
	try {
		parsed = new URL(value.trim());
	} catch {
		return '请输入完整的 HTTP 或 HTTPS 地址';
	}
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '仅支持 HTTP 或 HTTPS 地址';
	if (parsed.username || parsed.password) return '地址中不能包含账号或密码';
	if (parsed.hash) return '地址中不能包含 fragment';
	if (!isAllowedEntryPath(parsed.pathname)) return '入口路径仅支持 /dashboards、/d/... 或 /explore';
	for (const key of parsed.searchParams.keys()) {
		const normalized = key.trim().toLowerCase().replace(/[-_.]/g, '');
		if (credentialQueryKeys.has(normalized)) return '地址中不能包含访问凭证';
	}
	return '';
}

function isAllowedEntryPath(pathname: string) {
	const lowered = pathname.toLowerCase();
	if (lowered.includes('%2f') || lowered.includes('%5c') || pathname.includes('\\')) return false;
	return hasPathPrefix(pathname, '/dashboards') ||
		hasPathPrefix(pathname, '/explore') ||
		(pathname.startsWith('/d/') && pathname.slice(3).replaceAll('/', '').length > 0);
}

function hasPathPrefix(pathname: string, prefix: string) {
	return pathname === prefix || pathname.startsWith(`${prefix}/`);
}
