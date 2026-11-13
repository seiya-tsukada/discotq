import React from 'react';
import confetti from 'canvas-confetti';
import { GiftItem, UserAccount } from '../../types';
import { CONFETTI_OPTIONS, DEFAULT_WATCH_REWARD_POINTS } from '../../constants/rewards';
import { calcLevel, createHistoryEntry, generateGiftCode } from '../../lib/user';
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
  isLoggedIn: boolean;
  setUser: React.Dispatch<React.SetStateAction<UserAccount>>;
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

// 視聴リワードの付与とギフト交換（デモ: 端末内で管理）
export const useRewards = ({ user, isLoggedIn, setUser, giftItems, setIsAuthModalOpen, showNotification }: Deps) => {
  const claimWatchReward = (videoId: string, title: string): RewardResult => {
    if (user.watchedAdIds.includes(videoId)) return { earned: false, points: 0, isGuest: !isLoggedIn };

    const earnedPoints = DEFAULT_WATCH_REWARD_POINTS;
    if (!isLoggedIn) {
      // ビジターはポイントをプールし、ログイン時にまとめて受け取る
      setUser((prev) => ({
        ...prev,
        watchedAdIds: [...prev.watchedAdIds, videoId],
        unclaimedGuestPoints: prev.unclaimedGuestPoints + earnedPoints,
      }));
      showNotification(`視聴完了：${earnedPoints}pt がプールされました（ログインで受取可能）`, earnedPoints, 'info');
      return { earned: true, points: earnedPoints, isGuest: true };
    }

    triggerConfetti();
    setUser((prev) => {
      const newTotal = prev.totalEarnedPoints + earnedPoints;
      return {
        ...prev,
        points: prev.points + earnedPoints,
        totalEarnedPoints: newTotal,
        level: calcLevel(newTotal, prev.level),
        watchedAdIds: [...prev.watchedAdIds, videoId],
        pointHistory: [
          createHistoryEntry('ph-', `視聴リワード: ${title || '動画'}`, earnedPoints, 'watch'),
          ...prev.pointHistory,
        ],
      };
    });
    showNotification(`リワード受取完了：+${earnedPoints}pt を獲得しました`, earnedPoints, 'success');
    return { earned: true, points: earnedPoints, isGuest: false };
  };

  const exchangePoints = (giftId: string): ExchangeResult => {
    if (!isLoggedIn) {
      setIsAuthModalOpen(true);
      return { success: false, message: 'リワードの交換にはログインが必要です' };
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

  return { claimWatchReward, exchangePoints };
};
