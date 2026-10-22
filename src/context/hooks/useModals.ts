import { useState } from 'react';
import { AdItem } from '../../types';

export const useModals = () => {
  const [activeLpAd, setActiveLpAd] = useState<AdItem | null>(null);
  const [isPointStoreOpen, setIsPointStoreOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isCommentsModalOpen, setIsCommentsModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  return {
    activeLpAd,
    setActiveLpAd,
    isPointStoreOpen,
    setIsPointStoreOpen,
    isAuthModalOpen,
    setIsAuthModalOpen,
    isCommentsModalOpen,
    setIsCommentsModalOpen,
    isShareModalOpen,
    setIsShareModalOpen,
  };
};
