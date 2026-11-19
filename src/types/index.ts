export type UserLevel = 'ブロンズ' | 'シルバー' | 'ゴールド' | 'VIP';

export type NotificationType = 'success' | 'info' | 'warning';

// 画面に出す視聴者の情報。ポイントはサーバーの point_ledger の集計（/api/me/rewards）
// ログイン中は points がアカウントの残高、未ログインは unclaimedGuestPoints が端末の匿名IDに貯まった受取待ちの分
export interface UserAccount {
  isLoggedIn: boolean;
  name: string;
  email: string;
  avatar: string;
  points: number;
  totalEarnedPoints: number;
  unclaimedGuestPoints: number;
  level: UserLevel;
}

export type LedgerKind = 'watch' | 'welcome' | 'guest_transfer_out' | 'exchange' | 'adjustment';

export interface PointHistoryEntry {
  id: string;
  title: string;
  points: number;
  date: string;
  kind: LedgerKind;
  giftCode: string | null;
}

export interface GiftItem {
  id: string;
  name: string;
  brand: string;
  pointsCost: number;
  iconUrl: string;
  category: string;
  stock: number;
  popular?: boolean;
  valueDescription: string;
}
