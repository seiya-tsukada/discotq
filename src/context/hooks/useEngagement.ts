import React, { useState } from 'react';
import { UserAccount, UserComment } from '../../types';
import { GUEST_COMMENT_NAME } from '../../constants/user';
import { toggleId } from '../../lib/user';
import { ShowNotification } from './useNotification';

interface Deps {
  user: UserAccount;
  isLoggedIn: boolean;
  displayName: string;
  setUser: React.Dispatch<React.SetStateAction<UserAccount>>;
  showNotification: ShowNotification;
}

// いいね・保存・コメント（現状は端末内のみで保持し、サーバーには送らない）
export const useEngagement = ({ user, isLoggedIn, displayName, setUser, showNotification }: Deps) => {
  const [comments, setComments] = useState<Record<string, UserComment[]>>({});

  const toggleLike = (videoId: string) => {
    setUser((prev) => ({ ...prev, likedAdIds: toggleId(prev.likedAdIds, videoId) }));
  };

  const toggleBookmark = (videoId: string) => {
    const isBookmarked = user.bookmarkedAdIds.includes(videoId);
    setUser((prev) => ({ ...prev, bookmarkedAdIds: toggleId(prev.bookmarkedAdIds, videoId) }));
    showNotification(isBookmarked ? '保存を解除しました' : '動画をマイリストに保存しました', undefined, 'info');
  };

  const addComment = (videoId: string, text: string) => {
    if (!text.trim()) return;
    const newComment: UserComment = {
      id: 'cmt-' + Date.now(),
      videoId,
      userName: isLoggedIn ? displayName : GUEST_COMMENT_NAME,
      userAvatar: user.avatar,
      comment: text,
      likes: 0,
      timeAgo: 'たった今',
    };
    setComments((prev) => ({ ...prev, [videoId]: [newComment, ...(prev[videoId] || [])] }));
    showNotification('コメントを投稿しました', undefined, 'success');
  };

  return { comments, toggleLike, toggleBookmark, addComment };
};
