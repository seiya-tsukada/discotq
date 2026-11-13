import { getAnonymousId } from './anonymousId';
import type {
  AdminStats,
  AdminVideoDetail,
  AdminVideo,
  AdminVideosResponse,
  AuthUser,
  FeedResponse,
  MyVideo,
  MyVideosResponse,
  PresignedPut,
  PreviewUrlResponse,
  UploadConfig,
  UploadIntentRequest,
  UploadIntentResponse,
  VideoSource,
  VideoStatus,
} from '../types/api';

// 同一ドメイン（Vercel）では空文字で /api を使う。ローカルでは Vite の proxy が /api を FastAPI に流す
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
    // Vercel の Function ログを検索するための ID（x-vercel-id）
    readonly requestId?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

const buildUrl = (path: string, query?: Query) => {
  const url = `${API_BASE_URL}/api${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  });
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
};

export const request = async <T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  options: { body?: unknown; query?: Query } = {}
): Promise<T> => {
  const headers: Record<string, string> = {
    // バックエンドの CSRF 対策で更新系に必須
    'X-Requested-With': 'discotq',
    'X-Anonymous-Id': getAnonymousId(),
  };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      credentials: 'include',
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'network_error', 'サーバーに接続できませんでした。通信環境を確認してください');
  }

  const text = await res.text();
  const data: unknown = text ? safeJson(text) : null;
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string; details?: unknown; request_id?: string } } | null)
      ?.error;
    const requestId = err?.request_id ?? res.headers.get('x-request-id') ?? res.headers.get('x-vercel-id') ?? undefined;
    // API が起動できない場合などは Vercel 自身のエラー（例: FUNCTION_INVOCATION_FAILED）が返る
    const platformError = res.headers.get('x-vercel-error');
    const base =
      err?.message ??
      (platformError
        ? `サーバーが応答できませんでした (${res.status} ${platformError})`
        : `エラーが発生しました (${res.status})`);
    throw new ApiError(
      res.status,
      err?.code ?? platformError?.toLowerCase() ?? 'http_error',
      requestId ? `${base}（エラーID: ${requestId}）` : base,
      err?.details,
      requestId
    );
  }
  return data as T;
};

const safeJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export const errorMessage = (e: unknown): string =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : '予期しないエラーが発生しました';

// ---------------------------------------------------------------- auth

export const authApi = {
  me: () => request<{ user: AuthUser | null }>('GET', '/auth/me'),
  signup: (body: { email: string; password: string; display_name?: string }) =>
    request<{ user: AuthUser }>('POST', '/auth/signup', { body }),
  login: (body: { email: string; password: string }) => request<{ user: AuthUser }>('POST', '/auth/login', { body }),
  logout: () => request<{ ok: boolean }>('POST', '/auth/logout'),
  verifyEmail: (token: string) => request<{ ok: boolean }>('POST', '/auth/verify-email', { body: { token } }),
  resendVerification: () => request<{ ok: boolean }>('POST', '/auth/resend-verification'),
  requestPasswordReset: (email: string) =>
    request<{ ok: boolean }>('POST', '/auth/password-reset/request', { body: { email } }),
  confirmPasswordReset: (token: string, password: string) =>
    request<{ ok: boolean }>('POST', '/auth/password-reset/confirm', { body: { token, password } }),
};

// ---------------------------------------------------------------- videos

export const videoApi = {
  feed: (cursor?: string | null, limit = 10) =>
    request<FeedResponse>('GET', '/videos/feed', { query: { cursor, limit } }),
  uploadConfig: () => request<UploadConfig>('GET', '/uploads/config'),
  createIntent: (body: UploadIntentRequest) => request<UploadIntentResponse>('POST', '/uploads/intent', { body }),
  complete: (videoId: string) => request<MyVideo>('POST', `/uploads/${videoId}/complete`),
  myVideos: () => request<MyVideosResponse>('GET', '/me/videos'),
  deleteMyVideo: (videoId: string) => request<{ ok: boolean }>('DELETE', `/me/videos/${videoId}`),
  claim: () => request<{ claimed: number }>('POST', '/me/claim'),
};

export const adminApi = {
  stats: () => request<AdminStats>('GET', '/admin/stats'),
  list: (query: { status?: VideoStatus | ''; source?: VideoSource | ''; limit?: number; offset?: number }) =>
    request<AdminVideosResponse>('GET', '/admin/videos', { query }),
  get: (id: string) => request<AdminVideoDetail>('GET', `/admin/videos/${id}`),
  previewUrl: (id: string) => request<PreviewUrlResponse>('GET', `/admin/videos/${id}/preview-url`),
  approve: (id: string) => request<AdminVideo>('POST', `/admin/videos/${id}/approve`),
  reject: (id: string, reason: string) =>
    request<AdminVideo>('POST', `/admin/videos/${id}/reject`, { body: { reason } }),
  unpublish: (id: string, reason?: string) =>
    request<AdminVideo>('POST', `/admin/videos/${id}/unpublish`, { body: { reason: reason || null } }),
  createIntent: (body: UploadIntentRequest) => request<UploadIntentResponse>('POST', '/admin/uploads/intent', { body }),
};

// ---------------------------------------------------------------- direct upload

// 署名付き URL へ直接 PUT する。fetch では進捗が取れないため XHR を使う
export const putToSignedUrl = (
  target: PresignedPut,
  body: Blob,
  onProgress?: (loaded: number, total: number) => void,
  signal?: AbortSignal
): Promise<void> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(target.method, target.url);
    Object.entries(target.headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded, e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(
            new ApiError(
              xhr.status,
              'storage_upload_failed',
              `ストレージへのアップロードに失敗しました (${xhr.status})`
            )
          );
    xhr.onerror = () =>
      reject(new ApiError(0, 'storage_network_error', 'ストレージへのアップロード中に通信エラーが発生しました'));
    xhr.onabort = () => reject(new ApiError(0, 'aborted', 'アップロードを中止しました'));
    signal?.addEventListener('abort', () => xhr.abort());
    xhr.send(body);
  });
