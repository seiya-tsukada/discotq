export type AdCategory =
  'コスメ・美容' | 'ガジェット・家電' | 'グルメ・食品' | 'アプリ・ゲーム' | 'ライフスタイル・旅行' | 'ファッション';

export type UserLevel = 'ブロンズ' | 'シルバー' | 'ゴールド' | 'VIP';

export type NotificationType = 'success' | 'info' | 'warning';

export interface AdLandingPage {
  heroImage: string;
  subTitle: string;
  keyFeatures: { title: string; desc: string; icon: string }[];
  specialOffer?: {
    couponCode: string;
    discount: string;
    expiresAt: string;
  };
  reviews: { name: string; avatar: string; rating: number; comment: string }[];
  faqs: { q: string; a: string }[];
  externalUrl: string;
  ctaButtonText: string;
  readRewardPoints: number;
}

export interface AdOptimizationMetrics {
  creativeScore: number; // 0 - 100
  hookRate: number; // 最初の2秒視聴維持率 %
  retentionCurve: number[]; // 秒ごとの維持率
  benchmarkComparison: string; // "同カテゴリ平均比 +18%"
  suggestedImprovements: {
    type: 'hook' | 'cta' | 'lp' | 'reward';
    title: string;
    description: string;
    expectedLift: string;
  }[];
}

export interface AdItem {
  id: string;
  brandName: string;
  brandLogo: string;
  verified: boolean;
  title: string;
  description: string;
  tags: string[];
  videoUrl: string;
  posterUrl: string;
  category: AdCategory;
  ctaText: string;
  ctaType: 'primary' | 'secondary' | 'accent';
  rewardPoints: number;
  minWatchSeconds: number;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  soundName: string;
  soundAuthor: string;
  landingPage: AdLandingPage;
  advertiserId: string;
  creatorName?: string;
  creatorEmail?: string;
  impressions: number;
  views: number;
  clicks: number;
  budgetSpent: number;
  totalBudget: number;
  status: 'active' | 'paused' | 'completed';
  reviewStatus: 'pending' | 'approved' | 'rejected';
  reviewFeedback?: string;
  optimization?: AdOptimizationMetrics;
  createdAt: string;
}

export interface CreatorAccount {
  id: string;
  name: string;
  companyName: string;
  email: string;
  avatar: string;
  totalAdsCreated: number;
  totalBudgetSpent: number;
  totalImpressions: number;
  averageCtr: number;
  averageViewRate: number;
  tier: 'プロフェッショナル' | 'エンタープライズ' | '公認クリエイター';
  status: 'active' | 'under_review' | 'restricted';
  joinedAt: string;
}

export interface UserComment {
  id: string;
  adId: string;
  userName: string;
  userAvatar: string;
  comment: string;
  likes: number;
  timeAgo: string;
  isSponsorReply?: boolean;
}

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
