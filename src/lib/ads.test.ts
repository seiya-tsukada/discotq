import { describe, expect, it } from 'vitest';
import { INITIAL_ADS } from '../data/mockAds';
import { APPROVED_REVIEW_FEEDBACK, PENDING_REVIEW_FEEDBACK, REJECTED_REVIEW_FEEDBACK } from '../constants/ads';
import { applyReviewDecision, buildNewAd, recordClick, recordView, updateAdById } from './ads';

const baseAd = INITIAL_ADS[0];

describe('updateAdById', () => {
  it('対象の広告だけを更新する', () => {
    const ads = INITIAL_ADS.slice(0, 2);
    const result = updateAdById(ads, ads[1].id, (ad) => ({ ...ad, title: 'updated' }));
    expect(result[0]).toBe(ads[0]);
    expect(result[1].title).toBe('updated');
  });
});

describe('recordView', () => {
  it('再生数を加算し、リワード分を消化予算に計上する', () => {
    const ad = { ...baseAd, views: 10, budgetSpent: 100, totalBudget: 1000, rewardPoints: 20 };
    expect(recordView(ad)).toMatchObject({ views: 11, budgetSpent: 120 });
  });

  it('消化予算は総予算を超えない', () => {
    const ad = { ...baseAd, budgetSpent: 990, totalBudget: 1000, rewardPoints: 20 };
    expect(recordView(ad).budgetSpent).toBe(1000);
  });
});

describe('recordClick', () => {
  it('クリック数を加算する', () => {
    expect(recordClick({ ...baseAd, clicks: 3 }).clicks).toBe(4);
  });
});

describe('applyReviewDecision', () => {
  it('承認すると配信中になり、既定のフィードバックが入る', () => {
    const ad = applyReviewDecision({ ...baseAd, status: 'paused' }, 'approved');
    expect(ad).toMatchObject({ reviewStatus: 'approved', status: 'active', reviewFeedback: APPROVED_REVIEW_FEEDBACK });
  });

  it('差戻しすると停止し、入力したフィードバックが優先される', () => {
    expect(applyReviewDecision(baseAd, 'rejected')).toMatchObject({
      reviewStatus: 'rejected',
      status: 'paused',
      reviewFeedback: REJECTED_REVIEW_FEEDBACK,
    });
    expect(applyReviewDecision(baseAd, 'rejected', '修正してください').reviewFeedback).toBe('修正してください');
  });
});

describe('buildNewAd', () => {
  it('実績値をリセットし、審査待ちで作成する', () => {
    const ad = buildNewAd(baseAd);
    expect(ad.id).toMatch(/^ad-\d+$/);
    expect(ad).toMatchObject({
      impressions: 1,
      views: 0,
      clicks: 0,
      budgetSpent: 0,
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      reviewStatus: 'pending',
      reviewFeedback: PENDING_REVIEW_FEEDBACK,
    });
    expect(ad.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
