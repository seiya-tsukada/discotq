import React, { useState, useEffect } from 'react';
import { X, ArrowRight, Wallet, Lock, KeyRound, ArrowLeft } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, setIsAuthModalOpen, user, login } = useApp();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAuthModalOpen) {
        setIsAuthModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthModalOpen, setIsAuthModalOpen]);

  if (!isAuthModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login(email || 'member@example.com', name || 'ビジネスメンバー');
  };

  const handleQuickLogin = (demoName: string) => {
    login(`${demoName.toLowerCase()}@example.com`, demoName);
  };

  const pendingPoints = user.unclaimedGuestPoints > 0 ? user.unclaimedGuestPoints : 30;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setIsAuthModalOpen(false);
        }
      }}
    >
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header with Back & Close Navigation */}
        <div className="bg-slate-950 px-4 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <button
            onClick={() => setIsAuthModalOpen(false)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2 py-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
            title="広告視聴に戻る"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>視聴に戻る</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Wallet className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <h3 className="font-bold text-white text-sm">リワードウォレット</h3>
          </div>

          <button
            onClick={() => setIsAuthModalOpen(false)}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          
          {/* Smart Balance Card */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-slate-750 shadow-inner">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span className="font-medium">ウォレット待機中のリワード</span>
              <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-semibold">
                Instant Claim
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white tracking-tight">
                +{pendingPoints.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-slate-400">pt</span>
              <span className="text-[11px] text-slate-500 ml-auto">
                {user.unclaimedGuestPoints > 0 
                  ? '（ビジター視聴証明分）' 
                  : '（新規開設ボーナス）'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
              アカウントを開設すると、視聴リワードが安全にウォレットへ保管され、AmazonギフトカードやPayPay等への即時交換申請が可能になります。
            </p>
          </div>

          {/* 1-Tap Modern Auth Options */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-slate-400 block">
              ワンタップでセキュア連携:
            </span>

            <button
              type="button"
              onClick={() => handleQuickLogin('Google連携ユーザー')}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 text-xs font-semibold text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:border-slate-700"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Google アカウントで連携・受取</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin('パスキー認証ユーザー')}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 text-xs font-semibold text-slate-200 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:border-slate-700"
            >
              <KeyRound className="w-4 h-4 text-emerald-400" />
              <span>パスキー / 生体認証でクイック開設</span>
            </button>
          </div>

          <div className="flex items-center gap-2 my-2">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-[10px] text-slate-500 uppercase font-medium">または メールアドレスで登録</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          {/* Standard Email Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">お名前 / アカウント名</label>
              <input
                type="text"
                placeholder="例: 佐藤 健一"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">メールアドレス</label>
              <input
                type="email"
                placeholder="user@example.co.jp"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer mt-1"
            >
              <span>リワードを確定してウォレットを開設</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Explicit Back to Feed Action */}
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(false)}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors underline cursor-pointer py-1"
            >
              今は開設せずに広告の視聴に戻る
            </button>
          </div>

          <div className="pt-1 flex items-center justify-center gap-2 text-[11px] text-slate-500">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>完全無料 / 送金手数料・維持費ゼロ / いつでも連携解除可能</span>
          </div>
        </div>
      </div>
    </div>
  );
};
