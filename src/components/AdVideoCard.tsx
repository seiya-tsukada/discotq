import React, { useState } from 'react';
import { AdItem } from '../types';
import { useApp } from '../context/AppContext';
import { CENTER_ICON_DURATION_MS, DOUBLE_TAP_DELAY_MS } from '../constants/timing';
import { useAdPlayback } from './feed/useAdPlayback';
import { CenterFeedbackIcon, CenterIconType } from './feed/CenterFeedbackIcon';
import { ClaimSuccessEffect } from './feed/ClaimSuccessEffect';
import { CardTopBar } from './feed/CardTopBar';
import { WatchRewardRing } from './feed/WatchRewardRing';
import { GuestClaimPrompt } from './feed/GuestClaimPrompt';
import { ActionRail } from './feed/ActionRail';
import { AdInfoOverlay } from './feed/AdInfoOverlay';

interface AdVideoCardProps {
  ad: AdItem;
  isActive: boolean;
}

export const AdVideoCard: React.FC<AdVideoCardProps> = ({ ad, isActive }) => {
  const { user, toggleLikeAd, setIsAuthModalOpen, claimAdWatchReward } = useApp();

  const [isMuted, setIsMuted] = useState(true);
  const [showCenterIcon, setShowCenterIcon] = useState<CenterIconType | null>(null);
  const [lastTapTime, setLastTapTime] = useState(0);

  const isLiked = user.likedAdIds.includes(ad.id);
  const isBookmarked = user.bookmarkedAdIds.includes(ad.id);
  const isWatchedBefore = user.watchedAdIds.includes(ad.id);

  // 再生同期・視聴タイマー・リワード受取状態
  const {
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
  } = useAdPlayback({
    ad,
    isActive,
    isWatchedBefore,
    isLoggedIn: user.isLoggedIn,
    claimAdWatchReward,
  });

  const handleScreenClick = () => {
    // イベントハンドラ内の呼び出しのため描画の純粋性には影響しない（ルールの誤検知）
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();

    if (now - lastTapTime < DOUBLE_TAP_DELAY_MS) {
      if (!isLiked) {
        toggleLikeAd(ad.id);
      }
      triggerVisualIcon('heart');
    } else {
      if (videoRef.current) {
        if (isPlaying) {
          videoRef.current.pause();
          setIsPlaying(false);
          triggerVisualIcon('pause');
        } else {
          videoRef.current.play();
          setIsPlaying(true);
          triggerVisualIcon('play');
        }
      }
    }
    setLastTapTime(now);
  };

  const triggerVisualIcon = (type: CenterIconType) => {
    setShowCenterIcon(type);
    setTimeout(() => {
      setShowCenterIcon(null);
    }, CENTER_ICON_DURATION_MS);
  };

  const toggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleClaimReward = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasCompletedWatch) return;

    if (!user.isLoggedIn) {
      triggerClaimSuccess();
      setIsAuthModalOpen(true);
    } else {
      if (!isClaimed) {
        triggerClaimSuccess();
      }
    }
  };

  return (
    <div
      className="relative w-full h-full bg-slate-950 flex items-center justify-center select-none overflow-hidden"
      onClick={handleScreenClick}
    >
      {/* Video or Fallback Poster */}
      {!videoError ? (
        <video
          ref={videoRef}
          src={ad.videoUrl}
          poster={ad.posterUrl}
          playsInline
          loop
          muted={isMuted}
          onError={() => setVideoError(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          <img src={ad.posterUrl} alt={ad.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-slate-950/40" />
        </div>
      )}

      {/* Subtle vignettes */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-transparent to-slate-950/90 pointer-events-none" />

      {/* Center Feedback Animation (Play / Pause / Heart) */}
      {showCenterIcon && <CenterFeedbackIcon type={showCenterIcon} />}

      {justClaimedEffect && <ClaimSuccessEffect rewardPoints={ad.rewardPoints} />}

      <CardTopBar category={ad.category} isMuted={isMuted} onToggleSound={toggleSound} />

      <WatchRewardRing
        rewardPoints={ad.rewardPoints}
        minWatchSeconds={ad.minWatchSeconds}
        watchSeconds={watchSeconds}
        hasCompletedWatch={hasCompletedWatch}
        isClaimed={isClaimed}
        onClaim={handleClaimReward}
      />

      {showClaimPrompt && !user.isLoggedIn && (
        <GuestClaimPrompt rewardPoints={ad.rewardPoints} onClaim={handleClaimReward} />
      )}

      <ActionRail ad={ad} isLiked={isLiked} isBookmarked={isBookmarked} />

      <AdInfoOverlay ad={ad} />
    </div>
  );
};
