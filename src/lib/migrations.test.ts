import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runStorageMigrations } from './migrations';

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

describe('runStorageMigrations', () => {
  it('端末内のリワードウォレットと広告モックのデータを削除し、匿名IDは残す', () => {
    storage.setItem('discotq_user_v3', JSON.stringify({ points: 120 }));
    storage.setItem('adtok_user_v3', JSON.stringify({ points: 50 }));
    storage.setItem('adtok_ads_v3', '[]');
    storage.setItem('discotq_ads_v3', '[]');
    storage.setItem('discotq_anonymous_id', '00000000-0000-4000-8000-000000000000');

    runStorageMigrations();

    expect(storage.getItem('discotq_user_v3')).toBeNull();
    expect(storage.getItem('adtok_user_v3')).toBeNull();
    expect(storage.getItem('adtok_ads_v3')).toBeNull();
    expect(storage.getItem('discotq_ads_v3')).toBeNull();
    expect(storage.getItem('discotq_anonymous_id')).not.toBeNull();
  });
});
