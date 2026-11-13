import React, { useEffect, useRef } from 'react';
import {
  ChevronUp,
  ChevronDown,
  Gift,
  AlertCircle,
  ShieldCheck,
  Wallet,
  Loader2,
  Upload,
  RotateCw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Link } from '../router';
import { VideoCard } from './VideoCard';

const MIN_SWIPE_DISTANCE = 50;

export const VideoFeed: React.FC = () => {
  const {
    videos,
    currentVideo,
    currentVideoIndex,
    setCurrentVideoIndex,
    hasMoreVideos,
    feedStatus,
    feedError,
    loadMoreVideos,
    reloadFeed,
    user,
    setIsAuthModalOpen,
    setIsPointStoreOpen,
  } = useApp();

  const isLast = currentVideoIndex >= videos.length - 1;

  const goToNext = () => {
    if (!isLast) setCurrentVideoIndex(currentVideoIndex + 1);
  };

  const goToPrev = () => {
    if (currentVideoIndex > 0) setCurrentVideoIndex(currentVideoIndex - 1);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        goToNext();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        goToPrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // goToNext/goToPrev は currentVideoIndex と videos.length にのみ依存する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVideoIndex, videos.length]);

  const touchStartY = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartY.current - e.changedTouches[0].clientY;
    if (diff > MIN_SWIPE_DISTANCE) goToNext();
    else if (diff < -MIN_SWIPE_DISTANCE) goToPrev();
  };

  const renderBody = () => {
    if (currentVideo) return <VideoCard key={currentVideo.id} video={currentVideo} isActive={true} />;
    if (feedStatus === 'loading' || (feedStatus === 'idle' && hasMoreVideos)) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <p className="text-xs">動画を読み込んでいます…</p>
        </div>
      );
    }
    if (feedStatus === 'error') {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400 gap-3">
          <AlertCircle className="w-10 h-10 text-rose-400" />
          <p className="text-sm text-slate-200">{feedError}</p>
          <button
            onClick={reloadFeed}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
            再読み込み
          </button>
        </div>
      );
    }
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400 gap-2">
        <AlertCircle className="w-10 h-10 text-slate-500" />
        <p className="font-semibold text-slate-200">公開中の動画はまだありません</p>
        <Link
          to="/user"
          className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs text-white"
        >
          <Upload className="w-3.5 h-3.5" />
          最初の動画を投稿する
        </Link>
      </div>
    );
  };

  return (
    <div className="relative w-full h-[calc(100dvh-3.75rem)] flex items-center justify-center bg-slate-950 overflow-hidden select-none">
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative w-full h-full max-w-[420px] max-h-[860px] sm:rounded-2xl overflow-hidden shadow-xl border-0 sm:border border-slate-800 bg-slate-900 flex flex-col"
      >
        {renderBody()}
      </div>

      {/* Side Navigation Controls (Desktop) */}
      {videos.length > 0 && (
        <div className="hidden sm:flex flex-col gap-2.5 absolute right-6 md:right-12 top-1/2 -translate-y-1/2 z-30">
          <button
            onClick={goToPrev}
            disabled={currentVideoIndex === 0}
            className="w-10 h-10 rounded-lg flex items-center justify-center transition-all shadow-md bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 active:scale-95 disabled:bg-slate-900/40 disabled:text-slate-600 disabled:border-slate-800/40 disabled:cursor-not-allowed"
            title="前の動画 (↑キー)"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
          <div className="text-center">
            <span className="text-[11px] font-semibold text-slate-300 bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800">
              {currentVideoIndex + 1} / {videos.length}
              {hasMoreVideos ? '+' : ''}
            </span>
          </div>
          <button
            onClick={() => (isLast && hasMoreVideos ? void loadMoreVideos() : goToNext())}
            disabled={isLast && !hasMoreVideos}
            className="w-10 h-10 rounded-lg flex items-center justify-center transition-all shadow-md bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 active:scale-95 disabled:bg-slate-900/40 disabled:text-slate-600 disabled:border-slate-800/40 disabled:cursor-not-allowed"
            title="次の動画 (↓キー)"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Left Info Card (Desktop) */}
      <div className="hidden xl:flex flex-col gap-3.5 absolute left-8 top-1/2 -translate-y-1/2 max-w-xs z-30">
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-lg text-left">
          <div className="flex items-center gap-2 mb-2">
            <span className="p-1 rounded-md bg-blue-500/10 text-blue-400">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold text-slate-200">視聴リワード</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mb-3">
            右上の<strong className="text-slate-200 font-semibold">円形リング</strong>
            が満ちると受取可能になります。タップしてリワードを獲得してください。
          </p>

          {!user.isLoggedIn ? (
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-400">受取待ちリワード:</span>
                <span className="font-bold text-slate-200">{user.unclaimedGuestPoints} pt</span>
              </div>
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="w-full py-1.5 px-3 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>ログインして受取る</span>
              </button>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-400">会員ステータス</span>
                <span className="font-semibold text-blue-400">{user.level}会員</span>
              </div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-slate-400">ウォレット残高</span>
                <span className="font-bold text-slate-100 text-sm">{user.points.toLocaleString()} pt</span>
              </div>
              <button
                onClick={() => setIsPointStoreOpen(true)}
                className="w-full py-1.5 px-3 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
              >
                <Gift className="w-3.5 h-3.5 text-blue-400" />
                <span>ギフト券に交換する</span>
              </button>
            </div>
          )}
        </div>

        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-left text-xs text-slate-400">
          <p className="font-semibold text-slate-300 mb-1">操作案内</p>
          <p>・↑ / ↓ キー : 前 / 次の動画</p>
          <p>・リングタップ : リワードの受取</p>
          <p>・画面クリック : 一時停止 / 再生</p>
          <p>・ダブルタップ : いいね</p>
        </div>
      </div>
    </div>
  );
};
