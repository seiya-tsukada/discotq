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

describe('request のエラーID', () => {
  it('API のエラー応答の request_id をメッセージに含める', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              error: { code: 'db_unavailable', message: 'DBに接続できません', request_id: 'hnd1::abc' },
            }),
            { status: 503 }
          )
        )
    );
    const err = (await request('GET', '/videos/feed').catch((e: unknown) => e)) as ApiError;
    expect(err.code).toBe('db_unavailable');
    expect(err.requestId).toBe('hnd1::abc');
    expect(err.message).toBe('DBに接続できません（エラーID: hnd1::abc）');
  });

  it('Vercel 自身のエラー（関数の起動失敗）も ID 付きで表示する', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('A server error has occurred', {
          status: 500,
          headers: { 'x-vercel-error': 'FUNCTION_INVOCATION_FAILED', 'x-vercel-id': 'hnd1::k5cp4-1' },
        })
      )
    );
    const err = (await request('GET', '/videos/feed').catch((e: unknown) => e)) as ApiError;
    expect(err.code).toBe('function_invocation_failed');
    expect(err.message).toBe(
      'サーバーが応答できませんでした (500 FUNCTION_INVOCATION_FAILED)（エラーID: hnd1::k5cp4-1）'
    );
  });
});
