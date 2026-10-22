import React, { createContext, useContext, useState } from 'react';
import { AdItem, UserAccount, GiftItem, UserComment, CreatorAccount } from '../types';
import { GIFT_ITEMS, MOCK_CREATORS } from '../data/mockAds';
import { LOCAL_STORAGE_KEY_USER } from '../constants/storage';
import { createGuestUser } from '../constants/user';
import { NewAdInput, ReviewDecision, recordClick, updateAdById } from '../lib/ads';
import { usePersistentState } from './hooks/usePersistentState';
import { AppNotification, ShowNotification, useNotification } from './hooks/useNotification';
import { useModals } from './hooks/useModals';
import { useAdsState } from './hooks/useAdsState';
import { useEngagement } from './hooks/useEngagement';
import { ExchangeResult, RewardResult, useRewards } from './hooks/useRewards';
import { useAccount } from './hooks/useAccount';

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
  claimAdWatchReward: (adId: string) => RewardResult;
  claimLpReadReward: (adId: string) => RewardResult;
  exchangePoints: (giftId: string) => ExchangeResult;

  // Auth Actions
  login: (email?: string, name?: string) => void;
  logout: () => void;

  // Creator & Advertiser Actions
  createNewAd: (newAd: NewAdInput) => void;
  updateAdCreative: (adId: string, updates: Partial<AdItem>) => void;
  toggleAdStatus: (adId: string) => void;
  deleteAd: (adId: string) => void;

  // Admin Actions
  updateAdReviewStatus: (adId: string, reviewStatus: ReviewDecision, feedback?: string) => void;

  // Notifications
  notification: AppNotification | null;
  showNotification: ShowNotification;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [creators] = useState<CreatorAccount[]>(MOCK_CREATORS);
  const [giftItems] = useState<GiftItem[]>(GIFT_ITEMS);
  const [user, setUser] = usePersistentState<UserAccount>(LOCAL_STORAGE_KEY_USER, createGuestUser);

  const { notification, showNotification } = useNotification();
  const { setActiveLpAd, ...modals } = useModals();
  const { setAds, ...adsState } = useAdsState(showNotification);
  const { ads } = adsState;

  const engagement = useEngagement({ user, setUser, setAds, showNotification });
  const rewards = useRewards({
    user,
    setUser,
    ads,
    setAds,
    giftItems,
    setIsAuthModalOpen: modals.setIsAuthModalOpen,
    showNotification,
  });
  const account = useAccount({
    user,
    setUser,
    setIsAuthModalOpen: modals.setIsAuthModalOpen,
    showNotification,
  });

  // LP を開いた時点でクリックとして計上する
  const openLpModal = (ad: AdItem) => {
    setActiveLpAd(ad);
    setAds((prev) => updateAdById(prev, ad.id, recordClick));
  };

  const closeLpModal = () => {
    setActiveLpAd(null);
  };

  return (
    <AppContext.Provider
      value={{
        ...adsState,
        ...modals,
        ...engagement,
        ...rewards,
        ...account,
        currentAdIndex,
        setCurrentAdIndex,
        user,
        giftItems,
        creators,
        openLpModal,
        closeLpModal,
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
