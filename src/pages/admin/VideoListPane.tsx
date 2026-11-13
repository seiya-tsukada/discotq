import React, { useState } from 'react';
import { Film, Loader2, RotateCw } from 'lucide-react';
import { StatusBadge } from '../../components/StatusBadge';
import { formatDuration, STATUS_LABELS } from '../../lib/videoFile';
import type { AdminVideo, VideoSource, VideoStatus } from '../../types/api';
import { ReviewPanel } from './ReviewPanel';
import { useAdminVideos } from './useAdminVideos';

interface VideoListPaneProps {
  fixedStatus?: VideoStatus;
  emptyMessage: string;
  onChanged: (message: string) => void;
  onError: (message: string) => void;
}

const STATUS_FILTERS: (VideoStatus | '')[] = [
  '',
  'in_review',
  'approved',
  'rejected',
  'unpublished',
  'pending_upload',
  'failed',
  'deleted',
];

// 左に一覧、右に選択中の動画の審査パネルを表示する
export const VideoListPane: React.FC<VideoListPaneProps> = ({ fixedStatus, emptyMessage, onChanged, onError }) => {
  const [statusFilter, setStatusFilter] = useState<VideoStatus | ''>(fixedStatus ?? '');
  const [sourceFilter, setSourceFilter] = useState<VideoSource | ''>('');
  const { items, loading, error, reload, loadMore, applyUpdate } = useAdminVideos(
    fixedStatus ?? statusFilter,
    sourceFilter
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find((v) => v.id === selectedId) ?? items[0] ?? null;

  const handleUpdated = (video: AdminVideo, message: string) => {
    applyUpdate(video);
    onChanged(message);
    // 審査キューでは次の動画へ進む
    if (fixedStatus && video.status !== fixedStatus) setSelectedId(null);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {!fixedStatus && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as VideoStatus | '')}
              className="px-2 py-1 rounded-md bg-slate-900 border border-slate-700 text-xs text-slate-200"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {s ? STATUS_LABELS[s] : 'すべてのステータス'}
                </option>
              ))}
            </select>
          )}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as VideoSource | '')}
            className="px-2 py-1 rounded-md bg-slate-900 border border-slate-700 text-xs text-slate-200"
          >
            <option value="">すべての投稿元</option>
            <option value="user">ユーザー投稿</option>
            <option value="platform">運営投稿</option>
          </select>
          <button
            onClick={() => void reload()}
            className="ml-auto flex items-center gap-1 text-xs text-slate-400 hover:text-white cursor-pointer"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
            更新
          </button>
        </div>

        {error && <p className="text-xs text-rose-300">{error}</p>}
        {!loading && items.length === 0 && !error && (
          <p className="text-xs text-slate-500 py-8 text-center border border-dashed border-slate-800 rounded-lg">
            {emptyMessage}
          </p>
        )}

        <ul className="flex flex-col gap-1.5 max-h-[70vh] overflow-y-auto pr-1">
          {items.map((v) => (
            <li key={v.id}>
              <button
                onClick={() => setSelectedId(v.id)}
                className={`w-full flex gap-2.5 p-2 rounded-lg text-left border cursor-pointer ${
                  selected?.id === v.id
                    ? 'bg-blue-500/10 border-blue-500/40'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="w-9 aspect-[9/16] rounded bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                  {v.thumb_url ? (
                    <img src={v.thumb_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Film className="w-4 h-4 text-slate-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={v.status} />
                    <span className="text-[10px] text-slate-500">{v.source === 'platform' ? '運営' : 'ユーザー'}</span>
                  </div>
                  <p className="text-xs text-white truncate mt-0.5">{v.title || '無題の動画'}</p>
                  <p className="text-[10px] text-slate-500">
                    {new Date(v.created_at).toLocaleString('ja-JP')} ・ {formatDuration(v.duration_sec)}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
        {loadMore && (
          <button
            onClick={() => void loadMore()}
            disabled={loading}
            className="py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:bg-slate-800 cursor-pointer"
          >
            さらに読み込む
          </button>
        )}
      </div>

      <div>{selected && <ReviewPanel video={selected} onUpdated={handleUpdated} onError={onError} />}</div>
    </div>
  );
};
