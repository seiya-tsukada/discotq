import React, { useState } from 'react';
import type { FeedVideo } from '../types/api';
import { useApp } from '../context/AppContext';
import { CENTER_ICON_DURATION_MS, DOUBLE_TAP_DELAY_MS } from '../constants/timing';
import { DEFAULT_MIN_WATCH_SECONDS, DEFAULT_WATCH_REWARD_POINTS } from '../constants/rewards';
import { useVideoPlayback } from './feed/useVideoPlayback';
import { CenterFeedbackIcon, CenterIconType } from './feed/CenterFeedbackIcon';
import { ClaimSuccessEffect } from './feed/ClaimSuccessEffect';
import { CardTopBar } from './feed/CardTopBar';
import { WatchRewardRing } from './feed/WatchRewardRing';
import { GuestClaimPrompt } from './feed/GuestClaimPrompt';
import { ActionRail } from './feed/ActionRail';
import { VideoInfoOverlay } from './feed/VideoInfoOverlay';

interface VideoCardProps {
  video: FeedVideo;
  isActive: boolean;
}

// 視聴リワードに必要な秒数（動画が短い場合は動画の長さに合わせる）
const minWatchSecondsFor = (video: FeedVideo) =>
  video.duration_sec && video.duration_sec > 0
    ? Math.min(DEFAULT_MIN_WATCH_SECONDS, Math.max(1, Math.floor(video.duration_sec)))
    : DEFAULT_MIN_WATCH_SECONDS;

export const VideoCard: React.FC<VideoCardProps> = ({ video, isActive }) => {
  const { user, toggleLike, setIsAuthModalOpen, claimWatchReward } = useApp();

  const [isMuted, setIsMuted] = useState(true);
  const [showCenterIcon, setShowCenterIcon] = useState<CenterIconType | null>(null);
  const [lastTapTime, setLastTapTime] = useState(0);

  const isLiked = user.likedAdIds.includes(video.id);
  const isBookmarked = user.bookmarkedAdIds.includes(video.id);
  const isWatchedBefore = user.watchedAdIds.includes(video.id);
  const minWatchSeconds = minWatchSecondsFor(video);
  const rewardPoints = DEFAULT_WATCH_REWARD_POINTS;

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
  } = useVideoPlayback({
    videoId: video.id,
    minWatchSeconds,
    isActive,
    isWatchedBefore,
    isLoggedIn: user.isLoggedIn,
    claimReward: () => claimWatchReward(video.id, video.title),
  });

  const triggerVisualIcon = (type: CenterIconType) => {
    setShowCenterIcon(type);
    setTimeout(() => setShowCenterIcon(null), CENTER_ICON_DURATION_MS);
  };

  const handleScreenClick = () => {
    const now = Date.now();

    if (now - lastTapTime < DOUBLE_TAP_DELAY_MS) {
      if (!isLiked) toggleLike(video.id);
      triggerVisualIcon('heart');
    } else if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
        triggerVisualIcon('pause');
      } else {
        void videoRef.current.play();
        setIsPlaying(true);
        triggerVisualIcon('play');
      }
    }
    setLastTapTime(now);
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
    } else if (!isClaimed) {
      triggerClaimSuccess();
    }
  };

  return (
    <div
      className="relative w-full h-full bg-slate-950 flex items-center justify-center select-none overflow-hidden"
      onClick={handleScreenClick}
    >
      {!videoError ? (
        // 縦型ショート動画前提。承認済み動画は public バケットの MP4 を直接再生する
        <video
          ref={videoRef}
          src={video.video_url}
          poster={video.thumb_url ?? undefined}
          playsInline
          loop
          muted={isMuted}
          preload="auto"
          onError={() => setVideoError(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 w-full h-full overflow-hidden flex items-center justify-center bg-slate-900">
          {video.thumb_url && <img src={video.thumb_url} alt={video.title} className="w-full h-full object-cover" />}
          <div className="absolute inset-0 bg-slate-950/60 flex items-center justify-center">
            <p className="text-xs text-slate-300">動画を再生できませんでした</p>
          </div>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-transparent to-slate-950/90 pointer-events-none" />

      {showCenterIcon && <CenterFeedbackIcon type={showCenterIcon} />}

      {justClaimedEffect && <ClaimSuccessEffect rewardPoints={rewardPoints} />}

      <CardTopBar source={video.source} isMuted={isMuted} onToggleSound={toggleSound} />

      <WatchRewardRing
        rewardPoints={rewardPoints}
        minWatchSeconds={minWatchSeconds}
        watchSeconds={watchSeconds}
        hasCompletedWatch={hasCompletedWatch}
        isClaimed={isClaimed}
        onClaim={handleClaimReward}
      />

      {showClaimPrompt && !user.isLoggedIn && (
        <GuestClaimPrompt rewardPoints={rewardPoints} onClaim={handleClaimReward} />
      )}

      <ActionRail video={video} isLiked={isLiked} isBookmarked={isBookmarked} />

      <VideoInfoOverlay video={video} />
    </div>
  );
};
