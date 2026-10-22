import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INITIAL_ADS } from '../data/mockAds';
import { migrateStorageKey, renameLegacyCoupons, runStorageMigrations } from './migrations';

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

describe('renameLegacyCoupons', () => {
  const withCoupon = (couponCode: string) => {
    const ad = INITIAL_ADS.find((a) => a.landingPage.specialOffer)!;
    return { ...ad, landingPage: { ...ad.landingPage, specialOffer: { ...ad.landingPage.specialOffer!, couponCode } } };
  };

  it('プラットフォーム発行の旧クーポンを置き換える', () => {
    const [ad] = renameLegacyCoupons([withCoupon('ADTOK-REPAIR20')]);
    expect(ad.landingPage.specialOffer?.couponCode).toBe('DISCOTQ-REPAIR20');
  });

  it('独自入力のクーポンはそのまま残す', () => {
    const [ad] = renameLegacyCoupons([withCoupon('MY-SHOP-10')]);
    expect(ad.landingPage.specialOffer?.couponCode).toBe('MY-SHOP-10');
  });
});

describe('runStorageMigrations', () => {
  it('ユーザーと広告データを新キーへ移行する', () => {
    const ad = INITIAL_ADS.find((a) => a.landingPage.specialOffer)!;
    const legacyAd = {
      ...ad,
      landingPage: { ...ad.landingPage, specialOffer: { ...ad.landingPage.specialOffer!, couponCode: 'ADTOK2026' } },
    };
    storage.setItem('adtok_user_v3', JSON.stringify({ points: 120 }));
    storage.setItem('adtok_ads_v3', JSON.stringify([legacyAd]));

    runStorageMigrations();

    expect(JSON.parse(storage.getItem('discotq_user_v3')!)).toEqual({ points: 120 });
    expect(JSON.parse(storage.getItem('discotq_ads_v3')!)[0].landingPage.specialOffer.couponCode).toBe('DISCOTQ2026');
    expect(storage.getItem('adtok_user_v3')).toBeNull();
    expect(storage.getItem('adtok_ads_v3')).toBeNull();
  });
});
