import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, request } from './api';

const memoryStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
};

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('request', () => {
  it('CSRF ヘッダーと匿名IDを付け、Cookie を送る', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await request('POST', '/me/claim', { body: { a: 1 } });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/me/claim');
    expect(init.credentials).toBe('include');
    expect(init.headers['X-Requested-With']).toBe('discotq');
    expect(init.headers['X-Anonymous-Id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"a":1}');
  });

  it('同じ匿名IDを使い回す', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response('{}', { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
    await request('GET', '/me/videos');
    await request('GET', '/me/videos');
    expect(fetchMock.mock.calls[0][1].headers['X-Anonymous-Id']).toBe(
      fetchMock.mock.calls[1][1].headers['X-Anonymous-Id']
    );
  });

  it('空のクエリは付けない', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await request('GET', '/admin/videos', { query: { status: '', source: 'user', offset: 0 } });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/videos?source=user&offset=0');
  });

  it('エラー応答を ApiError に変換する', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: { code: 'rate_limited', message: '多すぎます' } }), { status: 429 })
        )
    );
    await expect(request('POST', '/uploads/intent', { body: {} })).rejects.toMatchObject({
      status: 429,
      code: 'rate_limited',
      message: '多すぎます',
    });
  });

  it('通信エラーは network_error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')));
    const err = (await request('GET', '/health').catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('network_error');
  });
});
