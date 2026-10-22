import { UserAccount } from '../types';

export const GUEST_AVATAR_URL =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80';
export const MEMBER_AVATAR_URL =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80';

export const GUEST_USER_NAME = 'ビジターユーザー';
export const GUEST_COMMENT_NAME = 'ビジター';

export const DEFAULT_LOGIN_EMAIL = 'user@business.example.com';
export const DEFAULT_LOGIN_NAME = 'ビジネスメンバー';

export const createGuestUser = (): UserAccount => ({
  isLoggedIn: false,
  id: 'guest-' + Math.random().toString(36).substring(2, 9),
  name: GUEST_USER_NAME,
  email: '',
  avatar: GUEST_AVATAR_URL,
  points: 0,
  totalEarnedPoints: 0,
  unclaimedGuestPoints: 0,
  level: 'ブロンズ',
  watchedAdIds: [],
  likedAdIds: [],
  bookmarkedAdIds: [],
  pointHistory: [],
});
