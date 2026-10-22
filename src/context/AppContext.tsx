import React, { createContext, useContext, useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  AdItem,
  UserAccount,
  GiftItem,
  UserComment,
  CreatorAccount,
  NotificationType,
  PointHistoryEntry,
} from '../types';
import { INITIAL_ADS, GIFT_ITEMS, INITIAL_COMMENTS, MOCK_CREATORS } from '../data/mockAds';
import { LOCAL_STORAGE_KEY_ADS, LOCAL_STORAGE_KEY_USER } from '../constants/storage';
import { NOTIFICATION_DURATION_MS } from '../constants/timing';
import {
  CONFETTI_OPTIONS,
  DEFAULT_LP_READ_REWARD_POINTS,
  GIFT_CODE_PREFIX,
  LEVEL_THRESHOLDS,
  POINT_HISTORY_DATE_FORMAT,
  WELCOME_BONUS_POINTS,
} from '../constants/rewards';
import {
  createGuestUser,
  DEFAULT_LOGIN_EMAIL,
  DEFAULT_LOGIN_NAME,
  GUEST_COMMENT_NAME,
  MEMBER_AVATAR_URL,
} from '../constants/user';
import {
  APPROVED_REVIEW_FEEDBACK,
  INITIAL_OPTIMIZATION,
  PENDING_REVIEW_FEEDBACK,
  REJECTED_REVIEW_FEEDBACK,
} from '../constants/ads';

interface AppContextType {
  ads: AdItem[];
  currentAdIndex: number;
  setCurrentAdIndex: (index: number) => void;
  user: UserAccount;
  comments: Record<string, UserComment[]>;
  giftItems: GiftItem[];
  creators: CreatorAccount[];
  
  // Modals
  activeLpAd: AdItem | null;
  openLpModal: (ad: AdItem) => void;
  closeLpModal: () => void;
  
  isPointStoreOpen: boolean;
  setIsPointStoreOpen: (open: boolean) => void;
  
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  
  isCommentsModalOpen: boolean;
  setIsCommentsModalOpen: (open: boolean) => void;
  
  isShareModalOpen: boolean;
  setIsShareModalOpen: (open: boolean) => void;
  
  // User Actions
  toggleLikeAd: (adId: string) => void;
  toggleBookmarkAd: (adId: string) => void;
  addComment: (adId: string, text: string) => void;
  
  // Reward System
  claimAdWatchReward: (adId: string) => { earned: boolean; points: number; isGuest: boolean };
  claimLpReadReward: (adId: string) => { earned: boolean; points: number; isGuest: boolean };
  exchangePoints: (giftId: string) => { success: boolean; message: string; code?: string };
  
  // Auth Actions
  login: (email?: string, name?: string) => void;
  logout: () => void;
  
  // Creator & Advertiser Actions
  createNewAd: (newAd: Omit<AdItem, 'id' | 'impressions' | 'views' | 'clicks' | 'budgetSpent' | 'createdAt' | 'likesCount' | 'commentsCount' | 'sharesCount' | 'reviewStatus'>) => void;
  updateAdCreative: (adId: string, updates: Partial<AdItem>) => void;
  toggleAdStatus: (adId: string) => void;
  deleteAd: (adId: string) => void;
  
  // Admin Actions
  updateAdReviewStatus: (adId: string, reviewStatus: 'approved' | 'rejected', feedback?: string) => void;
  
  // Notifications
  notification: { message: string; points?: number; type: NotificationType } | null;
  showNotification: (message: string, points?: number, type?: NotificationType) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const createHistoryEntry = (
  idPrefix: string,
  title: string,
  points: number,
  type: PointHistoryEntry['type']
): PointHistoryEntry => ({
  id: idPrefix + Date.now(),
  title,
  points,
  date: new Date().toLocaleDateString('ja-JP', POINT_HISTORY_DATE_FORMAT),
  type,
});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ads, setAds] = useState<AdItem[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_ADS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_ADS;
  });

  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [creators, setCreators] = useState<CreatorAccount[]>(MOCK_CREATORS);

  const [user, setUser] = useState<UserAccount>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_USER);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return createGuestUser();
  });

  const [comments, setComments] = useState<Record<string, UserComment[]>>(INITIAL_COMMENTS);
  const [giftItems] = useState<GiftItem[]>(GIFT_ITEMS);

  // Modals
  const [activeLpAd, setActiveLpAd] = useState<AdItem | null>(null);
  const [isPointStoreOpen, setIsPointStoreOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isCommentsModalOpen, setIsCommentsModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Toast Notifications
  const [notification, setNotification] = useState<{ message: string; points?: number; type: NotificationType } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_USER, JSON.stringify(user));
    } catch (e) {
      console.error(e);
    }
  }, [user]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_ADS, JSON.stringify(ads));
    } catch (e) {
      console.error(e);
    }
  }, [ads]);

  const showNotification = (message: string, points?: number, type: NotificationType = 'success') => {
    setNotification({ message, points, type });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === message ? null : prev));
    }, NOTIFICATION_DURATION_MS);
  };

  const triggerConfetti = () => {
    try {
      confetti(CONFETTI_OPTIONS);
    } catch {
      // ignore
    }
  };

  // Like Toggle
  const toggleLikeAd = (adId: string) => {
    const isLiked = user.likedAdIds.includes(adId);
    const updatedLikedIds = isLiked
      ? user.likedAdIds.filter((id) => id !== adId)
      : [...user.likedAdIds, adId];

    setUser((prev) => ({
      ...prev,
      likedAdIds: updatedLikedIds,
    }));

    setAds((prev) =>
      prev.map((ad) => {
        if (ad.id === adId) {
          return {
            ...ad,
            likesCount: isLiked ? Math.max(0, ad.likesCount - 1) : ad.likesCount + 1,
          };
        }
        return ad;
      })
    );
  };

  // Bookmark Toggle
  const toggleBookmarkAd = (adId: string) => {
    const isBookmarked = user.bookmarkedAdIds.includes(adId);
    setUser((prev) => ({
      ...prev,
      bookmarkedAdIds: isBookmarked
        ? prev.bookmarkedAdIds.filter((id) => id !== adId)
        : [...prev.bookmarkedAdIds, adId],
    }));

    showNotification(
      isBookmarked ? '保存を解除しました' : '広告をマイリストに保存しました',
      undefined,
      'info'
    );
  };

  // Add Comment
  const addComment = (adId: string, text: string) => {
    if (!text.trim()) return;
    const newComment: UserComment = {
      id: 'cmt-' + Date.now(),
      adId,
      userName: user.isLoggedIn ? user.name : GUEST_COMMENT_NAME,
      userAvatar: user.avatar,
      comment: text,
      likes: 0,
      timeAgo: 'たった今',
    };

    setComments((prev) => ({
      ...prev,
      [adId]: [newComment, ...(prev[adId] || [])],
    }));

    setAds((prev) =>
      prev.map((ad) => (ad.id === adId ? { ...ad, commentsCount: ad.commentsCount + 1 } : ad))
    );

    showNotification('コメントを投稿しました', undefined, 'success');
  };

  // Reward on Watch
  const claimAdWatchReward = (adId: string) => {
    const ad = ads.find((a) => a.id === adId);
    if (!ad) return { earned: false, points: 0, isGuest: !user.isLoggedIn };

    // Record view in ad stats
    setAds((prev) =>
      prev.map((a) =>
        a.id === adId
          ? {
              ...a,
              views: a.views + 1,
              budgetSpent: Math.min(a.totalBudget, a.budgetSpent + a.rewardPoints),
            }
          : a
      )
    );

    if (user.watchedAdIds.includes(adId)) {
      return { earned: false, points: 0, isGuest: !user.isLoggedIn };
    }

    if (!user.isLoggedIn) {
      setUser((prev) => ({
        ...prev,
        watchedAdIds: [...prev.watchedAdIds, adId],
        unclaimedGuestPoints: prev.unclaimedGuestPoints + ad.rewardPoints,
      }));
      showNotification(
        `視聴完了：${ad.rewardPoints}pt がプールされました（ウォレット開設で受取可能）`,
        ad.rewardPoints,
        'info'
      );
      return { earned: true, points: ad.rewardPoints, isGuest: true };
    }

    triggerConfetti();
    const earnedPoints = ad.rewardPoints;
    setUser((prev) => {
      const newPoints = prev.points + earnedPoints;
      const newTotal = prev.totalEarnedPoints + earnedPoints;
      const newLevel = LEVEL_THRESHOLDS.find((t) => newTotal >= t.minTotalPoints)?.level ?? prev.level;

      return {
        ...prev,
        points: newPoints,
        totalEarnedPoints: newTotal,
        level: newLevel,
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

  // Reward on LP Read
  const claimLpReadReward = (adId: string) => {
    const ad = ads.find((a) => a.id === adId);
    if (!ad) return { earned: false, points: 0, isGuest: !user.isLoggedIn };

    setAds((prev) =>
      prev.map((a) => (a.id === adId ? { ...a, clicks: a.clicks + 1 } : a))
    );

    const lpKey = `lp-${adId}`;
    if (user.watchedAdIds.includes(lpKey)) {
      return { earned: false, points: 0, isGuest: !user.isLoggedIn };
    }

    const rewardPoints = ad.landingPage.readRewardPoints || DEFAULT_LP_READ_REWARD_POINTS;

    if (!user.isLoggedIn) {
      setUser((prev) => ({
        ...prev,
        watchedAdIds: [...prev.watchedAdIds, lpKey],
        unclaimedGuestPoints: prev.unclaimedGuestPoints + rewardPoints,
      }));
      showNotification(
        `詳細閲覧：${rewardPoints}pt がプールされました（ウォレット開設で受取可能）`,
        rewardPoints,
        'info'
      );
      return { earned: true, points: rewardPoints, isGuest: true };
    }

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

  // Exchange Points for Gift
  const exchangePoints = (giftId: string) => {
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

    const generatedCode = GIFT_CODE_PREFIX + '-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();

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

    return {
      success: true,
      message: `${gift.name} の交換コードを発行しました`,
      code: generatedCode,
    };
  };

  // Auth
  const login = (email = DEFAULT_LOGIN_EMAIL, name = DEFAULT_LOGIN_NAME) => {
    const pooledPoints = user.unclaimedGuestPoints;
    const initialBonus = pooledPoints > 0 ? pooledPoints : WELCOME_BONUS_POINTS;

    setUser((prev) => ({
      ...prev,
      isLoggedIn: true,
      name,
      email,
      avatar: MEMBER_AVATAR_URL,
      points: prev.points + initialBonus,
      totalEarnedPoints: prev.totalEarnedPoints + initialBonus,
      unclaimedGuestPoints: 0,
      pointHistory: [
        createHistoryEntry('ph-login-', pooledPoints > 0 ? `ビジター視聴プール分の受取 (${pooledPoints}pt)` : `アカウント開設ウェルカムポイント (+${WELCOME_BONUS_POINTS}pt)`, initialBonus, 'bonus'),
        ...prev.pointHistory,
      ],
    }));

    triggerConfetti();
    setIsAuthModalOpen(false);
    showNotification(
      `リワードウォレットを開設しました（${initialBonus}pt 付与）`,
      initialBonus,
      'success'
    );
  };

  const logout = () => {
    setUser(createGuestUser());
    showNotification('ログアウトしました（ビジターモード）', undefined, 'info');
  };

  // LP Open
  const openLpModal = (ad: AdItem) => {
    setActiveLpAd(ad);
    setAds((prev) =>
      prev.map((a) => (a.id === ad.id ? { ...a, clicks: a.clicks + 1 } : a))
    );
  };

  const closeLpModal = () => {
    setActiveLpAd(null);
  };

  // Creator & Advertiser Actions
  const createNewAd = (newAdData: Omit<AdItem, 'id' | 'impressions' | 'views' | 'clicks' | 'budgetSpent' | 'createdAt' | 'likesCount' | 'commentsCount' | 'sharesCount' | 'reviewStatus'>) => {
    const newAd: AdItem = {
      ...newAdData,
      id: 'ad-' + Date.now(),
      impressions: 1,
      views: 0,
      clicks: 0,
      budgetSpent: 0,
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      reviewStatus: 'pending', // Submitted to admin review
      reviewFeedback: PENDING_REVIEW_FEEDBACK,
      optimization: INITIAL_OPTIMIZATION,
      createdAt: new Date().toISOString().split('T')[0],
    };

    setAds((prev) => [newAd, ...prev]);
    showNotification(`広告「${newAd.title}」をアップロード・申請しました（審査中）`, undefined, 'success');
  };

  const updateAdCreative = (adId: string, updates: Partial<AdItem>) => {
    setAds((prev) =>
      prev.map((ad) => (ad.id === adId ? { ...ad, ...updates } : ad))
    );
    showNotification('広告設定を更新しました', undefined, 'success');
  };

  const toggleAdStatus = (adId: string) => {
    setAds((prev) =>
      prev.map((ad) =>
        ad.id === adId
          ? { ...ad, status: ad.status === 'active' ? 'paused' : 'active' }
          : ad
      )
    );
  };

  const deleteAd = (adId: string) => {
    setAds((prev) => prev.filter((ad) => ad.id !== adId));
    showNotification('広告を削除しました', undefined, 'info');
  };

  // Admin Actions
  const updateAdReviewStatus = (adId: string, reviewStatus: 'approved' | 'rejected', feedback?: string) => {
    setAds((prev) =>
      prev.map((ad) => {
        if (ad.id === adId) {
          return {
            ...ad,
            reviewStatus,
            reviewFeedback: feedback || (reviewStatus === 'approved' ? APPROVED_REVIEW_FEEDBACK : REJECTED_REVIEW_FEEDBACK),
            status: reviewStatus === 'approved' ? 'active' : 'paused',
          };
        }
        return ad;
      })
    );
    showNotification(
      reviewStatus === 'approved' ? '広告を承認し配信開始しました' : '広告を差戻ししました',
      undefined,
      reviewStatus === 'approved' ? 'success' : 'warning'
    );
  };

  return (
    <AppContext.Provider
      value={{
        ads,
        currentAdIndex,
        setCurrentAdIndex,
        user,
        comments,
        giftItems,
        creators,
        activeLpAd,
        openLpModal,
        closeLpModal,
        isPointStoreOpen,
        setIsPointStoreOpen,
        isAuthModalOpen,
        setIsAuthModalOpen,
        isCommentsModalOpen,
        setIsCommentsModalOpen,
        isShareModalOpen,
        setIsShareModalOpen,
        toggleLikeAd,
        toggleBookmarkAd,
        addComment,
        claimAdWatchReward,
        claimLpReadReward,
        exchangePoints,
        login,
        logout,
        createNewAd,
        updateAdCreative,
        toggleAdStatus,
        deleteAd,
        updateAdReviewStatus,
        notification,
        showNotification,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
