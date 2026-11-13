import React, { useCallback, useEffect, useState } from 'react';
import { Link2, LogIn, LogOut } from 'lucide-react';
import { PageShell } from '../../components/PageShell';
import { UploadPanel } from '../../components/upload/UploadPanel';
import { AuthForm } from '../../components/auth/AuthForm';
import { VerifyEmailBanner } from '../../components/auth/VerifyEmailBanner';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { errorMessage, videoApi } from '../../lib/api';
import type { MyVideo } from '../../types/api';
import { MyVideosList } from './MyVideosList';

export const UserPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { showNotification } = useApp();
  const [videos, setVideos] = useState<MyVideo[]>([]);
  const [claimable, setClaimable] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await videoApi.myVideos();
      setVideos(res.items);
      setClaimable(res.claimable_count);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // ログイン状態が変わったら一覧を取り直す
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, user?.id]);

  const handleDelete = async (video: MyVideo) => {
    try {
      await videoApi.deleteMyVideo(video.id);
      setVideos((prev) => prev.filter((v) => v.id !== video.id));
      showNotification('動画を削除しました', undefined, 'info');
    } catch (e) {
      showNotification(errorMessage(e), undefined, 'warning');
    }
  };

  const handleClaim = async () => {
    setClaiming(true);
    try {
      const { claimed } = await videoApi.claim();
      showNotification(`${claimed}件の投稿をアカウントに紐づけました`, undefined, 'success');
      await load();
    } catch (e) {
      showNotification(errorMessage(e), undefined, 'warning');
    } finally {
      setClaiming(false);
    }
  };

  const accountArea = user ? (
    <div className="flex items-center gap-2">
      <span className="hidden sm:inline text-xs text-slate-400 max-w-[180px] truncate">{user.email}</span>
      <button
        onClick={() => void logout()}
        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
        title="ログアウト"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  ) : (
    <button
      onClick={() => setShowLogin((v) => !v)}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 hover:bg-slate-800 cursor-pointer"
    >
      <LogIn className="w-3.5 h-3.5" />
      ログイン（任意）
    </button>
  );

  return (
    <PageShell title="動画を投稿" subtitle="ログインしなくても投稿できます" right={accountArea}>
      <div className="flex flex-col gap-4">
        <VerifyEmailBanner />

        {!user && showLogin && (
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 max-w-md">
            <AuthForm onSuccess={(_, mode) => mode === 'login' && setShowLogin(false)} />
          </div>
        )}

        {user && claimable > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-xs text-blue-100">
            <Link2 className="w-4 h-4 shrink-0" />
            <span className="flex-1 min-w-[200px]">
              この端末からログインせずに投稿した動画が {claimable}{' '}
              件あります。アカウントに紐づけると、他の端末からも管理できます。
            </span>
            <button
              onClick={handleClaim}
              disabled={claiming || !user.email_verified}
              title={user.email_verified ? undefined : 'メールアドレスの確認後に利用できます'}
              className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white cursor-pointer"
            >
              アカウントに紐づける
            </button>
          </div>
        )}

        {!user && (
          <p className="text-[11px] text-slate-500">
            ログインせずに投稿した動画は、この端末（ブラウザ）からのみ確認・削除できます。ログインするとアカウントに紐づけられます。
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <section className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
            <h2 className="text-sm font-bold text-white mb-3">新しい動画</h2>
            <UploadPanel mode="user" onUploaded={() => void load()} />
          </section>
          <MyVideosList videos={videos} loading={loading} error={error} onReload={load} onDelete={handleDelete} />
        </div>
      </div>
    </PageShell>
  );
};
