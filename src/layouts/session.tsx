import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export type LogoutStatus = 'idle' | 'pending' | 'done' | 'server_failed';
export type SessionStatus = 'checking' | 'authenticated' | 'anonymous';

export interface PlatformSessionSubject {
  id: string;
  type: string;
  displayName: string;
}

export interface PlatformSession {
  subject: PlatformSessionSubject;
  expiresAt: string;
}

const signedOutStorageKey = 'novaobs_signed_out';
const storageKeys = ['novaobs_session', 'novaobs_token', 'novaobs_subject', 'auth_token', 'access_token', 'refresh_token'];

export function useLogoutAction(options: { onBeforeRedirect?: () => void; onLoggedOut?: () => void } = {}) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<LogoutStatus>('idle');

  async function logout() {
    setStatus('pending');
    let serverLogoutFailed = false;
    try {
      const response = await fetch('/api/v1/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      serverLogoutFailed = !response.ok;
    } catch {
      serverLogoutFailed = true;
    } finally {
      clearClientSession();
      markClientSignedOut();
      setStatus(serverLogoutFailed ? 'server_failed' : 'done');
      options.onBeforeRedirect?.();
      options.onLoggedOut?.();
      navigate('/?signed_out=1', { replace: true });
    }
  }

  return { status, logout };
}

export async function fetchPlatformSession(): Promise<PlatformSession> {
  const response = await fetch('/api/v1/auth/session', { credentials: 'same-origin' });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw new Error(body?.error?.message ?? '请先登录');
  }
  return mapSession(body.data);
}

export async function loginPlatformUser(input: { username: string; password: string }): Promise<PlatformSession> {
  const response = await fetch('/api/v1/auth/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: input.username, password: input.password }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw new Error(body?.error?.message ?? '登录失败');
  }
  resetClientSignedOut();
  return mapSession(body.data);
}

export function sessionDisplayName(subject?: PlatformSessionSubject | null) {
  return subject?.displayName || subject?.id || '平台用户';
}

function mapSession(raw: any): PlatformSession {
  const subject = raw?.subject ?? {};
  return {
    subject: {
      id: String(subject.id ?? ''),
      type: String(subject.type ?? ''),
      displayName: subject.display_name ?? subject.displayName ?? '',
    },
    expiresAt: raw?.expires_at ?? raw?.expiresAt ?? '',
  };
}

export function clearClientSession() {
  if (typeof window === 'undefined') {
    return;
  }
  for (const key of storageKeys) {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  }
}

export function markClientSignedOut() {
  if (typeof window === 'undefined') {
    return;
  }
  window.sessionStorage.setItem(signedOutStorageKey, '1');
}

export function resetClientSignedOut() {
  if (typeof window === 'undefined') {
    return;
  }
  window.sessionStorage.removeItem(signedOutStorageKey);
}

export function isClientSignedOut() {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.sessionStorage.getItem(signedOutStorageKey) === '1';
}

export function isSignedOutLocation(search: string) {
  return new URLSearchParams(search).get('signed_out') === '1';
}
