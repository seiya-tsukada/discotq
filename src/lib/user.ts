import { PointHistoryEntry, UserLevel } from '../types';
import { GIFT_CODE_PREFIX, LEVEL_THRESHOLDS, POINT_HISTORY_DATE_FORMAT } from '../constants/rewards';

export const createHistoryEntry = (
  idPrefix: string,
  title: string,
  points: number,
  type: PointHistoryEntry['type']
): PointHistoryEntry => ({
  id: idPrefix + Date.now(),
  title,
  points,
  date: new Date().toLocaleDateString('ja-JP', POINT_HISTORY_DATE_FORMAT),
  type,
});

// 閾値に届かない場合は現在のレベルを維持する
export const calcLevel = (totalEarnedPoints: number, currentLevel: UserLevel): UserLevel =>
  LEVEL_THRESHOLDS.find((t) => totalEarnedPoints >= t.minTotalPoints)?.level ?? currentLevel;

export const toggleId = (ids: string[], id: string): string[] =>
  ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];

const randomBlock = () => Math.random().toString(36).substring(2, 6).toUpperCase();

export const generateGiftCode = () => `${GIFT_CODE_PREFIX}-${randomBlock()}-${randomBlock()}`;

// LP 閲覧済みを watchedAdIds 上で区別するためのキー
export const lpReadKey = (adId: string) => `lp-${adId}`;
