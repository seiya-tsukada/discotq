import React, { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { PageShell } from '../../components/PageShell';
import { authApi, errorMessage } from '../../lib/api';
import { Link, useSearchParam } from '../../router';

export const ResetPasswordPage: React.FC = () => {
  const token = useSearchParam('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : 'リンクが正しくありません');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (password !== confirm) {
      setError('確認用パスワードが一致しません');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await authApi.confirmPasswordReset(token, password);
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-blue-500';

  return (
    <PageShell title="パスワードの再設定">
      <div className="max-w-sm mx-auto mt-10 p-5 rounded-xl bg-slate-900 border border-slate-800">
        {done ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            <p className="text-sm text-white">パスワードを変更しました</p>
            <p className="text-xs text-slate-400">セキュリティのため、すべての端末でログアウトしました。</p>
            <Link to="/user" className="text-xs text-blue-400 hover:underline">
              ログインする
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              新しいパスワード（8文字以上）
              <input
                type="password"
                className={inputClass}
                minLength={8}
                maxLength={128}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              新しいパスワード（確認）
              <input
                type="password"
                className={inputClass}
                minLength={8}
                maxLength={128}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            {error && <p className="text-xs text-rose-300">{error}</p>}
            <button
              type="submit"
              disabled={submitting || !token}
              className="py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              パスワードを変更
            </button>
          </form>
        )}
      </div>
    </PageShell>
  );
};
