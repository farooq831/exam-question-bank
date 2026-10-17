export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

let csrfToken = '';

export function setCsrfToken(token: string) {
  csrfToken = token;
}

export async function apiText(path: string, options: RequestInit = {}) {
  const method = (options.method ?? 'GET').toUpperCase();
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) headers.set('x-csrf-token', csrfToken);
  let response = await fetch(`/api${path}`, { ...options, headers, credentials: 'include' });
  if (response.status === 403) {
    const errorPayload = (await response.clone().json().catch(() => ({}))) as { error?: string };
    if (errorPayload.error?.toLowerCase().includes('security token')) {
      await refreshCsrf();
      headers.set('x-csrf-token', csrfToken);
      response = await fetch(`/api${path}`, { ...options, headers, credentials: 'include' });
    }
  }
  const text = await response.text();
  if (!response.ok) throw new ApiError(response.status, text || `Request failed (${response.status})`);
  return text;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) headers.set('x-csrf-token', csrfToken);
  let response = await fetch(`/api${path}`, { ...options, headers, credentials: 'include' });
  if (response.status === 403) {
    const errorPayload = (await response.clone().json().catch(() => ({}))) as { error?: string };
    if (errorPayload.error?.toLowerCase().includes('security token')) {
      await refreshCsrf();
      headers.set('x-csrf-token', csrfToken);
      response = await fetch(`/api${path}`, { ...options, headers, credentials: 'include' });
    }
  }
  const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: unknown };
  if (!response.ok) throw new ApiError(response.status, payload.error ?? `Request failed (${response.status})`, payload.details);
  return payload as T;
}

export async function refreshCsrf() {
  const response = await api<{ csrfToken: string }>('/auth/csrf');
  setCsrfToken(response.csrfToken);
}
