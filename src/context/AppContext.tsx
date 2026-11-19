import React, { createContext, useContext } from 'react';
import { GiftItem, PointHistoryEntry, UserAccount } from '../types';
import type { FeedVideo, StartViewResponse } from '../types/api';
import { GUEST_AVATAR_URL, GUEST_USER_NAME, MEMBER_AVATAR_URL } from '../constants/user';
import { useAuth } from './AuthContext';
import { AppNotification, ShowNotification, useNotification } from './hooks/useNotification';
import { useModals } from './hooks/useModals';
import { useFeedState } from './hooks/useFeedState';
import { useEngagement } from './hooks/useEngagement';
import { ExchangeResult, RewardResult, useRewards } from './hooks/useRewards';
import { useAccount } from './hooks/useAccount';

interface AppContextType {
  // Feed
  videos: FeedVideo[];
  currentVideo: FeedVideo | null;
  currentVideoIndex: number;
  setCurrentVideoIndex: (index: number) => void;
  hasMoreVideos: boolean;
  feedStatus: 'idle' | 'loading' | 'error';
  feedError: string | null;
  loadMoreVideos: () => Promise<void>;
  reloadFeed: () => void;

  // 視聴者（isLoggedIn / name / email はサーバーのログイン状態を反映）
  user: UserAccount;
  giftItems: GiftItem[];

  // Modals
  isPointStoreOpen: boolean;
  setIsPointStoreOpen: (open: boolean) => void;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  isCommentsModalOpen: boolean;
  setIsCommentsModalOpen: (open: boolean) => void;
  isShareModalOpen: boolean;
  setIsShareModalOpen: (open: boolean) => void;

  // いいね・保存（サーバーに保存）とコメント数の表示
  likedVideoIds: string[];
  bookmarkedVideoIds: string[];
  likeCountFor: (video: FeedVideo) => number;
  toggleLike: (video: FeedVideo) => Promise<void>;
  toggleBookmark: (video: FeedVideo) => Promise<void>;
  commentCountFor: (video: FeedVideo) => number;
  setCommentCount: (videoId: string, count: number) => void;

  // 視聴リワード（サーバーの point_ledger が正）
  claimedVideoIds: string[];
  startView: (videoId: string) => Promise<StartViewResponse>;
  claimWatchReward: (viewSessionId: string, videoId: string) => Promise<RewardResult>;
  exchangePoints: (giftId: string) => Promise<ExchangeResult>;
  pointHistory: PointHistoryEntry[];
  hasMoreHistory: boolean;
  historyStatus: 'idle' | 'loading' | 'error';
  loadHistory: (more?: boolean) => Promise<void>;

  // Notifications
  notification: AppNotification | null;
  showNotification: ShowNotification;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuth();
  const authUserId = auth.user?.id ?? null;
  const authReady = auth.status === 'ready';

  const { notification, showNotification } = useNotification();
  const modals = useModals();
  const feed = useFeedState();
  const engagement = useEngagement({ authUserId, authReady, showNotification });
  const { rewardSummary, applySummary, reloadRewards, ...rewards } = useRewards({
    authUserId,
    authReady,
    setIsAuthModalOpen: modals.setIsAuthModalOpen,
    showNotification,
  });
  useAccount({ authUserId, authReady, applySummary, reloadRewards, showNotification });

  const isLoggedIn = auth.user !== null;
  // サーバーの残高がログイン中の本人のものか（切り替わった直後は前の本人の値が残っている）
  const isOwnSummary = (rewardSummary.owner === 'user') === isLoggedIn;
  const balance = isOwnSummary ? rewardSummary.balance : 0;
  const user: UserAccount = {
    isLoggedIn,
    name: isLoggedIn ? auth.user?.display_name || auth.user?.email.split('@')[0] || '' : GUEST_USER_NAME,
    email: auth.user?.email ?? '',
    avatar: isLoggedIn ? MEMBER_AVATAR_URL : GUEST_AVATAR_URL,
    points: isLoggedIn ? balance : 0,
    totalEarnedPoints: isLoggedIn && isOwnSummary ? rewardSummary.total_earned : 0,
    unclaimedGuestPoints: isLoggedIn ? 0 : balance,
    level: isLoggedIn && isOwnSummary ? rewardSummary.level : 'ブロンズ',
  };

  const currentVideo = feed.videos[feed.currentVideoIndex] ?? feed.videos[0] ?? null;

  return (
    <AppContext.Provider
      value={{
        ...feed,
        ...modals,
        ...engagement,
        ...rewards,
        currentVideo,
        user,
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
