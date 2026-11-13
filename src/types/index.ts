export type UserLevel = 'ブロンズ' | 'シルバー' | 'ゴールド' | 'VIP';

export type NotificationType = 'success' | 'info' | 'warning';

export interface UserComment {
  id: string;
  videoId: string;
  userName: string;
  userAvatar: string;
  comment: string;
  likes: number;
  timeAgo: string;
}

// 端末に保存する視聴者のリワード状態。isLoggedIn は「ウォレット開設済み」の印として使い、
// 実際のログイン状態は AuthContext（サーバーのセッション）を正とする
export interface UserAccount {
  isLoggedIn: boolean;
  id: string;
  name: string;
  email: string;
  avatar: string;
  points: number;
  totalEarnedPoints: number;
  unclaimedGuestPoints: number;
  level: UserLevel;
  // 互換性のためキー名は広告時代のまま。中身は動画ID
  watchedAdIds: string[];
  likedAdIds: string[];
  bookmarkedAdIds: string[];
  pointHistory: PointHistoryEntry[];
}

export interface PointHistoryEntry {
  id: string;
  title: string;
  points: number;
  date: string;
  type: 'watch' | 'lp_read' | 'exchange' | 'bonus';
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
