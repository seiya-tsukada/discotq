import { useState, useRef, useEffect } from 'react';
import { CLAIM_EFFECT_DURATION_MS, WATCH_TIMER_INTERVAL_MS } from '../../constants/timing';
import type { StartViewResponse } from '../../types/api';
import type { RewardResult } from '../../context/hooks/useRewards';

interface UseVideoPlaybackParams {
  videoId: string;
  // サーバーの応答が返るまでの仮の値
  fallbackMinWatchSeconds: number;
  fallbackRewardPoints: number;
  isActive: boolean;
  isClaimedBefore: boolean;
  isLoggedIn: boolean;
  startView: (videoId: string) => Promise<StartViewResponse>;
  claimReward: (viewSessionId: string) => Promise<RewardResult>;
}

// 動画再生の同期・視聴タイマー・リワード受取状態をまとめて管理する。
// カードがアクティブになるたびにサーバーで視聴を開始し、その記録（view_session）で受け取る。
// 受け取れるかどうか（最低視聴時間・二重受取）はサーバーが判断し、ここのタイマーは表示用
export const useVideoPlayback = ({
  videoId,
  fallbackMinWatchSeconds,
  fallbackRewardPoints,
  isActive,
  isClaimedBefore,
  isLoggedIn,
  startView,
  claimReward,
}: UseVideoPlaybackParams) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  // 読み込み待ちで止まっている間は視聴時間に数えない
  const [isBuffering, setIsBuffering] = useState(false);
  const [watchSeconds, setWatchSeconds] = useState(0);
  // 受取済みの動画は最初の描画から受取済みとして扱う（「受取完了」を受け取った直後だけ出すため）
  const [hasCompletedWatch, setHasCompletedWatch] = useState(isClaimedBefore);
  const [isClaimed, setIsClaimed] = useState(isClaimedBefore);
  const [isClaiming, setIsClaiming] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [showClaimPrompt, setShowClaimPrompt] = useState(false);
  const [minWatchSeconds, setMinWatchSeconds] = useState(fallbackMinWatchSeconds);
  const [rewardPoints, setRewardPoints] = useState(fallbackRewardPoints);
  // 自分の投稿など、リワードの対象外の動画
  const [rewardEligible, setRewardEligible] = useState(true);
  // 今回の視聴の記録。開始の応答を待っている間に受け取ろうとした場合は Promise を待つ
  const viewSession = useRef<Promise<StartViewResponse | null> | null>(null);
  const isClaimedBeforeRef = useRef(isClaimedBefore);
  useEffect(() => {
    isClaimedBeforeRef.current = isClaimedBefore;
  }, [isClaimedBefore]);

  // Effect triggered ONLY when reward is claimed
  const [justClaimedEffect, setJustClaimedEffect] = useState(false);

  // 受取済みの一覧が後から届いた（または別のカードで受け取った）ら、受取済みの表示にする
  useEffect(() => {
    if (!isClaimedBefore) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setIsClaimed(true);
    setHasCompletedWatch(true);
    setShowClaimPrompt(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isClaimedBefore]);

  // Sync video playback with active slide
  useEffect(() => {
    if (!videoRef.current) return;

    if (isActive) {
      // スライドがアクティブになるたびに視聴状態をリセットする
      const claimedBefore = isClaimedBeforeRef.current;
      /* eslint-disable react-hooks/set-state-in-effect */
      setWatchSeconds(0);
      setHasCompletedWatch(claimedBefore);
      setIsClaimed(claimedBefore);
      setIsClaiming(false);
      setShowClaimPrompt(false);
      setJustClaimedEffect(false);
      setVideoError(false);
      setIsBuffering(false);
      /* eslint-enable react-hooks/set-state-in-effect */
      videoRef.current.currentTime = 0;

      let cancelled = false;
      viewSession.current = startView(videoId)
        .then((res) => {
          if (!cancelled) {
            setMinWatchSeconds(res.min_watch_seconds);
            setRewardPoints(res.reward_points);
            setRewardEligible(res.reward_eligible);
            if (res.already_claimed) {
              setIsClaimed(true);
              setHasCompletedWatch(true);
            }
          }
          return res;
        })
        .catch((e: unknown) => {
          // 開始を記録できなくても再生は続ける（受取のときにもう一度試す）
          console.error(e);
          return null;
        });

      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch(() => {
            setIsPlaying(false);
          });
      }
      return () => {
        cancelled = true;
      };
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      viewSession.current = null;
    }
  }, [isActive, videoId, startView]);

  // 視聴タイマー（リングの表示用）。再生中だけ数え、一時停止・読み込み待ちの間は止める
  useEffect(() => {
    if (!isActive || !isPlaying || isBuffering || hasCompletedWatch || !rewardEligible) return;

    const interval = setInterval(() => {
      setWatchSeconds((prev) => prev + WATCH_TIMER_INTERVAL_MS / 1000);
    }, WATCH_TIMER_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isActive, isPlaying, isBuffering, hasCompletedWatch, rewardEligible]);

  const triggerClaimSuccess = async () => {
    if (isClaiming || isClaimed) return;
    setIsClaiming(true);
    let session = viewSession.current ? await viewSession.current : null;
    if (!session) {
      // 開始の記録に失敗していた（通信エラーなど）。ここから始め直し、足りない秒数は受取側が待って再試行する
      viewSession.current = startView(videoId).catch(() => null);
      session = await viewSession.current;
    }
    const result = session ? await claimReward(session.view_session_id) : null;
    setIsClaiming(false);
    if (!result?.ok) {
      // 失敗したらもう一度押せるようにしておく
      return;
    }
    setIsClaimed(true);
    setShowClaimPrompt(false);
    if (!result.earned) return;
    setJustClaimedEffect(true);
    setTimeout(() => {
      setJustClaimedEffect(false);
    }, CLAIM_EFFECT_DURATION_MS);
  };

  // 必要な秒数に届いたら、ログイン中はそのまま受け取り、未ログインは受取の案内を出す
  useEffect(() => {
    if (!isActive || hasCompletedWatch || watchSeconds < minWatchSeconds) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setHasCompletedWatch(true);
    if (isLoggedIn) {
      void triggerClaimSuccess();
    } else {
      setShowClaimPrompt(true);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // triggerClaimSuccess は毎レンダー再生成されるため依存に含めない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, hasCompletedWatch, watchSeconds, minWatchSeconds, isLoggedIn]);

  return {
    videoRef,
    isPlaying,
    setIsPlaying,
    setIsBuffering,
    watchSeconds,
    minWatchSeconds,
    rewardPoints,
    rewardEligible,
    hasCompletedWatch,
    isClaimed,
    isClaiming,
    videoError,
    setVideoError,
    showClaimPrompt,
    justClaimedEffect,
    triggerClaimSuccess,
  };
};
