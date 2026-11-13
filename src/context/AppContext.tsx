import React, { createContext, useContext, useState } from 'react';
import { GiftItem, UserAccount, UserComment } from '../types';
import type { FeedVideo } from '../types/api';
import { GIFT_ITEMS } from '../data/gifts';
import { LOCAL_STORAGE_KEY_USER } from '../constants/storage';
import { createGuestUser } from '../constants/user';
import { useAuth } from './AuthContext';
import { usePersistentState } from './hooks/usePersistentState';
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
  comments: Record<string, UserComment[]>;
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

  // User Actions
  toggleLike: (videoId: string) => void;
  toggleBookmark: (videoId: string) => void;
  addComment: (videoId: string, text: string) => void;

  // Reward System
  claimWatchReward: (videoId: string, title: string) => RewardResult;
  exchangePoints: (giftId: string) => ExchangeResult;

  // Notifications
  notification: AppNotification | null;
  showNotification: ShowNotification;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuth();
  const [giftItems] = useState<GiftItem[]>(GIFT_ITEMS);
  const [wallet, setWallet] = usePersistentState<UserAccount>(LOCAL_STORAGE_KEY_USER, createGuestUser);

  const isLoggedIn = auth.user !== null;
  const displayName = auth.user?.display_name || auth.user?.email.split('@')[0] || wallet.name;
  const user: UserAccount = {
    ...wallet,
    isLoggedIn,
    name: isLoggedIn ? displayName : wallet.name,
    email: auth.user?.email ?? '',
  };

  const { notification, showNotification } = useNotification();
  const modals = useModals();
  const feed = useFeedState();
  const engagement = useEngagement({ user, isLoggedIn, displayName, setUser: setWallet, showNotification });
  const rewards = useRewards({
    user,
    isLoggedIn,
    setUser: setWallet,
    giftItems,
    setIsAuthModalOpen: modals.setIsAuthModalOpen,
    showNotification,
  });
  useAccount({
    authUser: auth.user,
    authReady: auth.status === 'ready',
    user: wallet,
    setUser: setWallet,
    showNotification,
  });

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
        giftItems,
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
