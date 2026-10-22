import { AdCategory, AdOptimizationMetrics } from '../types';

export const DEFAULT_COUPON_CODE = 'DISCOTQ2026';
export const DEFAULT_OFFER_EXPIRES_AT = '2026年12月末まで';
export const DEFAULT_MIN_WATCH_SECONDS = 5;

export const PENDING_REVIEW_FEEDBACK = 'プラットフォーム運営者による初回審査待ちです。通常数分以内に確認されます。';
export const APPROVED_REVIEW_FEEDBACK = '公認基準をクリアし、フィード配信承認されました。';
export const REJECTED_REVIEW_FEEDBACK = '表現ガイドラインに基づき差戻しされました。修正の上再提出してください。';

// 新規入稿広告に付与する初期のクリエイティブ診断値
export const INITIAL_OPTIMIZATION: AdOptimizationMetrics = {
  creativeScore: 82,
  hookRate: 68,
  retentionCurve: [100, 80, 68, 62, 58, 55],
  benchmarkComparison: '同カテゴリ基準値内',
  suggestedImprovements: [
    {
      type: 'hook',
      title: '冒頭テロップの視認性向上',
      description: '動画開始直後のメッセージを簡潔にまとめると、離脱を低減できます。',
      expectedLift: '完走率 +5%',
    },
  ],
};

export const PRESET_CREATIVES: {
  name: string;
  url: string;
  poster: string;
  category: AdCategory;
}[] = [
  {
    name: '製品・ハードウェア (高精細動画)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    poster: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
    category: 'ガジェット・家電',
  },
  {
    name: 'ビジネスIT・SaaS (アニメーション)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    poster: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80',
    category: 'ガジェット・家電',
  },
  {
    name: 'ライフスタイル・ウェルネス',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
    poster: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80',
    category: 'グルメ・食品',
  },
];

// クリエイターポータルの入稿フォーム初期値
export const CREATOR_FORM_DEFAULTS = {
  brandName: 'BOTANICAL LAB Tokyo',
  brandLogo: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=100&auto=format&fit=crop&q=80',
  category: 'コスメ・美容' as AdCategory,
  tags: '#新作 #おすすめ #限定優待',
  ctaText: '公式サイトで詳細・仕様を見る',
  rewardPoints: 20,
  budget: 50000,
  externalUrl: 'https://example.com/official-offer',
  couponCode: 'DISCOTQ-OFFER',
  discountText: '公式ストア限定 20% 優待適用',
  uploadedPosterUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
  fallbackExternalUrl: 'https://example.com',
  fallbackTag: '#公式プロモーション',
  advertiserId: 'creator-current',
  creatorEmail: 'creator@business.example.com',
};
