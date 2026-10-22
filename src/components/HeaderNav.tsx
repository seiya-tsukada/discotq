import React from 'react';
import { useApp } from '../context/AppContext';
import { PlayCircle, Coins, User, LogOut, ShoppingBag, Sparkles } from 'lucide-react';

export const HeaderNav: React.FC = () => {
  const { user, setIsPointStoreOpen, setIsAuthModalOpen, logout } = useApp();

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo (Public Viewer) */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 group text-left">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white shadow-sm">
              <PlayCircle className="w-5 h-5 fill-white/20 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-lg tracking-tight text-white">
                  Disco<span className="text-blue-400">TQ</span>
                </span>
                <span className="text-[10px] font-semibold tracking-wide px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-750">
                  Ad Media
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">新しい発見があるショート広告プラットフォーム</p>
            </div>
          </div>
        </div>

        {/* Right Action Bar (Viewer Only) */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Points Balance Badge */}
          {user.isLoggedIn ? (
            <button
              onClick={() => setIsPointStoreOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-700/80 hover:border-slate-600 transition-all cursor-pointer"
              title="リワード交換所を開く"
            >
              <div className="w-5 h-5 rounded-md bg-blue-500/10 flex items-center justify-center">
                <Coins className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-slate-100 tracking-tight">
                    {user.points.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">pt</span>
                </div>
              </div>
              <span className="hidden sm:inline-block text-[10px] font-semibold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                交換
              </span>
            </button>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-750 text-xs font-medium text-slate-300 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-semibold">
                {user.unclaimedGuestPoints > 0 ? (
                  <span>保留中: {user.unclaimedGuestPoints}pt</span>
                ) : (
                  <span>ウォレット</span>
                )}
              </span>
              {user.unclaimedGuestPoints > 0 && <span className="flex h-2 w-2 rounded-full bg-blue-500"></span>}
            </button>
          )}

          {/* Reward Store Shortcut */}
          <button
            onClick={() => setIsPointStoreOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="リワード交換所"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-slate-400" />
            <span>リワード</span>
          </button>

          {/* User Account / Auth Toggle */}
          {user.isLoggedIn ? (
            <div className="flex items-center gap-2 pl-1">
              <button
                onClick={() => setIsPointStoreOpen(true)}
                className="flex items-center gap-2 p-1 rounded-full bg-slate-900 border border-slate-700 hover:border-slate-500 transition-all cursor-pointer"
              >
                <img src={user.avatar} alt={user.name} className="w-7 h-7 rounded-full object-cover" />
                <span className="hidden lg:inline text-xs font-medium text-slate-200 max-w-[100px] truncate pr-1.5">
                  {user.name}
                </span>
              </button>
              <button
                onClick={logout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                title="ログアウト"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all cursor-pointer shadow-sm"
            >
              <User className="w-3.5 h-3.5" />
              <span>会員登録 / ログイン</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
