import React, { useState } from 'react';
import { AdItem, UserAccount, UserComment } from '../../types';
import { INITIAL_COMMENTS } from '../../data/mockAds';
import { GUEST_COMMENT_NAME } from '../../constants/user';
import { updateAdById } from '../../lib/ads';
import { ShowNotification } from './useNotification';

interface Deps {
  user: UserAccount;
  setUser: React.Dispatch<React.SetStateAction<UserAccount>>;
  setAds: React.Dispatch<React.SetStateAction<AdItem[]>>;
  showNotification: ShowNotification;
}

// いいね・保存・コメント
export const useEngagement = ({ user, setUser, setAds, showNotification }: Deps) => {
  const [comments, setComments] = useState<Record<string, UserComment[]>>(INITIAL_COMMENTS);

  const toggleLikeAd = (adId: string) => {
    const isLiked = user.likedAdIds.includes(adId);
    const updatedLikedIds = isLiked
      ? user.likedAdIds.filter((id) => id !== adId)
      : [...user.likedAdIds, adId];

    setUser((prev) => ({ ...prev, likedAdIds: updatedLikedIds }));
    setAds((prev) =>
      updateAdById(prev, adId, (ad) => ({
        ...ad,
        likesCount: isLiked ? Math.max(0, ad.likesCount - 1) : ad.likesCount + 1,
      }))
    );
  };

  const toggleBookmarkAd = (adId: string) => {
    const isBookmarked = user.bookmarkedAdIds.includes(adId);
    setUser((prev) => ({
      ...prev,
      bookmarkedAdIds: isBookmarked
        ? prev.bookmarkedAdIds.filter((id) => id !== adId)
        : [...prev.bookmarkedAdIds, adId],
    }));

    showNotification(isBookmarked ? '保存を解除しました' : '広告をマイリストに保存しました', undefined, 'info');
  };

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
    setAds((prev) => updateAdById(prev, adId, (ad) => ({ ...ad, commentsCount: ad.commentsCount + 1 })));

    showNotification('コメントを投稿しました', undefined, 'success');
  };

  return { comments, toggleLikeAd, toggleBookmarkAd, addComment };
};
