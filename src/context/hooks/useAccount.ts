import React from 'react';
import { UserAccount } from '../../types';
import { WELCOME_BONUS_POINTS } from '../../constants/rewards';
import { createGuestUser, DEFAULT_LOGIN_EMAIL, DEFAULT_LOGIN_NAME, MEMBER_AVATAR_URL } from '../../constants/user';
import { createHistoryEntry } from '../../lib/user';
import { ShowNotification } from './useNotification';
import { triggerConfetti } from './useRewards';

interface Deps {
  user: UserAccount;
  setUser: React.Dispatch<React.SetStateAction<UserAccount>>;
  setIsAuthModalOpen: (open: boolean) => void;
  showNotification: ShowNotification;
}

// ウォレット開設（ログイン）とログアウト
export const useAccount = ({ user, setUser, setIsAuthModalOpen, showNotification }: Deps) => {
  const login = (email = DEFAULT_LOGIN_EMAIL, name = DEFAULT_LOGIN_NAME) => {
    // ビジター時にプールしたポイントがあればそれを、なければウェルカムボーナスを付与
    const pooledPoints = user.unclaimedGuestPoints;
    const initialBonus = pooledPoints > 0 ? pooledPoints : WELCOME_BONUS_POINTS;
    const historyTitle =
      pooledPoints > 0
        ? `ビジター視聴プール分の受取 (${pooledPoints}pt)`
        : `アカウント開設ウェルカムポイント (+${WELCOME_BONUS_POINTS}pt)`;

    setUser((prev) => ({
      ...prev,
      isLoggedIn: true,
      name,
      email,
      avatar: MEMBER_AVATAR_URL,
      points: prev.points + initialBonus,
      totalEarnedPoints: prev.totalEarnedPoints + initialBonus,
      unclaimedGuestPoints: 0,
      pointHistory: [createHistoryEntry('ph-login-', historyTitle, initialBonus, 'bonus'), ...prev.pointHistory],
    }));

    triggerConfetti();
    setIsAuthModalOpen(false);
    showNotification(`リワードウォレットを開設しました（${initialBonus}pt 付与）`, initialBonus, 'success');
  };

  const logout = () => {
    setUser(createGuestUser());
    showNotification('ログアウトしました（ビジターモード）', undefined, 'info');
  };

  return { login, logout };
};
