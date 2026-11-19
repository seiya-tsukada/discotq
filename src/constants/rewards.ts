// 付与ポイント・必要秒数・レベル・ギフトはサーバー（backend/app/services/rewards.py）が正。
// ここの値は、視聴開始の応答が返るまでの表示にだけ使う
export const DEFAULT_WATCH_REWARD_POINTS = 10;
export const DEFAULT_MIN_WATCH_SECONDS = 5;

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
