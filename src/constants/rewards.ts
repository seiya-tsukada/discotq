import { UserLevel } from '../types';

// 累計獲得ポイントによるレベル判定（上から順に評価）
export const LEVEL_THRESHOLDS: { minTotalPoints: number; level: UserLevel }[] = [
  { minTotalPoints: 2000, level: 'VIP' },
  { minTotalPoints: 800, level: 'ゴールド' },
  { minTotalPoints: 300, level: 'シルバー' },
];

export const WELCOME_BONUS_POINTS = 30;
export const DEFAULT_LP_READ_REWARD_POINTS = 10;

// LP を最下部まで読んだと判定する余白(px)
export const LP_READ_SCROLL_THRESHOLD_PX = 80;

export const GIFT_CODE_PREFIX = 'DISCOTQ';

export const CONFETTI_OPTIONS = {
  particleCount: 40,
  spread: 60,
  origin: { y: 0.7 },
  colors: ['#2563EB', '#3B82F6', '#10B981', '#0EA5E9', '#D97706'],
};

export const POINT_HISTORY_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};
