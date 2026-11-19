import { GiftItem, PointHistoryEntry } from '../types';
import type { ApiGift, LedgerEntry } from '../types/api';
import { POINT_HISTORY_DATE_FORMAT } from '../constants/rewards';

// on なら追加（重複させない）、off なら除去する
export const setIdIn = (ids: string[], id: string, on: boolean): string[] => {
  const without = ids.filter((x) => x !== id);
  return on ? [id, ...without] : without;
};

export const toHistoryEntry = (e: LedgerEntry): PointHistoryEntry => ({
  id: e.id,
  title: e.title,
  points: e.points,
  date: new Date(e.created_at).toLocaleDateString('ja-JP', POINT_HISTORY_DATE_FORMAT),
  kind: e.kind,
  giftCode: e.gift_code,
});

export const toGiftItem = (g: ApiGift): GiftItem => ({
  id: g.id,
  name: g.name,
  brand: g.brand,
  pointsCost: g.points_cost,
  iconUrl: g.icon_url,
  category: g.category,
  stock: g.stock,
  popular: g.popular,
  valueDescription: g.value_description,
});
