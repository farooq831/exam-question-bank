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
  const payload = (await response.json().catch(() => ({}))) as { error?: string; details?: unknown; fields?: { path: string; message: string }[] };
  if (!response.ok) throw new ApiError(response.status, errorMessage(payload, response.status), payload.details ?? payload.fields);
  return payload as T;
}

/** "newPassword" -> "New password" */
const fieldName = (path: string) => {
  const last = path.split('.').filter((x) => !/^\d+$/.test(x)).pop() ?? path;
  const words = last.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** Validation errors name the field and the problem, so the user knows what to fix. */
function errorMessage(payload: { error?: string; fields?: { path: string; message: string }[] }, status: number) {
  if (payload.fields?.length) return [...new Set(payload.fields.map((f) => (f.path ? `${fieldName(f.path)}: ${f.message}` : f.message)))].join('. ');
  return payload.error ?? `Request failed (${status})`;
}

export async function refreshCsrf() {
  const response = await api<{ csrfToken: string }>('/auth/csrf');
  setCsrfToken(response.csrfToken);
}
