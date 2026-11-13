import { UserLevel } from '../types';

// 累計獲得ポイントによるレベル判定（上から順に評価）
export const LEVEL_THRESHOLDS: { minTotalPoints: number; level: UserLevel }[] = [
  { minTotalPoints: 2000, level: 'VIP' },
  { minTotalPoints: 800, level: 'ゴールド' },
  { minTotalPoints: 300, level: 'シルバー' },
];

export const WELCOME_BONUS_POINTS = 30;
// 動画1本の視聴リワード（動画ごとの設定は持たないため一律）
export const DEFAULT_WATCH_REWARD_POINTS = 10;
// リワード受取に必要な最低視聴秒数（動画がこれより短い場合は動画の長さ）
export const DEFAULT_MIN_WATCH_SECONDS = 5;

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
