import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, setCsrfToken } from '../src/api';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
afterEach(() => vi.unstubAllGlobals());

describe('API client', () => {
  it('sends the security (CSRF) token on changes, not on reads', async () => {
    const fetchMock = vi.fn(async () => json(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    setCsrfToken('tok-1');
    await api('/questions');
    await api('/questions', { method: 'POST', body: '{}' });
    const headers = (i: number) => (fetchMock.mock.calls[i] as unknown as [string, RequestInit])[1].headers as Headers;
    expect(headers(0).get('x-csrf-token')).toBeNull();
    expect(headers(1).get('x-csrf-token')).toBe('tok-1');
    expect(headers(1).get('content-type')).toBe('application/json');
  });

  it('gets a new security token and retries once when it has expired', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(403, { error: 'Invalid security token. Refresh the page.' }))
      .mockResolvedValueOnce(json(200, { csrfToken: 'tok-2' }))
      .mockResolvedValueOnce(json(200, { saved: true }));
    vi.stubGlobal('fetch', fetchMock);
    setCsrfToken('old');
    await expect(api('/papers', { method: 'POST', body: '{}' })).resolves.toEqual({ saved: true });
    expect(((fetchMock.mock.calls[2] as [string, RequestInit])[1].headers as Headers).get('x-csrf-token')).toBe('tok-2');
  });

  it('turns validation errors into readable messages that name the field', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(400, { error: 'Invalid', fields: [{ path: 'newPassword', message: 'Use at least 10 characters' }] })));
    const error = await api('/auth/password', { method: 'POST', body: '{}' }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.message).toBe('New password: Use at least 10 characters');
  });

  it('shows the server message, or a fallback when there is none', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(401, { error: 'Incorrect username or password.' })));
    await expect(api('/auth/login', { method: 'POST', body: '{}' })).rejects.toThrow('Incorrect username or password.');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 502 })));
    await expect(api('/health')).rejects.toThrow('Request failed (502)');
  });
});
