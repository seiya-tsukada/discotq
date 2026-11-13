import { useState } from 'react';

export const useModals = () => {
  const [isPointStoreOpen, setIsPointStoreOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isCommentsModalOpen, setIsCommentsModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  return {
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
