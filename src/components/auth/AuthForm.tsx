import React, { useState } from 'react';
import { ArrowRight, Loader2, Mail } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authApi, errorMessage } from '../../lib/api';
import type { AuthUser } from '../../types/api';

type Mode = 'login' | 'signup' | 'forgot';

interface AuthFormProps {
  initialMode?: Mode;
  // 管理画面では新規登録を出さない
  allowSignup?: boolean;
  onSuccess?: (user: AuthUser, mode: 'login' | 'signup') => void;
}

const inputClass =
  'w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500';

export const AuthForm: React.FC<AuthFormProps> = ({ initialMode = 'login', allowSignup = true, onSuccess }) => {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'login') {
        // onSuccess?.(await login()) と書くと onSuccess 未指定時に login 自体が評価されないので分ける
        const user = await login(email, password);
        onSuccess?.(user, 'login');
      } else if (mode === 'signup') {
        const user = await signup(email, password, displayName.trim() || undefined);
        setNotice(`${user.email} に確認メールを送信しました。メール内のリンクを開いて登録を完了してください。`);
        onSuccess?.(user, 'signup');
      } else {
        await authApi.requestPasswordReset(email);
        setNotice('入力されたアドレスが登録済みであれば、パスワード再設定用のメールを送信しました。');
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const title = mode === 'login' ? 'ログイン' : mode === 'signup' ? '新規登録' : 'パスワードの再設定';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <h3 className="text-base font-bold text-white">{title}</h3>

      {mode === 'signup' && (
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          表示名（任意）
          <input
            className={inputClass}
            value={displayName}
            maxLength={50}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="nickname"
          />
        </label>
      )}

      <label className="flex flex-col gap-1 text-xs text-slate-400">
        メールアドレス
        <input
          className={inputClass}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </label>

      {mode !== 'forgot' && (
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          パスワード{mode === 'signup' && '（8文字以上）'}
          <input
            className={inputClass}
            type="password"
            required
            minLength={mode === 'signup' ? 8 : 1}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />
        </label>
      )}

      {error && (
        <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{error}</p>
      )}
      {notice && (
        <p className="text-xs text-emerald-200 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 flex gap-2">
          <Mail className="w-4 h-4 shrink-0" />
          {notice}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
        {mode === 'login' ? 'ログイン' : mode === 'signup' ? '登録して確認メールを受け取る' : '再設定メールを送信'}
      </button>

      <div className="flex flex-wrap justify-between gap-2 text-xs">
        {mode !== 'login' ? (
          <button
            type="button"
            onClick={() => switchMode('login')}
            className="text-blue-400 hover:underline cursor-pointer"
          >
            ログインに戻る
          </button>
        ) : (
          allowSignup && (
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className="text-blue-400 hover:underline cursor-pointer"
            >
              アカウントを作成する
            </button>
          )
        )}
        {mode === 'login' && (
          <button
            type="button"
            onClick={() => switchMode('forgot')}
            className="text-slate-400 hover:underline cursor-pointer"
          >
            パスワードを忘れた場合
          </button>
        )}
      </div>
    </form>
  );
};
