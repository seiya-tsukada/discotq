import { LOCAL_STORAGE_KEY_ANONYMOUS_ID } from '../constants/storage';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let memoryFallback: string | null = null;

// 未ログインでの投稿者を識別する端末ごとの UUID。初回アクセス時に生成して保存する
export const getAnonymousId = (): string => {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_ANONYMOUS_ID);
    if (saved && UUID_RE.test(saved)) return saved;
    const id = crypto.randomUUID();
    localStorage.setItem(LOCAL_STORAGE_KEY_ANONYMOUS_ID, id);
    return id;
  } catch {
    // localStorage が使えない環境ではタブを開いている間だけ有効な ID を使う
    memoryFallback ??= crypto.randomUUID();
    return memoryFallback;
  }
};
