import React, { useEffect, useRef } from 'react';
import { UserAccount } from '../../types';
import type { AuthUser } from '../../types/api';
import { WELCOME_BONUS_POINTS } from '../../constants/rewards';
import { createGuestUser, MEMBER_AVATAR_URL } from '../../constants/user';
import { createHistoryEntry } from '../../lib/user';
import { ShowNotification } from './useNotification';
import { triggerConfetti } from './useRewards';

interface Deps {
  authUser: AuthUser | null;
  authReady: boolean;
  user: UserAccount;
  setUser: React.Dispatch<React.SetStateAction<UserAccount>>;
  showNotification: ShowNotification;
}

// サーバーのログイン状態に合わせて、端末内のリワードウォレットを開設・リセットする
export const useAccount = ({ authUser, authReady, user, setUser, showNotification }: Deps) => {
  const prevAuthId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!authReady) return;
    const prev = prevAuthId.current;
    const current = authUser?.id ?? null;
    prevAuthId.current = current;

    // ログインした（または初回ロード時にログイン済みだった）がウォレット未開設 → 開設してボーナス付与
    if (current && !user.isLoggedIn) {
      const pooled = user.unclaimedGuestPoints;
      const bonus = pooled > 0 ? pooled : WELCOME_BONUS_POINTS;
      const title =
        pooled > 0
          ? `ビジター視聴プール分の受取 (${pooled}pt)`
          : `アカウント開設ウェルカムポイント (+${WELCOME_BONUS_POINTS}pt)`;
      setUser((u) => ({
        ...u,
        isLoggedIn: true,
        avatar: MEMBER_AVATAR_URL,
        points: u.points + bonus,
        totalEarnedPoints: u.totalEarnedPoints + bonus,
        unclaimedGuestPoints: 0,
        pointHistory: [createHistoryEntry('ph-login-', title, bonus, 'bonus'), ...u.pointHistory],
      }));
      triggerConfetti();
      showNotification(`リワードウォレットを開設しました（${bonus}pt 付与）`, bonus, 'success');
      return;
    }

    // このタブでログアウトした → ビジター状態に戻す
    if (prev && !current) {
      setUser(createGuestUser());
    }
    // user は意図的に依存から外す（ログイン状態の変化時だけ実行する）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id, authReady]);
};
