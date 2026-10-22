import React from 'react';
import confetti from 'canvas-confetti';
import { AdItem, GiftItem, UserAccount } from '../../types';
import { CONFETTI_OPTIONS, DEFAULT_LP_READ_REWARD_POINTS } from '../../constants/rewards';
import { recordClick, recordView, updateAdById } from '../../lib/ads';
import { calcLevel, createHistoryEntry, generateGiftCode, lpReadKey } from '../../lib/user';
import { ShowNotification } from './useNotification';

export interface RewardResult {
  earned: boolean;
  points: number;
  isGuest: boolean;
}

export interface ExchangeResult {
  success: boolean;
  message: string;
  code?: string;
}

interface Deps {
  user: UserAccount;
  setUser: React.Dispatch<React.SetStateAction<UserAccount>>;
  ads: AdItem[];
  setAds: React.Dispatch<React.SetStateAction<AdItem[]>>;
  giftItems: GiftItem[];
  setIsAuthModalOpen: (open: boolean) => void;
  showNotification: ShowNotification;
}

export const triggerConfetti = () => {
  try {
    confetti(CONFETTI_OPTIONS);
  } catch {
    // ignore
  }
};

// 視聴・LP閲覧リワードの付与とギフト交換
export const useRewards = ({ user, setUser, ads, setAds, giftItems, setIsAuthModalOpen, showNotification }: Deps) => {
  const notEarned = (): RewardResult => ({ earned: false, points: 0, isGuest: !user.isLoggedIn });

  // ビジターはポイントをプールし、ウォレット開設時にまとめて受け取る
  const poolGuestPoints = (watchedKey: string, points: number, message: string): RewardResult => {
    setUser((prev) => ({
      ...prev,
      watchedAdIds: [...prev.watchedAdIds, watchedKey],
      unclaimedGuestPoints: prev.unclaimedGuestPoints + points,
    }));
    showNotification(message, points, 'info');
    return { earned: true, points, isGuest: true };
  };

  const claimAdWatchReward = (adId: string): RewardResult => {
    const ad = ads.find((a) => a.id === adId);
    if (!ad) return notEarned();

    setAds((prev) => updateAdById(prev, adId, recordView));

    if (user.watchedAdIds.includes(adId)) return notEarned();

    const earnedPoints = ad.rewardPoints;
    if (!user.isLoggedIn) {
      return poolGuestPoints(
        adId,
        earnedPoints,
        `視聴完了：${earnedPoints}pt がプールされました（ウォレット開設で受取可能）`
      );
    }

    triggerConfetti();
    setUser((prev) => {
      const newTotal = prev.totalEarnedPoints + earnedPoints;
      return {
        ...prev,
        points: prev.points + earnedPoints,
        totalEarnedPoints: newTotal,
        level: calcLevel(newTotal, prev.level),
        watchedAdIds: [...prev.watchedAdIds, adId],
        pointHistory: [
          createHistoryEntry('ph-', `視聴リワード: ${ad.brandName}`, earnedPoints, 'watch'),
          ...prev.pointHistory,
        ],
      };
    });

    showNotification(`リワード受取完了：+${earnedPoints}pt を獲得しました`, earnedPoints, 'success');
    return { earned: true, points: earnedPoints, isGuest: false };
  };

  const claimLpReadReward = (adId: string): RewardResult => {
    const ad = ads.find((a) => a.id === adId);
    if (!ad) return notEarned();

    setAds((prev) => updateAdById(prev, adId, recordClick));

    const lpKey = lpReadKey(adId);
    if (user.watchedAdIds.includes(lpKey)) return notEarned();

    const rewardPoints = ad.landingPage.readRewardPoints || DEFAULT_LP_READ_REWARD_POINTS;
    if (!user.isLoggedIn) {
      return poolGuestPoints(
        lpKey,
        rewardPoints,
        `詳細閲覧：${rewardPoints}pt がプールされました（ウォレット開設で受取可能）`
      );
    }

    // レベルの再計算は視聴リワード時のみ行う（既存挙動を維持）
    triggerConfetti();
    setUser((prev) => ({
      ...prev,
      points: prev.points + rewardPoints,
      totalEarnedPoints: prev.totalEarnedPoints + rewardPoints,
      watchedAdIds: [...prev.watchedAdIds, lpKey],
      pointHistory: [
        createHistoryEntry('ph-lp-', `サービス詳細閲覧リワード: ${ad.brandName}`, rewardPoints, 'lp_read'),
        ...prev.pointHistory,
      ],
    }));

    showNotification(`詳細閲覧リワード：+${rewardPoints}pt を獲得しました`, rewardPoints, 'success');
    return { earned: true, points: rewardPoints, isGuest: false };
  };

  const exchangePoints = (giftId: string): ExchangeResult => {
    if (!user.isLoggedIn) {
      setIsAuthModalOpen(true);
      return { success: false, message: 'リワードの交換にはウォレットアカウントが必要です' };
    }

    const gift = giftItems.find((g) => g.id === giftId);
    if (!gift) return { success: false, message: 'ギフトが見つかりませんでした' };

    if (user.points < gift.pointsCost) {
      return {
        success: false,
        message: `保有ポイントが不足しています（必要: ${gift.pointsCost}pt / 現在: ${user.points}pt）`,
      };
    }

    const generatedCode = generateGiftCode();

    setUser((prev) => ({
      ...prev,
      points: prev.points - gift.pointsCost,
      pointHistory: [
        createHistoryEntry('ph-ex-', `リワード交換: ${gift.name}`, -gift.pointsCost, 'exchange'),
        ...prev.pointHistory,
      ],
    }));

    triggerConfetti();
    showNotification(`${gift.name} との交換手続きが完了しました`, undefined, 'success');

    return { success: true, message: `${gift.name} の交換コードを発行しました`, code: generatedCode };
  };

  return { claimAdWatchReward, claimLpReadReward, exchangePoints };
};
