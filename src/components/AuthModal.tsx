import React, { useEffect } from 'react';
import { X, Wallet } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AuthForm } from './auth/AuthForm';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, setIsAuthModalOpen, user } = useApp();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAuthModalOpen) setIsAuthModalOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthModalOpen, setIsAuthModalOpen]);

  if (!isAuthModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsAuthModalOpen(false);
      }}
    >
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Wallet className="w-4 h-4 text-blue-400" />
            {user.unclaimedGuestPoints > 0
              ? `ログインすると受取待ちの ${user.unclaimedGuestPoints}pt を受け取れます`
              : 'ログイン（任意）でリワードの受取と投稿管理ができます'}
          </div>
          <button
            onClick={() => setIsAuthModalOpen(false)}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            title="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">
          <AuthForm
            onSuccess={(_, mode) => {
              // 新規登録時は確認メールの案内を見せるため閉じない
              if (mode === 'login') setIsAuthModalOpen(false);
            }}
          />
        </div>
      </div>
    </div>
  );
};
