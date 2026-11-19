// いいね数などの件数表示。1万以上は「1.2万」のように縮める
export const formatCount = (n: number): string => {
  if (n < 10_000) return String(n);
  const man = Math.floor(n / 1_000) / 10;
  return `${Number.isInteger(man) ? man.toFixed(0) : man.toFixed(1)}万`;
};

// コメントの投稿日時。1分未満「たった今」→ 分 → 時間 → 日（7日まで）→ 日付
export const formatTimeAgo = (iso: string, now: Date = new Date()): string => {
  const at = new Date(iso);
  const sec = Math.max(0, Math.floor((now.getTime() - at.getTime()) / 1000));
  if (sec < 60) return 'たった今';
  if (sec < 3600) return `${Math.floor(sec / 60)}分前`;
  if (sec < 86_400) return `${Math.floor(sec / 3600)}時間前`;
  if (sec < 7 * 86_400) return `${Math.floor(sec / 86_400)}日前`;
  const sameYear = at.getFullYear() === now.getFullYear();
  return sameYear
    ? `${at.getMonth() + 1}月${at.getDate()}日`
    : `${at.getFullYear()}年${at.getMonth() + 1}月${at.getDate()}日`;
};
