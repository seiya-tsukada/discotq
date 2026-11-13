import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, LogOut, ShieldAlert } from 'lucide-react';
import { PageShell } from '../../components/PageShell';
import { AuthForm } from '../../components/auth/AuthForm';
import { UploadPanel } from '../../components/upload/UploadPanel';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { adminApi } from '../../lib/api';
import { STATUS_LABELS } from '../../lib/videoFile';
import type { AdminStats, VideoStatus } from '../../types/api';
import { VideoListPane } from './VideoListPane';

type Tab = 'queue' | 'published' | 'all' | 'upload';

const TABS: { id: Tab; label: string }[] = [
  { id: 'queue', label: '審査キュー' },
  { id: 'published', label: '公開中' },
  { id: 'all', label: 'すべての動画' },
  { id: 'upload', label: '運営動画のアップロード' },
];

const STAT_ORDER: VideoStatus[] = [
  'in_review',
  'approved',
  'rejected',
  'unpublished',
  'pending_upload',
  'failed',
  'deleted',
];

const AdminDashboard: React.FC = () => {
  const { showNotification } = useApp();
  const [tab, setTab] = useState<Tab>('queue');
  const [stats, setStats] = useState<AdminStats | null>(null);

  const loadStats = useCallback(() => {
    adminApi
      .stats()
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleChanged = (message: string) => {
    showNotification(message, undefined, 'success');
    loadStats();
  };
  const handleError = (message: string) => showNotification(message, undefined, 'warning');

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {STAT_ORDER.map((s) => (
          <div key={s} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
            <p className="text-[10px] text-slate-400">{STATUS_LABELS[s]}</p>
            <p className={`text-lg font-bold ${s === 'in_review' ? 'text-amber-300' : 'text-white'}`}>
              {stats?.counts[s] ?? 0}
            </p>
          </div>
        ))}
      </div>
      {stats?.oldest_in_review_at && (
        <p className="text-[11px] text-slate-400">
          最も古い審査待ち: {new Date(stats.oldest_in_review_at).toLocaleString('ja-JP')}
        </p>
      )}

      <nav className="flex gap-1 border-b border-slate-800 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 -mb-px cursor-pointer ${
              tab === t.id ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
            {t.id === 'queue' && stats?.counts.in_review ? (
              <span className="ml-1.5 px-1.5 rounded-full bg-amber-500/20 text-amber-200">
                {stats.counts.in_review}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      {tab === 'queue' && (
        <VideoListPane
          key="queue"
          fixedStatus="in_review"
          emptyMessage="審査待ちの動画はありません"
          onChanged={handleChanged}
          onError={handleError}
        />
      )}
      {tab === 'published' && (
        <VideoListPane
          key="published"
          fixedStatus="approved"
          emptyMessage="公開中の動画はありません"
          onChanged={handleChanged}
          onError={handleError}
        />
      )}
      {tab === 'all' && (
        <VideoListPane
          key="all"
          emptyMessage="該当する動画はありません"
          onChanged={handleChanged}
          onError={handleError}
        />
      )}
      {tab === 'upload' && (
        <section className="max-w-2xl p-4 rounded-xl bg-slate-900/50 border border-slate-800">
          <p className="text-xs text-slate-400 mb-3">
            運営が選定した動画（source=platform）を登録します。「審査を省略」を選ぶと、アップロード完了と同時に公開されます。
          </p>
          <UploadPanel
            mode="admin"
            onUploaded={(v) =>
              handleChanged(v.status === 'approved' ? '運営動画を公開しました' : '運営動画を審査キューに追加しました')
            }
          />
        </section>
      )}
    </div>
  );
};

export const AdminPage: React.FC = () => {
  const { user, status, logout } = useAuth();

  const right = user ? (
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
  ) : null;

  let body: React.ReactNode;
  if (status === 'loading') {
    body = (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
      </div>
    );
  } else if (!user) {
    body = (
      <div className="max-w-sm mx-auto mt-10 p-5 rounded-xl bg-slate-900 border border-slate-800">
        <p className="text-xs text-slate-400 mb-3">運営管理画面の利用にはログインが必要です。</p>
        <AuthForm allowSignup={false} />
      </div>
    );
  } else if (!user.is_admin || !user.email_verified) {
    body = (
      <div className="max-w-md mx-auto mt-16 text-center flex flex-col items-center gap-2">
        <ShieldAlert className="w-10 h-10 text-rose-400" />
        <p className="text-sm text-white font-semibold">このアカウントには管理者権限がありません</p>
        <p className="text-xs text-slate-400">
          {user.is_admin
            ? 'メールアドレスの確認が完了していません。確認メールのリンクを開いてください。'
            : '管理者の登録は運営の担当者に依頼してください（scripts/create_admin.py）。'}
        </p>
      </div>
    );
  } else {
    body = <AdminDashboard />;
  }

  return (
    <PageShell title="DiscoTQ 運営管理" subtitle="動画審査・公開管理" right={right}>
      {body}
    </PageShell>
  );
};
