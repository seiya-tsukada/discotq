import { useEffect } from 'react';
import type { RewardSummary } from '../../types/api';
import { rewardsApi } from '../../lib/api';
import { ShowNotification } from './useNotification';
import { triggerConfetti } from './useRewards';

interface Deps {
  authUserId: string | null;
  authReady: boolean;
  applySummary: (summary: RewardSummary) => void;
  reloadRewards: () => Promise<void>;
  showNotification: ShowNotification;
}

// ログインしたら（ページを開いた時点でログイン済みの場合も）、ゲスト中にこの端末で貯めたポイントを
// アカウントへ引き継ぐ。初回で引き継ぐ分が無ければサーバーがウェルカムボーナスを付ける。
// activate は何度呼んでもよいので、ログインのたびに呼ぶ。ログアウトしてもポイントはサーバーに残る
export const useAccount = ({ authUserId, authReady, applySummary, reloadRewards, showNotification }: Deps) => {
  useEffect(() => {
    if (!authReady || authUserId === null) return;
    let cancelled = false;
    rewardsApi
      .activate()
      .then((res) => {
        if (cancelled) return;
        applySummary(res.summary);
        const granted = res.transferred_points + res.welcome_points;
        if (granted > 0) {
          triggerConfetti();
          showNotification(
            res.transferred_points > 0
              ? `ビジター中に貯めた ${res.transferred_points}pt を受け取りました`
              : `リワードウォレットを開設しました（${res.welcome_points}pt 付与）`,
            granted,
            'success'
          );
        }
        // 引き継いだ動画を受取済みにするため取り直す
        if (res.transferred_points > 0) void reloadRewards();
      })
      .catch((e: unknown) => {
        if (!cancelled) console.error(e);
      });
    return () => {
      cancelled = true;
    };
  }, [authUserId, authReady, applySummary, reloadRewards, showNotification]);
};
