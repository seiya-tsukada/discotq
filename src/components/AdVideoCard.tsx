import React, { useState, useRef, useEffect } from 'react';
import { 
  Heart, 
  MessageSquare, 
  Bookmark, 
  Share2, 
  Volume2, 
  VolumeX, 
  Play, 
  Pause, 
  ExternalLink, 
  Music, 
  FileText,
  BadgeCheck,
  Check,
  Sparkles,
  ArrowRight,
  Wallet,
  Coins
} from 'lucide-react';
import { AdItem } from '../types';
import { useApp } from '../context/AppContext';
import {
  CENTER_ICON_DURATION_MS,
  CLAIM_EFFECT_DURATION_MS,
  DOUBLE_TAP_DELAY_MS,
  WATCH_TIMER_INTERVAL_MS,
} from '../constants/timing';

const RING_RADIUS = 20;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

interface AdVideoCardProps {
  ad: AdItem;
  isActive: boolean;
}

export const AdVideoCard: React.FC<AdVideoCardProps> = ({ ad, isActive }) => {
  const { 
    user, 
    toggleLikeAd, 
    toggleBookmarkAd, 
    openLpModal, 
    setIsCommentsModalOpen, 
    setIsShareModalOpen, 
    setIsAuthModalOpen,
    claimAdWatchReward 
  } = useApp();

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [watchSeconds, setWatchSeconds] = useState(0);
  const [hasCompletedWatch, setHasCompletedWatch] = useState(false);
  const [isClaimed, setIsClaimed] = useState(false);
  const [showCenterIcon, setShowCenterIcon] = useState<'play' | 'pause' | 'heart' | null>(null);
  const [videoError, setVideoError] = useState(false);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [showClaimPrompt, setShowClaimPrompt] = useState(false);
  
  // Effect triggered ONLY when reward is claimed
  const [justClaimedEffect, setJustClaimedEffect] = useState(false);

  const isLiked = user.likedAdIds.includes(ad.id);
  const isBookmarked = user.bookmarkedAdIds.includes(ad.id);
  const isWatchedBefore = user.watchedAdIds.includes(ad.id);

  // Sync video playback with active slide
  useEffect(() => {
    if (!videoRef.current) return;

    if (isActive) {
      setWatchSeconds(0);
      setHasCompletedWatch(isWatchedBefore);
      setIsClaimed(isWatchedBefore);
      setShowClaimPrompt(false);
      setJustClaimedEffect(false);
      setVideoError(false);
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
          if (user.isLoggedIn) {
            triggerClaimSuccess();
          } else {
            setShowClaimPrompt(true);
          }
        }
        return next;
      });
    }, WATCH_TIMER_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isActive, hasCompletedWatch, ad.minWatchSeconds, ad.id, user.isLoggedIn]);

  const triggerClaimSuccess = () => {
    claimAdWatchReward(ad.id);
    setIsClaimed(true);
    setShowClaimPrompt(false);
    setJustClaimedEffect(true);
    setTimeout(() => {
      setJustClaimedEffect(false);
    }, CLAIM_EFFECT_DURATION_MS);
  };

  const handleScreenClick = () => {
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

  const triggerVisualIcon = (type: 'play' | 'pause' | 'heart') => {
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

  // Ring progress calculations
  const progressRatio = Math.min(1, watchSeconds / ad.minWatchSeconds);
  const strokeDashoffset = RING_CIRCUMFERENCE - (progressRatio * RING_CIRCUMFERENCE);
  const remainingSeconds = Math.max(0, Math.ceil(ad.minWatchSeconds - watchSeconds));

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
          <img
            src={ad.posterUrl}
            alt={ad.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-slate-950/40" />
        </div>
      )}

      {/* Subtle vignettes */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-transparent to-slate-950/90 pointer-events-none" />

      {/* Center Feedback Animation (Play / Pause / Heart) */}
      {showCenterIcon && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          {showCenterIcon === 'heart' && (
            <div className="animate-ping duration-300">
              <Heart className="w-20 h-20 text-rose-500 fill-rose-500 drop-shadow-lg" />
            </div>
          )}
          {showCenterIcon === 'play' && (
            <div className="w-14 h-14 rounded-full bg-slate-900/80 backdrop-blur-md flex items-center justify-center text-white border border-slate-750">
              <Play className="w-6 h-6 fill-white ml-0.5" />
            </div>
          )}
          {showCenterIcon === 'pause' && (
            <div className="w-14 h-14 rounded-full bg-slate-900/80 backdrop-blur-md flex items-center justify-center text-white border border-slate-750">
              <Pause className="w-6 h-6 fill-white" />
            </div>
          )}
        </div>
      )}

      {/* Exclusive Claim Success Effect (Only shown right after claiming) */}
      {justClaimedEffect && (
        <div className="absolute top-16 right-4 z-35 pointer-events-none animate-fadeIn">
          <div className="px-3 py-1.5 rounded-full bg-emerald-500/95 text-white shadow-xl shadow-emerald-500/30 flex items-center gap-1.5 text-xs font-bold transform -translate-y-2 transition-all">
            <Coins className="w-4 h-4 text-emerald-100 animate-spin" />
            <span>+{ad.rewardPoints}pt 獲得！</span>
          </div>
        </div>
      )}

      {/* Top Header: Category Tag & Sound Controls */}
      <div className="absolute top-3.5 left-3.5 right-3.5 z-20 flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-full px-2.5 py-1 text-[11px] text-slate-300">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          <span className="font-medium text-slate-300">スポンサー</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">{ad.category}</span>
        </div>

        <button
          onClick={toggleSound}
          className="p-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
          title={isMuted ? '音声オン' : '音声ミュート'}
        >
          {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-white" />}
        </button>
      </div>

      {/* Upper Right: Circular Ring with Label on the LEFT */}
      <div 
        className="absolute top-14 right-3.5 z-25 pointer-events-auto flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Label to the LEFT of the ring */}
        <div className="text-right">
          {isClaimed ? (
            <div className="bg-slate-900/85 backdrop-blur-md border border-slate-800 px-2.5 py-1 rounded-lg">
              <p className="text-[10px] text-slate-400 leading-none">受取完了</p>
              <p className="text-xs font-bold text-emerald-400 leading-tight">+{ad.rewardPoints}pt</p>
            </div>
          ) : hasCompletedWatch ? (
            <div className="bg-blue-900/85 backdrop-blur-md border border-blue-400 px-2.5 py-1 rounded-lg shadow-sm">
              <p className="text-[10px] text-blue-200 font-semibold leading-none">タップして受取</p>
              <p className="text-xs font-black text-white leading-tight">CLAIM +{ad.rewardPoints}pt</p>
            </div>
          ) : (
            <div className="bg-slate-950/80 backdrop-blur-md border border-slate-800 px-2.5 py-1 rounded-lg">
              <p className="text-[10px] text-slate-400 leading-none">視聴で受取</p>
              <p className="text-xs font-semibold text-blue-400 leading-tight">+{ad.rewardPoints}pt</p>
            </div>
          )}
        </div>

        {/* Circular SVG Ring Widget */}
        <button
          onClick={handleClaimReward}
          disabled={!hasCompletedWatch && !isClaimed}
          className={`relative flex items-center justify-center w-11 h-11 rounded-full backdrop-blur-md transition-all duration-300 border ${
            isClaimed
              ? 'bg-slate-900/90 border-emerald-500/30 text-emerald-400 shadow-sm'
              : hasCompletedWatch
              ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/30 scale-105 cursor-pointer ring-2 ring-blue-400/40'
              : 'bg-slate-950/80 border-slate-800 text-slate-300 shadow'
          }`}
          title={isClaimed ? 'リワード獲得済み' : hasCompletedWatch ? 'タップしてリワードを受け取る' : '動画視聴進行中'}
        >
          <svg className="w-10 h-10 -rotate-90 transform" viewBox="0 0 48 48">
            <circle
              cx="24"
              cy="24"
              r={RING_RADIUS}
              className="stroke-slate-800 fill-none"
              strokeWidth="3.5"
            />
            <circle
              cx="24"
              cy="24"
              r={RING_RADIUS}
              className={`fill-none transition-all duration-150 ${
                isClaimed
                  ? 'stroke-emerald-400'
                  : hasCompletedWatch
                  ? 'stroke-white'
                  : 'stroke-blue-500'
              }`}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={hasCompletedWatch ? 0 : strokeDashoffset}
            />
          </svg>

          <div className="absolute inset-0 flex items-center justify-center text-center">
            {isClaimed ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : hasCompletedWatch ? (
              <Sparkles className="w-4 h-4 text-white" />
            ) : (
              <span className="text-[10px] font-mono font-bold text-slate-200">
                {remainingSeconds}s
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Guest Reward Floating Banner (Modern Prompt) */}
      {showClaimPrompt && !user.isLoggedIn && (
        <div 
          className="absolute top-28 right-3.5 left-3.5 z-25 pointer-events-auto animate-fadeIn"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-3 rounded-xl bg-slate-900/95 backdrop-blur-md border border-blue-500/40 shadow-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                <Wallet className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white">+{ad.rewardPoints}pt がウォレットに待機中</span>
                </div>
                <p className="text-[11px] text-slate-400">ワンタップで確定し、ギフト券交換へ保存</p>
              </div>
            </div>

            <button
              onClick={handleClaimReward}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center gap-1 shrink-0 cursor-pointer shadow-sm"
            >
              <span>受取る</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Right Sidebar: Interaction Actions */}
      <div 
        className="absolute right-3.5 bottom-24 z-20 flex flex-col items-center gap-3 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Brand Profile Avatar */}
        <div className="relative group">
          <button
            onClick={() => openLpModal(ad)}
            className="w-10 h-10 rounded-lg p-0.5 bg-slate-800 border border-slate-700 hover:border-blue-500 transition-all shadow"
            title="公式詳細を見る"
          >
            <img
              src={ad.brandLogo}
              alt={ad.brandName}
              className="w-full h-full rounded-[6px] object-cover bg-slate-900"
            />
          </button>
        </div>

        {/* Like Button */}
        <div className="flex flex-col items-center">
          <button
            onClick={() => toggleLikeAd(ad.id)}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
              isLiked 
                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' 
                : 'bg-slate-900/80 backdrop-blur-sm text-slate-300 hover:text-white border border-slate-800 hover:bg-slate-800'
            }`}
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
          </button>
          <span className="text-[10px] font-medium text-slate-300 mt-1">
            {ad.likesCount.toLocaleString()}
          </span>
        </div>

        {/* Comment Button */}
        <div className="flex flex-col items-center">
          <button
            onClick={() => setIsCommentsModalOpen(true)}
            className="w-9 h-9 rounded-lg bg-slate-900/80 backdrop-blur-sm text-slate-300 hover:text-white border border-slate-800 hover:bg-slate-800 flex items-center justify-center transition-all"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
          <span className="text-[10px] font-medium text-slate-300 mt-1">
            {ad.commentsCount.toLocaleString()}
          </span>
        </div>

        {/* Bookmark Button */}
        <div className="flex flex-col items-center">
          <button
            onClick={() => toggleBookmarkAd(ad.id)}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
              isBookmarked 
                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' 
                : 'bg-slate-900/80 backdrop-blur-sm text-slate-300 hover:text-white border border-slate-800 hover:bg-slate-800'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-blue-400 text-blue-400' : ''}`} />
          </button>
          <span className="text-[10px] font-medium text-slate-300 mt-1">
            保存
          </span>
        </div>

        {/* Share Button */}
        <div className="flex flex-col items-center">
          <button
            onClick={() => setIsShareModalOpen(true)}
            className="w-9 h-9 rounded-lg bg-slate-900/80 backdrop-blur-sm text-slate-300 hover:text-white border border-slate-800 hover:bg-slate-800 flex items-center justify-center transition-all"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <span className="text-[10px] font-medium text-slate-300 mt-1">
            共有
          </span>
        </div>

        {/* LP Shortcut Icon */}
        <div className="flex flex-col items-center">
          <button
            onClick={() => openLpModal(ad)}
            className="w-9 h-9 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-md transition-all"
            title="公式LP・サービス詳細"
          >
            <FileText className="w-4 h-4" />
          </button>
          <span className="text-[10px] font-medium text-blue-400 mt-1">
            詳細
          </span>
        </div>
      </div>

      {/* Bottom Information & CTA Section */}
      <div 
        className="absolute bottom-3 left-3 right-16 z-20 pointer-events-auto flex flex-col gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Brand & Verified badge */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => openLpModal(ad)}
            className="flex items-center gap-1.5 hover:underline group cursor-pointer"
          >
            <span className="font-bold text-sm text-white">
              {ad.brandName}
            </span>
            {ad.verified && (
              <span title="認証済み企業">
                <BadgeCheck className="w-4 h-4 text-blue-400" />
              </span>
            )}
          </button>
          <span className="text-[10px] text-slate-300 bg-slate-850/90 border border-slate-700/60 px-2 py-0.5 rounded font-medium">
            公式
          </span>
        </div>

        {/* Ad Title & Description */}
        <div className="text-left">
          <p className="text-xs sm:text-sm font-semibold text-white leading-snug line-clamp-2">
            {ad.title}
          </p>
          <p className="text-[11px] text-slate-300 mt-1 line-clamp-2 leading-relaxed">
            {ad.description}
          </p>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {ad.tags.map((tag, idx) => (
            <span
              key={idx}
              className="text-[11px] font-medium text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* BGM sound ticker */}
        <div className="flex items-center gap-1.5 text-slate-400 text-xs overflow-hidden max-w-[240px]">
          <Music className="w-3 h-3 text-slate-500 shrink-0" />
          <span className="truncate text-[10px]">
            {ad.soundName}
          </span>
        </div>

        {/* Clean Business CTA Button */}
        <button
          onClick={() => openLpModal(ad)}
          className="w-full py-2.5 px-4 rounded-lg flex items-center justify-between font-semibold text-xs sm:text-sm bg-blue-600 hover:bg-blue-500 text-white shadow-md transition-colors cursor-pointer active:scale-99"
        >
          <span className="truncate">{ad.ctaText}</span>
          <div className="flex items-center gap-1 text-xs text-blue-100 shrink-0">
            <span>LPを見る</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </div>
        </button>
      </div>
    </div>
  );
};
