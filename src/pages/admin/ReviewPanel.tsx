import React, { useEffect, useState } from 'react';
import { CheckCircle2, EyeOff, Loader2, Star, Trash2, XCircle } from 'lucide-react';
import { StatusBadge } from '../../components/StatusBadge';
import { adminApi, errorMessage } from '../../lib/api';
import { formatBytes, formatDuration } from '../../lib/videoFile';
import type { AdminVideo, AdminVideoDetail } from '../../types/api';

interface ReviewPanelProps {
  video: AdminVideo;
  onUpdated: (video: AdminVideo, message: string) => void;
  onError: (message: string) => void;
}

const ACTION_LABELS: Record<string, string> = {
  approve: '承認',
  reject: '却下',
  unpublish: '非公開化',
  auto_approve: '自動承認',
};

const UPLOAD_INCOMPLETE: string[] = ['pending_upload', 'failed'];

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('ja-JP') : '-');

// 審査対象の詳細・プレビュー・承認/却下/非公開化
export const ReviewPanel: React.FC<ReviewPanelProps> = ({ video, onUpdated, onError }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminVideoDetail | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | 'unpublish' | 'pickup' | 'delete' | null>(null);

  useEffect(() => {
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect */
    setPreviewUrl(null);
    setPreviewError(null);
    setReason('');
    /* eslint-enable react-hooks/set-state-in-effect */
    // 公開中は public URL、それ以外は private バケットの署名付き URL（5分）で再生する
    if (video.public_url) {
      setPreviewUrl(video.public_url);
    } else if (!UPLOAD_INCOMPLETE.includes(video.status)) {
      adminApi
        .previewUrl(video.id)
        .then((r) => !cancelled && setPreviewUrl(r.video_url))
        .catch((e) => !cancelled && setPreviewError(errorMessage(e)));
    }
    adminApi
      .get(video.id)
      .then((d) => !cancelled && setDetail(d))
      .catch(() => !cancelled && setDetail(null));
    return () => {
      cancelled = true;
    };
  }, [video.id, video.public_url, video.status, video.updated_at]);

  const run = async (kind: 'approve' | 'reject' | 'unpublish') => {
    if (kind === 'reject' && !reason.trim()) {
      onError('却下理由を入力してください');
      return;
    }
    setBusy(kind);
    try {
      const updated =
        kind === 'approve'
          ? await adminApi.approve(video.id)
          : kind === 'reject'
            ? await adminApi.reject(video.id, reason.trim())
            : await adminApi.unpublish(video.id, reason.trim() || undefined);
      onUpdated(updated, `「${video.title || '無題の動画'}」を${ACTION_LABELS[kind]}しました`);
    } catch (e) {
      onError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const togglePickup = async () => {
    setBusy('pickup');
    try {
      const updated = await adminApi.setPickup(video.id, !video.is_pickup);
      onUpdated(
        updated,
        `「${video.title || '無題の動画'}」${updated.is_pickup ? 'をピックアップしました' : 'のピックアップを外しました'}`
      );
    } catch (e) {
      onError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    const label = video.title || '無題の動画';
    const note = UPLOAD_INCOMPLETE.includes(video.status)
      ? 'アップロード途中のファイルも削除されます。'
      : '公開中の場合はフィードからも削除されます。';
    if (!window.confirm(`「${label}」を削除しますか？${note}この操作は取り消せません。`)) return;
    setBusy('delete');
    try {
      const updated = await adminApi.remove(video.id);
      onUpdated(updated, `「${label}」を削除しました`);
    } catch (e) {
      onError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  // アップロードが終わっていない動画はフィードに出ないのでピックアップを付けさせない（外すのは可）
  const canPickup = video.status !== 'deleted' && (video.is_pickup || !UPLOAD_INCOMPLETE.includes(video.status));
  const canDelete = video.status !== 'deleted';
  const canApprove = ['in_review', 'rejected', 'unpublished'].includes(video.status);
  const canReject = ['in_review', 'approved', 'unpublished'].includes(video.status);
  const canUnpublish = video.status === 'approved';

  return (
    <div className="flex flex-col gap-3 p-4 rounded-xl bg-slate-900 border border-slate-800">
      <div className="flex gap-4 flex-col sm:flex-row">
        <div className="w-full sm:w-48 aspect-[9/16] rounded-lg overflow-hidden bg-black border border-slate-800 shrink-0 flex items-center justify-center">
          {previewUrl ? (
            <video
              key={previewUrl}
              src={previewUrl}
              controls
              playsInline
              muted
              className="w-full h-full object-contain"
            />
          ) : previewError ? (
            <p className="text-[11px] text-rose-300 p-2 text-center">{previewError}</p>
          ) : UPLOAD_INCOMPLETE.includes(video.status) ? (
            <p className="text-[11px] text-slate-500 p-2 text-center">プレビューできません</p>
          ) : (
            <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-1.5 text-xs">
          <div className="flex items-center gap-2">
            <StatusBadge status={video.status} />
            <span className="text-[11px] text-slate-400">
              {video.source === 'platform' ? '運営投稿' : 'ユーザー投稿'}
            </span>
            {video.is_pickup && (
              <span className="flex items-center gap-0.5 rounded-full bg-amber-400 text-amber-950 px-1.5 py-0.5 text-[10px] font-bold">
                <Star className="w-3 h-3 fill-current" />
                ピックアップ
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-white break-words">{video.title || '無題の動画'}</p>
          {video.description && <p className="text-slate-300 whitespace-pre-wrap break-words">{video.description}</p>}
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px] text-slate-400 mt-1">
            <dt>投稿者</dt>
            <dd className="truncate text-slate-300">
              {video.uploader_email ?? (video.anonymous_id ? `匿名 (${video.anonymous_id.slice(0, 8)}…)` : '-')}
            </dd>
            <dt>投稿日時</dt>
            <dd className="text-slate-300">{fmt(video.created_at)}</dd>
            <dt>形式</dt>
            <dd className="text-slate-300">
              {video.mime_type} ・ {formatBytes(video.size_bytes)} ・ {formatDuration(video.duration_sec)} ・{' '}
              {video.width ?? '?'}×{video.height ?? '?'}
            </dd>
            <dt>キー</dt>
            <dd className="text-slate-500 truncate" title={`${video.bucket}/${video.object_key}`}>
              {video.object_key}
            </dd>
            {video.approved_at && (
              <>
                <dt>承認</dt>
                <dd className="text-slate-300">
                  {fmt(video.approved_at)}（{video.approved_by_email ?? '-'}）
                </dd>
              </>
            )}
            {video.rejection_reason && (
              <>
                <dt>却下理由</dt>
                <dd className="text-rose-200">{video.rejection_reason}</dd>
              </>
            )}
          </dl>
        </div>
      </div>

      {(canReject || canUnpublish) && (
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          {canUnpublish
            ? '理由（却下は必須・非公開化は任意。投稿者に表示されます）'
            : '却下理由（必須・投稿者に表示されます）'}
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            className="w-full min-h-[60px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-blue-500"
            placeholder="例: 第三者の権利を侵害している可能性があります"
          />
        </label>
      )}

      <div className="flex flex-wrap gap-2">
        {canApprove && (
          <button
            onClick={() => run('approve')}
            disabled={busy !== null}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
          >
            {busy === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            承認して公開
          </button>
        )}
        {canReject && (
          <button
            onClick={() => run('reject')}
            disabled={busy !== null || !reason.trim()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
          >
            {busy === 'reject' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            却下
          </button>
        )}
        {canUnpublish && (
          <button
            onClick={() => run('unpublish')}
            disabled={busy !== null}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
          >
            {busy === 'unpublish' ? <Loader2 className="w-4 h-4 animate-spin" /> : <EyeOff className="w-4 h-4" />}
            非公開にする
          </button>
        )}
        {canPickup && (
          <button
            onClick={togglePickup}
            disabled={busy !== null}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg disabled:opacity-60 text-xs font-semibold cursor-pointer sm:ml-auto ${
              video.is_pickup
                ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-400/40'
                : 'bg-amber-400 hover:bg-amber-300 text-amber-950'
            }`}
          >
            {busy === 'pickup' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}
            {video.is_pickup ? 'ピックアップを外す' : 'ピックアップする'}
          </button>
        )}
        {canDelete && (
          <button
            onClick={handleDelete}
            disabled={busy !== null}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-rose-900/60 border border-rose-500/40 disabled:opacity-60 text-rose-300 text-xs font-semibold cursor-pointer ${
              canPickup ? '' : 'sm:ml-auto'
            }`}
          >
            {busy === 'delete' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            削除
          </button>
        )}
      </div>

      {detail && detail.reviews.length > 0 && (
        <div className="border-t border-slate-800 pt-2">
          <p className="text-[11px] font-semibold text-slate-400 mb-1">審査履歴</p>
          <ul className="flex flex-col gap-0.5 text-[11px] text-slate-400">
            {detail.reviews.map((r, i) => (
              <li key={i}>
                {fmt(r.created_at)} ・ {ACTION_LABELS[r.action] ?? r.action} ・ {r.reviewer_email ?? '-'}
                {r.reason && ` ・ ${r.reason}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
