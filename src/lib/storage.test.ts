import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadFromStorage, saveToStorage } from './storage';

const createMemoryStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('storage', () => {
  it('保存した値を読み出せる', () => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    saveToStorage('key', { a: 1 });
    expect(loadFromStorage('key', () => null)).toEqual({ a: 1 });
  });

  it('未保存ならフォールバックを返す', () => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    expect(loadFromStorage('missing', () => 'fallback')).toBe('fallback');
  });

  it('壊れた JSON はフォールバックを返す', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('localStorage', { getItem: () => '{broken', setItem: () => {} });
    expect(loadFromStorage('key', () => 'fallback')).toBe('fallback');
  });
});
