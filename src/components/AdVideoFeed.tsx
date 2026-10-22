import React, { useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, Gift, AlertCircle, ShieldCheck, Wallet } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AdVideoCard } from './AdVideoCard';

export const AdVideoFeed: React.FC = () => {
  const { ads, currentAdIndex, setCurrentAdIndex, user, setIsAuthModalOpen, setIsPointStoreOpen } = useApp();

  const containerRef = useRef<HTMLDivElement>(null);

  const activeAds = ads.filter((ad) => ad.status === 'active' && ad.reviewStatus === 'approved');

  const goToNextAd = () => {
    if (currentAdIndex < activeAds.length - 1) {
      setCurrentAdIndex(currentAdIndex + 1);
    }
  };

  const goToPrevAd = () => {
    if (currentAdIndex > 0) {
      setCurrentAdIndex(currentAdIndex - 1);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        goToNextAd();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        goToPrevAd();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // goToNextAd/goToPrevAd は currentAdIndex と activeAds.length にのみ依存するため省略（既存挙動を維持）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAdIndex, activeAds.length]);

  // Touch swipe handling
  const touchStartY = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartY.current - touchEndY;
    const MIN_SWIPE_DISTANCE = 50;

    if (diff > MIN_SWIPE_DISTANCE) {
      goToNextAd();
    } else if (diff < -MIN_SWIPE_DISTANCE) {
      goToPrevAd();
    }
  };

  const currentAd = activeAds[currentAdIndex] || activeAds[0];

  return (
    <div className="relative w-full h-[calc(100vh-3.75rem)] flex items-center justify-center bg-slate-950 overflow-hidden select-none">
      {/* Subtle Background */}
      <div className="absolute inset-0 bg-slate-950 pointer-events-none" />

      {/* Main Feed Container (9:16 Aspect ratio phone enclosure on desktop) */}
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative w-full h-full max-w-[420px] max-h-[860px] sm:rounded-2xl overflow-hidden shadow-xl border-0 sm:border border-slate-800 bg-slate-900 flex flex-col"
      >
        {activeAds.length > 0 ? (
          <AdVideoCard key={currentAd.id} ad={currentAd} isActive={true} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400">
            <AlertCircle className="w-10 h-10 text-slate-500 mb-2" />
            <p className="font-semibold text-slate-200 mb-1">配信中の広告がありません</p>
            <p className="text-xs">広告主ポータルより新しい広告枠を出店できます。</p>
          </div>
        )}
      </div>

      {/* Side Navigation Controls (Desktop) */}
      <div className="hidden sm:flex flex-col gap-2.5 absolute right-6 md:right-12 top-1/2 -translate-y-1/2 z-30">
        <button
          onClick={goToPrevAd}
          disabled={currentAdIndex === 0}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all shadow-md ${
            currentAdIndex === 0
              ? 'bg-slate-900/40 text-slate-600 border border-slate-800/40 cursor-not-allowed'
              : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-750 active:scale-95'
          }`}
          title="前の広告 (↑キー)"
        >
          <ChevronUp className="w-5 h-5" />
        </button>

        <div className="text-center">
          <span className="text-[11px] font-semibold text-slate-300 bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800">
            {currentAdIndex + 1} / {activeAds.length}
          </span>
        </div>

        <button
          onClick={goToNextAd}
          disabled={currentAdIndex === activeAds.length - 1}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all shadow-md ${
            currentAdIndex === activeAds.length - 1
              ? 'bg-slate-900/40 text-slate-600 border border-slate-800/40 cursor-not-allowed'
              : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-750 active:scale-95'
          }`}
          title="次の広告 (↓キー)"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      </div>

      {/* Left Info Card (Desktop) */}
      <div className="hidden xl:flex flex-col gap-3.5 absolute left-8 top-1/2 -translate-y-1/2 max-w-xs z-30">
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-lg text-left">
          <div className="flex items-center gap-2 mb-2">
            <span className="p-1 rounded-md bg-blue-500/10 text-blue-400">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold text-slate-200">ショート広告リワード</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mb-3">
            右上の<strong className="text-slate-200 font-semibold">円形リング</strong>
            （進行秒数表示）が満ちると受取可能になります。タップしてリワードを獲得してください。
          </p>

          {!user.isLoggedIn ? (
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-400">ウォレット待機リワード:</span>
                <span className="font-bold text-slate-200">{user.unclaimedGuestPoints} pt</span>
              </div>
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="w-full py-1.5 px-3 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>ウォレットを開設して受取る</span>
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
                className="w-full py-1.5 px-3 rounded-md bg-slate-800 hover:bg-slate-750 text-slate-200 font-medium text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
              >
                <Gift className="w-3.5 h-3.5 text-blue-400" />
                <span>ギフト券に交換する</span>
              </button>
            </div>
          )}
        </div>

        {/* Shortcuts card */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-left text-xs text-slate-400">
          <p className="font-semibold text-slate-300 mb-1">操作案内</p>
          <p>・↑ / ↓ キー : 前 / 次の広告</p>
          <p>・リングタップ : リワードの受取</p>
          <p>・画面クリック : 一時停止 / 再生</p>
        </div>
      </div>
    </div>
  );
};
