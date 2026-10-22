import { AdItem } from '../types';
import {
  APPROVED_REVIEW_FEEDBACK,
  INITIAL_OPTIMIZATION,
  PENDING_REVIEW_FEEDBACK,
  REJECTED_REVIEW_FEEDBACK,
} from '../constants/ads';

export type NewAdInput = Omit<
  AdItem,
  | 'id'
  | 'impressions'
  | 'views'
  | 'clicks'
  | 'budgetSpent'
  | 'createdAt'
  | 'likesCount'
  | 'commentsCount'
  | 'sharesCount'
  | 'reviewStatus'
>;

export type ReviewDecision = 'approved' | 'rejected';

export const updateAdById = (ads: AdItem[], adId: string, update: (ad: AdItem) => AdItem): AdItem[] =>
  ads.map((ad) => (ad.id === adId ? update(ad) : ad));

export const buildNewAd = (input: NewAdInput): AdItem => ({
  ...input,
  id: 'ad-' + Date.now(),
  impressions: 1,
  views: 0,
  clicks: 0,
  budgetSpent: 0,
  likesCount: 0,
  commentsCount: 0,
  sharesCount: 0,
  reviewStatus: 'pending',
  reviewFeedback: PENDING_REVIEW_FEEDBACK,
  optimization: INITIAL_OPTIMIZATION,
  createdAt: new Date().toISOString().split('T')[0],
});

export const applyReviewDecision = (ad: AdItem, decision: ReviewDecision, feedback?: string): AdItem => ({
  ...ad,
  reviewStatus: decision,
  reviewFeedback: feedback || (decision === 'approved' ? APPROVED_REVIEW_FEEDBACK : REJECTED_REVIEW_FEEDBACK),
  status: decision === 'approved' ? 'active' : 'paused',
});

// 視聴完了時: 再生数を加算し、リワード分を消化予算に計上（総予算が上限）
export const recordView = (ad: AdItem): AdItem => ({
  ...ad,
  views: ad.views + 1,
  budgetSpent: Math.min(ad.totalBudget, ad.budgetSpent + ad.rewardPoints),
});

export const recordClick = (ad: AdItem): AdItem => ({ ...ad, clicks: ad.clicks + 1 });
