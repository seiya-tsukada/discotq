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
  const {
    user,
    likedVideoIds,
    bookmarkedVideoIds,
    toggleLike,
    setIsAuthModalOpen,
    claimedVideoIds,
    startView,
    claimWatchReward,
  } = useApp();

  const [isMuted, setIsMuted] = useState(true);
  const [showCenterIcon, setShowCenterIcon] = useState<CenterIconType | null>(null);
  const [lastTapTime, setLastTapTime] = useState(0);

  const isLiked = likedVideoIds.includes(video.id);
  const isBookmarked = bookmarkedVideoIds.includes(video.id);

  // 再生同期・視聴タイマー・リワード受取状態（受け取れるかどうかはサーバーが判断する）
  const {
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
  } = useVideoPlayback({
    videoId: video.id,
    fallbackMinWatchSeconds: minWatchSecondsFor(video),
    fallbackRewardPoints: DEFAULT_WATCH_REWARD_POINTS,
    isActive,
    isClaimedBefore: claimedVideoIds.includes(video.id),
    isLoggedIn: user.isLoggedIn,
    startView,
    claimReward: (viewSessionId) => claimWatchReward(viewSessionId, video.id),
  });

  const triggerVisualIcon = (type: CenterIconType) => {
    setShowCenterIcon(type);
    setTimeout(() => setShowCenterIcon(null), CENTER_ICON_DURATION_MS);
  };

  const handleScreenClick = () => {
    const now = Date.now();

    if (now - lastTapTime < DOUBLE_TAP_DELAY_MS) {
      if (!isLiked) void toggleLike(video);
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
      // ゲストは端末の匿名IDに貯め、ログインを勧める（ログイン時にアカウントへ引き継ぐ）
      void triggerClaimSuccess();
      setIsAuthModalOpen(true);
    } else if (!isClaimed) {
      void triggerClaimSuccess();
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
          // 視聴タイマーは実際に再生している間だけ進める（OS のメディア操作で止めた場合も含む）
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
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

      <CardTopBar video={video} isMuted={isMuted} onToggleSound={toggleSound} />

      {/* 自分が投稿した動画はリワードの対象外 */}
      {rewardEligible && (
        <WatchRewardRing
          rewardPoints={rewardPoints}
          minWatchSeconds={minWatchSeconds}
          watchSeconds={watchSeconds}
          hasCompletedWatch={hasCompletedWatch}
          isClaimed={isClaimed}
          isClaiming={isClaiming}
          showClaimedLabel={justClaimedEffect}
          onClaim={handleClaimReward}
        />
      )}

      {rewardEligible && showClaimPrompt && !user.isLoggedIn && (
        <GuestClaimPrompt rewardPoints={rewardPoints} onClaim={handleClaimReward} />
      )}

      <ActionRail video={video} isLiked={isLiked} isBookmarked={isBookmarked} />
    </div>
  );
};
