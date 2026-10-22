import { useState, useRef, useEffect } from 'react';
import { AdItem } from '../../types';
import { CLAIM_EFFECT_DURATION_MS, WATCH_TIMER_INTERVAL_MS } from '../../constants/timing';

interface UseAdPlaybackParams {
  ad: AdItem;
  isActive: boolean;
  isWatchedBefore: boolean;
  isLoggedIn: boolean;
  claimAdWatchReward: (adId: string) => unknown;
}

// 動画再生の同期・視聴タイマー・リワード受取状態をまとめて管理する
export const useAdPlayback = ({
  ad,
  isActive,
  isWatchedBefore,
  isLoggedIn,
  claimAdWatchReward,
}: UseAdPlaybackParams) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [watchSeconds, setWatchSeconds] = useState(0);
  const [hasCompletedWatch, setHasCompletedWatch] = useState(false);
  const [isClaimed, setIsClaimed] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [showClaimPrompt, setShowClaimPrompt] = useState(false);

  // Effect triggered ONLY when reward is claimed
  const [justClaimedEffect, setJustClaimedEffect] = useState(false);

  // Sync video playback with active slide
  useEffect(() => {
    if (!videoRef.current) return;

    if (isActive) {
      // スライドがアクティブになるたびに視聴状態をリセットする（既存挙動を維持）
      /* eslint-disable react-hooks/set-state-in-effect */
      setWatchSeconds(0);
      setHasCompletedWatch(isWatchedBefore);
      setIsClaimed(isWatchedBefore);
      setShowClaimPrompt(false);
      setJustClaimedEffect(false);
      setVideoError(false);
      /* eslint-enable react-hooks/set-state-in-effect */
      videoRef.current.currentTime = 0;

      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch(() => {
            setIsPlaying(false);
          });
      }
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, [isActive, isWatchedBefore]);

  // Watch timer for circular ring
  useEffect(() => {
    if (!isActive || hasCompletedWatch) return;

    const interval = setInterval(() => {
      setWatchSeconds((prev) => {
        const next = prev + WATCH_TIMER_INTERVAL_MS / 1000;
        if (next >= ad.minWatchSeconds && !hasCompletedWatch) {
          setHasCompletedWatch(true);
          if (isLoggedIn) {
            triggerClaimSuccess();
          } else {
            setShowClaimPrompt(true);
          }
        }
        return next;
      });
    }, WATCH_TIMER_INTERVAL_MS);

    return () => clearInterval(interval);
    // triggerClaimSuccess は毎レンダー再生成されるため依存に含めない（既存挙動を維持）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, hasCompletedWatch, ad.minWatchSeconds, ad.id, isLoggedIn]);

  const triggerClaimSuccess = () => {
    claimAdWatchReward(ad.id);
    setIsClaimed(true);
    setShowClaimPrompt(false);
    setJustClaimedEffect(true);
    setTimeout(() => {
      setJustClaimedEffect(false);
    }, CLAIM_EFFECT_DURATION_MS);
  };

  return {
    videoRef,
    isPlaying,
    setIsPlaying,
    watchSeconds,
    hasCompletedWatch,
    isClaimed,
    videoError,
    setVideoError,
    showClaimPrompt,
    justClaimedEffect,
    triggerClaimSuccess,
  };
};
