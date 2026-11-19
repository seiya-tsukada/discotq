import { useCallback, useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { GiftItem, PointHistoryEntry } from '../../types';
import type { RewardSummary, StartViewResponse } from '../../types/api';
import { CONFETTI_OPTIONS } from '../../constants/rewards';
import { ApiError, errorMessage, rewardsApi } from '../../lib/api';
import { setIdIn, toGiftItem, toHistoryEntry } from '../../lib/user';
import { ShowNotification } from './useNotification';

export interface RewardResult {
  // 受取の処理が終わったか（受取済みだった場合も true）。false なら通信エラーなどで、もう一度押せる
  ok: boolean;
  earned: boolean;
  points: number;
  isGuest: boolean;
}

export interface ExchangeResult {
  success: boolean;
  message: string;
  code?: string;
}

interface Deps {
  // サーバーのログイン状態（AuthContext）。ユーザーが切り替わったら残高を取り直す
  authUserId: string | null;
  authReady: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  showNotification: ShowNotification;
}

const EMPTY_SUMMARY: RewardSummary = { owner: 'anonymous', balance: 0, total_earned: 0, level: 'ブロンズ' };

// サーバー側の受取が早すぎた（時計のずれ・通信の遅れ）ときに、待ってから再試行する回数
const TOO_EARLY_RETRIES = 1;

export const triggerConfetti = () => {
  try {
    confetti(CONFETTI_OPTIONS);
  } catch {
    // ignore
  }
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// 視聴リワードの残高・受取・ギフト交換。正はサーバーの point_ledger（/api/me/rewards）
export const useRewards = ({ authUserId, authReady, setIsAuthModalOpen, showNotification }: Deps) => {
  const [summary, setSummary] = useState<RewardSummary>(EMPTY_SUMMARY);
  const [claimedVideoIds, setClaimedVideoIds] = useState<string[]>([]);
  const [giftItems, setGiftItems] = useState<GiftItem[]>([]);
  const [pointHistory, setPointHistory] = useState<PointHistoryEntry[]>([]);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyStatus, setHistoryStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  // 古い応答で新しい残高を上書きしないよう、取得のたびに番号を振る
  const loadSeq = useRef(0);
  const exchanging = useRef(false);

  const reloadRewards = useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      const res = await rewardsApi.mine();
      if (seq !== loadSeq.current) return;
      const { claimed_video_ids, ...rest } = res;
      setSummary(rest);
      setClaimedVideoIds(claimed_video_ids);
    } catch (e) {
      // 取れなくてもフィードは見られるので、記録だけ残す
      if (seq === loadSeq.current) console.error(e);
    }
  }, []);

  // 受取・交換の応答に入っている最新の残高を反映する（取得中の古い応答は捨てる）
  const applySummary = useCallback((s: RewardSummary) => {
    loadSeq.current++;
    setSummary(s);
  }, []);

  useEffect(() => {
    if (!authReady) return;
    // ログイン状態が変わったら履歴は取り直す
    /* eslint-disable react-hooks/set-state-in-effect */
    setPointHistory([]);
    setHistoryCursor(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    void reloadRewards();
  }, [authReady, authUserId, reloadRewards]);

  useEffect(() => {
    rewardsApi
      .gifts()
      .then((res) => setGiftItems(res.items.map(toGiftItem)))
      .catch((e: unknown) => console.error(e));
  }, []);

  const loadHistory = useCallback(
    async (more = false) => {
      setHistoryStatus('loading');
      try {
        const res = await rewardsApi.history(more ? historyCursor : null);
        const items = res.items.map(toHistoryEntry);
        setPointHistory((prev) => (more ? [...prev, ...items] : items));
        setHistoryCursor(res.next_cursor);
        setHistoryStatus('idle');
      } catch (e) {
        setHistoryStatus('error');
        showNotification(`履歴を読み込めませんでした: ${errorMessage(e)}`, undefined, 'warning');
      }
    },
    [historyCursor, showNotification]
  );

  const startView = useCallback((videoId: string): Promise<StartViewResponse> => rewardsApi.startView(videoId), []);

  const claimWatchReward = async (viewSessionId: string, videoId: string): Promise<RewardResult> => {
    const isGuest = authUserId === null;
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await rewardsApi.claim(viewSessionId);
        applySummary(res.summary);
        setClaimedVideoIds((ids) => setIdIn(ids, videoId, true));
        if (!res.earned) return { ok: true, earned: false, points: 0, isGuest };
        if (isGuest) {
          showNotification(`視聴完了：${res.points}pt がプールされました（ログインで受取可能）`, res.points, 'info');
        } else {
          triggerConfetti();
          showNotification(`リワード受取完了：+${res.points}pt を獲得しました`, res.points, 'success');
        }
        return { ok: true, earned: true, points: res.points, isGuest };
      } catch (e) {
        if (e instanceof ApiError && e.code === 'too_early' && attempt < TOO_EARLY_RETRIES) {
          const wait = (e.details as { retry_after_sec?: number } | undefined)?.retry_after_sec ?? 1;
          await sleep(wait * 1000);
          continue;
        }
        showNotification(`リワードを受け取れませんでした: ${errorMessage(e)}`, undefined, 'warning');
        return { ok: false, earned: false, points: 0, isGuest };
      }
    }
  };

  const exchangePoints = async (giftId: string): Promise<ExchangeResult> => {
    if (authUserId === null) {
      setIsAuthModalOpen(true);
      return { success: false, message: 'リワードの交換にはログインが必要です' };
    }
    const gift = giftItems.find((g) => g.id === giftId);
    if (!gift) return { success: false, message: 'ギフトが見つかりませんでした' };
    if (exchanging.current) return { success: false, message: '交換の手続き中です' };
    exchanging.current = true;
    try {
      // 通信が切れて再送しても二重に引き落とされないよう、1 回の操作ごとにキーを作る
      const res = await rewardsApi.exchange(gift.id, crypto.randomUUID());
      applySummary(res.summary);
      setPointHistory([]);
      setHistoryCursor(null);
      triggerConfetti();
      showNotification(`${gift.name} との交換手続きが完了しました`, undefined, 'success');
      return { success: true, message: `${gift.name} の交換コードを発行しました`, code: res.code };
    } catch (e) {
      return { success: false, message: errorMessage(e) };
    } finally {
      exchanging.current = false;
    }
  };

  return {
    rewardSummary: summary,
    claimedVideoIds,
    giftItems,
    pointHistory,
    hasMoreHistory: historyCursor !== null,
    historyStatus,
    loadHistory,
    reloadRewards,
    applySummary,
    startView,
    claimWatchReward,
    exchangePoints,
  };
};
