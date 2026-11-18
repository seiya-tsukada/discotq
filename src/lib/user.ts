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

// on なら追加（重複させない）、off なら除去する
export const setIdIn = (ids: string[], id: string, on: boolean): string[] => {
  const without = ids.filter((x) => x !== id);
  return on ? [id, ...without] : without;
};

const randomBlock = () => Math.random().toString(36).substring(2, 6).toUpperCase();

export const generateGiftCode = () => `${GIFT_CODE_PREFIX}-${randomBlock()}-${randomBlock()}`;
