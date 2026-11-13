import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { PageShell } from '../../components/PageShell';
import { useAuth } from '../../context/AuthContext';
import { authApi, errorMessage } from '../../lib/api';
import { Link, useSearchParam } from '../../router';

export const VerifyEmailPage: React.FC = () => {
  const token = useSearchParam('token');
  const { refresh } = useAuth();
  const [state, setState] = useState<'loading' | 'ok' | 'error'>(token ? 'loading' : 'error');
  const [message, setMessage] = useState(token ? '' : 'リンクが正しくありません');
  const started = useRef(false);

  useEffect(() => {
    // StrictMode の二重実行でトークンを二度使わないようにする
    if (!token || started.current) return;
    started.current = true;
    authApi
      .verifyEmail(token)
      .then(async () => {
        setState('ok');
        await refresh();
      })
      .catch((e) => {
        setState('error');
        setMessage(errorMessage(e));
      });
  }, [token, refresh]);

  return (
    <PageShell title="メールアドレスの確認">
      <div className="max-w-sm mx-auto mt-16 text-center flex flex-col items-center gap-3">
        {state === 'loading' && <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />}
        {state === 'ok' && (
          <>
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            <p className="text-sm text-white">メールアドレスを確認しました</p>
            <Link to="/user" className="text-xs text-blue-400 hover:underline">
              投稿管理画面へ
            </Link>
          </>
        )}
        {state === 'error' && (
          <>
            <XCircle className="w-10 h-10 text-rose-400" />
            <p className="text-sm text-white">{message}</p>
            <p className="text-xs text-slate-400">ログイン後、投稿管理画面から確認メールを再送できます。</p>
            <Link to="/user" className="text-xs text-blue-400 hover:underline">
              投稿管理画面へ
            </Link>
          </>
        )}
      </div>
    </PageShell>
  );
};
