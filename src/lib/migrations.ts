import { AdItem } from '../types';
import {
  LEGACY_LOCAL_STORAGE_KEY_ADS,
  LEGACY_LOCAL_STORAGE_KEY_USER,
  LOCAL_STORAGE_KEY_ADS,
  LOCAL_STORAGE_KEY_USER,
} from '../constants/storage';

// プラットフォームが発行した旧ブランドのクーポンコード（クリエイターが独自入力したコードは対象外）
const LEGACY_COUPON_CODES: Record<string, string> = {
  ADTOK2026: 'DISCOTQ2026',
  'ADTOK-OFFER': 'DISCOTQ-OFFER',
  'ADTOK-REPAIR20': 'DISCOTQ-REPAIR20',
  'ADTOK-AERO15': 'DISCOTQ-AERO15',
  'ADTOK-MEAL30': 'DISCOTQ-MEAL30',
  'ADTOK-BIKE10': 'DISCOTQ-BIKE10',
};

export const renameLegacyCoupons = (ads: AdItem[]): AdItem[] =>
  ads.map((ad) => {
    const offer = ad.landingPage?.specialOffer;
    const renamed = offer && LEGACY_COUPON_CODES[offer.couponCode];
    if (!offer || !renamed) return ad;
    return { ...ad, landingPage: { ...ad.landingPage, specialOffer: { ...offer, couponCode: renamed } } };
  });

// 新キーが未作成で旧キーが残っている場合のみ移行し、旧キーは削除する
export const migrateStorageKey = (
  oldKey: string,
  newKey: string,
  transform: (raw: string) => string = (raw) => raw
) => {
  try {
    const legacy = localStorage.getItem(oldKey);
    if (legacy === null) return;
    if (localStorage.getItem(newKey) === null) {
      localStorage.setItem(newKey, transform(legacy));
    }
    localStorage.removeItem(oldKey);
  } catch (e) {
    console.error(e);
  }
};

export const runStorageMigrations = () => {
  migrateStorageKey(LEGACY_LOCAL_STORAGE_KEY_USER, LOCAL_STORAGE_KEY_USER);
  migrateStorageKey(LEGACY_LOCAL_STORAGE_KEY_ADS, LOCAL_STORAGE_KEY_ADS, (raw) =>
    JSON.stringify(renameLegacyCoupons(JSON.parse(raw)))
  );
};
