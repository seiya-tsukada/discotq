import React, { createContext, useContext, useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { AdItem, UserAccount, GiftItem, UserComment, CreatorAccount } from '../types';
import { INITIAL_ADS, GIFT_ITEMS, INITIAL_COMMENTS, MOCK_CREATORS } from '../data/mockAds';

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
  
  isAdvertiserPortalOpen: boolean;
  setIsAdvertiserPortalOpen: (open: boolean) => void;
  
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
  notification: { message: string; points?: number; type: 'success' | 'info' | 'warning' } | null;
  showNotification: (message: string, points?: number, type?: 'success' | 'info' | 'warning') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_USER = 'adtok_user_v3';
const LOCAL_STORAGE_KEY_ADS = 'adtok_ads_v3';

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
    return {
      isLoggedIn: false,
      id: 'guest-' + Math.random().toString(36).substring(2, 9),
      name: 'ビジターユーザー',
      email: '',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      points: 0,
      totalEarnedPoints: 0,
      unclaimedGuestPoints: 0,
      level: 'ブロンズ',
      watchedAdIds: [],
      likedAdIds: [],
      bookmarkedAdIds: [],
      pointHistory: [],
    };
  });

  const [comments, setComments] = useState<Record<string, UserComment[]>>(INITIAL_COMMENTS);
  const [giftItems] = useState<GiftItem[]>(GIFT_ITEMS);

  // Modals
  const [activeLpAd, setActiveLpAd] = useState<AdItem | null>(null);
  const [isPointStoreOpen, setIsPointStoreOpen] = useState(false);
  const [isAdvertiserPortalOpen, setIsAdvertiserPortalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isCommentsModalOpen, setIsCommentsModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Toast Notifications
  const [notification, setNotification] = useState<{ message: string; points?: number; type: 'success' | 'info' | 'warning' } | null>(null);

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

  const showNotification = (message: string, points?: number, type: 'success' | 'info' | 'warning' = 'success') => {
    setNotification({ message, points, type });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  };

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#2563EB', '#3B82F6', '#10B981', '#0EA5E9', '#D97706'],
      });
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
      userName: user.isLoggedIn ? user.name : 'ビジター',
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
      let newLevel = prev.level;
      if (newTotal >= 2000) newLevel = 'VIP';
      else if (newTotal >= 800) newLevel = 'ゴールド';
      else if (newTotal >= 300) newLevel = 'シルバー';

      return {
        ...prev,
        points: newPoints,
        totalEarnedPoints: newTotal,
        level: newLevel,
        watchedAdIds: [...prev.watchedAdIds, adId],
        pointHistory: [
          {
            id: 'ph-' + Date.now(),
            title: `視聴リワード: ${ad.brandName}`,
            points: earnedPoints,
            date: new Date().toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
            type: 'watch',
          },
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

    const rewardPoints = ad.landingPage.readRewardPoints || 10;

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
        {
          id: 'ph-lp-' + Date.now(),
          title: `サービス詳細閲覧リワード: ${ad.brandName}`,
          points: rewardPoints,
          date: new Date().toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          type: 'lp_read',
        },
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

    const generatedCode = 'ADTOK-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();

    setUser((prev) => ({
      ...prev,
      points: prev.points - gift.pointsCost,
      pointHistory: [
        {
          id: 'ph-ex-' + Date.now(),
          title: `リワード交換: ${gift.name}`,
          points: -gift.pointsCost,
          date: new Date().toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          type: 'exchange',
        },
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
  const login = (email = 'user@business.example.com', name = 'ビジネスメンバー') => {
    const pooledPoints = user.unclaimedGuestPoints;
    const initialBonus = pooledPoints > 0 ? pooledPoints : 30;

    setUser((prev) => ({
      ...prev,
      isLoggedIn: true,
      name,
      email,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
      points: prev.points + initialBonus,
      totalEarnedPoints: prev.totalEarnedPoints + initialBonus,
      unclaimedGuestPoints: 0,
      pointHistory: [
        {
          id: 'ph-login-' + Date.now(),
          title: pooledPoints > 0 ? `ビジター視聴プール分の受取 (${pooledPoints}pt)` : 'アカウント開設ウェルカムポイント (+30pt)',
          points: initialBonus,
          date: new Date().toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          type: 'bonus',
        },
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
    setUser({
      isLoggedIn: false,
      id: 'guest-' + Math.random().toString(36).substring(2, 9),
      name: 'ビジターユーザー',
      email: '',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      points: 0,
      totalEarnedPoints: 0,
      unclaimedGuestPoints: 0,
      level: 'ブロンズ',
      watchedAdIds: [],
      likedAdIds: [],
      bookmarkedAdIds: [],
      pointHistory: [],
    });
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
      reviewFeedback: 'プラットフォーム運営者による初回審査待ちです。通常数分以内に確認されます。',
      optimization: {
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
      },
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
            reviewFeedback: feedback || (reviewStatus === 'approved' ? '公認基準をクリアし、フィード配信承認されました。' : '表現ガイドラインに基づき差戻しされました。修正の上再提出してください。'),
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
        isAdvertiserPortalOpen,
        setIsAdvertiserPortalOpen,
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
