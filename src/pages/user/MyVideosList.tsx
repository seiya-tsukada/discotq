import React, { useState } from 'react';
import { Film, Loader2, RotateCw, Trash2 } from 'lucide-react';
import { StatusBadge } from '../../components/StatusBadge';
import { formatBytes, formatDuration } from '../../lib/videoFile';
import type { MyVideo } from '../../types/api';

interface MyVideosListProps {
  videos: MyVideo[];
  loading: boolean;
  error: string | null;
  onReload: () => void;
  onDelete: (video: MyVideo) => Promise<void>;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export const MyVideosList: React.FC<MyVideosListProps> = ({ videos, loading, error, onReload, onDelete }) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (video: MyVideo) => {
    const label = video.title || '無題の動画';
    if (!window.confirm(`「${label}」を削除しますか？公開中の場合はフィードからも削除されます。`)) return;
    setDeletingId(video.id);
    try {
      await onDelete(video);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-white">自分の投稿</h2>
        <button
          onClick={onReload}
          disabled={loading}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white disabled:opacity-60 cursor-pointer"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
          更新
        </button>
      </div>

      {error && <p className="text-xs text-rose-300">{error}</p>}

      {!loading && videos.length === 0 && !error && (
        <p className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-800 rounded-lg">
          まだ投稿はありません
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {videos.map((v) => (
          <li key={v.id} className="flex gap-3 p-3 rounded-lg bg-slate-900 border border-slate-800">
            <div className="w-14 aspect-[9/16] rounded bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
              {v.thumb_url ? (
                <img src={v.thumb_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Film className="w-5 h-5 text-slate-600" />
              )}
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <StatusBadge status={v.status} />
                <p className="text-sm text-white truncate">{v.title || '無題の動画'}</p>
              </div>
              <p className="text-[11px] text-slate-500">
                {formatDate(v.created_at)} ・ {formatDuration(v.duration_sec)} ・ {formatBytes(v.size_bytes)}
                {!v.is_claimed && ' ・ この端末の匿名投稿'}
              </p>
              {v.status === 'rejected' && v.rejection_reason && (
                <p className="text-xs text-rose-200 bg-rose-500/10 border border-rose-500/20 rounded px-2 py-1">
                  却下理由: {v.rejection_reason}
                </p>
              )}
              {v.status === 'in_review' && <p className="text-[11px] text-amber-200/80">運営が内容を確認しています</p>}
              {v.status === 'failed' && (
                <p className="text-[11px] text-rose-200/80">アップロードに失敗しました。もう一度投稿してください</p>
              )}
              {v.status === 'approved' && v.public_url && (
                <a
                  href={v.public_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-blue-400 hover:underline"
                >
                  公開中の動画を開く
                </a>
              )}
            </div>
            <button
              onClick={() => handleDelete(v)}
              disabled={deletingId === v.id}
              className="self-start p-1.5 rounded-md text-slate-500 hover:text-rose-300 hover:bg-rose-500/10 disabled:opacity-60 cursor-pointer"
              title="削除"
            >
              {deletingId === v.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};
