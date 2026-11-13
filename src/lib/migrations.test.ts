import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrateStorageKey, runStorageMigrations } from './migrations';

const createMemoryStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  };
};

let storage: ReturnType<typeof createMemoryStorage>;

beforeEach(() => {
  storage = createMemoryStorage();
  vi.stubGlobal('localStorage', storage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('migrateStorageKey', () => {
  it('旧キーの値を新キーへ移し、旧キーを削除する', () => {
    storage.setItem('old', '"value"');
    migrateStorageKey('old', 'new');
    expect(storage.getItem('new')).toBe('"value"');
    expect(storage.getItem('old')).toBeNull();
  });

  it('新キーが既にある場合は上書きしない', () => {
    storage.setItem('old', '"legacy"');
    storage.setItem('new', '"current"');
    migrateStorageKey('old', 'new');
    expect(storage.getItem('new')).toBe('"current"');
    expect(storage.getItem('old')).toBeNull();
  });

  it('旧キーがなければ何もしない', () => {
    migrateStorageKey('old', 'new');
    expect(storage.getItem('new')).toBeNull();
  });
});

describe('runStorageMigrations', () => {
  it('ユーザーデータを新キーへ移行し、広告モックのデータを削除する', () => {
    storage.setItem('adtok_user_v3', JSON.stringify({ points: 120 }));
    storage.setItem('adtok_ads_v3', '[]');
    storage.setItem('discotq_ads_v3', '[]');

    runStorageMigrations();

    expect(JSON.parse(storage.getItem('discotq_user_v3')!)).toEqual({ points: 120 });
    expect(storage.getItem('adtok_user_v3')).toBeNull();
    expect(storage.getItem('adtok_ads_v3')).toBeNull();
    expect(storage.getItem('discotq_ads_v3')).toBeNull();
  });
});
