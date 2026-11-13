import React, { useRef, useState } from 'react';
import { CheckCircle2, FileVideo, Loader2, RotateCcw, UploadCloud, X } from 'lucide-react';
import { formatBytes, formatDuration, STATUS_LABELS } from '../../lib/videoFile';
import type { MyVideo } from '../../types/api';
import { useVideoUpload } from './useVideoUpload';

interface UploadPanelProps {
  mode: 'user' | 'admin';
  onUploaded?: (video: MyVideo) => void;
}

const inputClass =
  'w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500';

export const UploadPanel: React.FC<UploadPanelProps> = ({ mode, onUploaded }) => {
  const { config, phase, selected, progress, error, warning, result, selectFile, upload, cancel, reset } =
    useVideoUpload(mode);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [autoApprove, setAutoApprove] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const busy = phase === 'preparing' || phase === 'uploading' || phase === 'completing';

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void selectFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const done = await upload({ title, description, autoApprove });
    if (done) {
      setTitle('');
      setDescription('');
      onUploaded?.(done);
    }
  };

  const startOver = () => {
    reset();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (phase === 'done' && result) {
    return (
      <div className="p-5 rounded-xl bg-slate-900 border border-emerald-500/30 flex flex-col items-center gap-3 text-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-400" />
        <p className="text-sm font-semibold text-white">
          {result.status === 'approved' ? '動画を公開しました' : '投稿を受け付けました'}
        </p>
        <p className="text-xs text-slate-400">
          現在のステータス: {STATUS_LABELS[result.status]}
          {result.status === 'in_review' && '（運営の審査後にフィードへ公開されます）'}
        </p>
        <button
          onClick={startOver}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
        >
          続けて投稿する
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {!selected ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => !busy && config && fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-2 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
            dragOver ? 'border-blue-400 bg-blue-500/10' : 'border-slate-700 bg-slate-900 hover:border-slate-500'
          }`}
        >
          {phase === 'preparing' ? (
            <>
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              <p className="text-sm text-slate-300">動画を読み込み、サムネイルを生成しています…</p>
            </>
          ) : (
            <>
              <UploadCloud className="w-8 h-8 text-blue-400" />
              <p className="text-sm text-slate-200 font-semibold">ここに動画をドラッグ&ドロップ</p>
              <p className="text-xs text-slate-400">またはクリックしてファイルを選択</p>
              {config && (
                <p className="text-[11px] text-slate-500">
                  MP4 / WebM / MOV ・ 最大 {formatBytes(config.max_upload_bytes)} ・ 最長{' '}
                  {formatDuration(config.max_video_duration_sec)}（縦型 9:16 推奨）
                </p>
              )}
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,.mp4,.m4v,.webm,.mov"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      ) : (
        <div className="flex gap-4 flex-col sm:flex-row">
          <div className="relative w-full sm:w-40 aspect-[9/16] rounded-lg overflow-hidden bg-black border border-slate-800 shrink-0">
            <video
              src={selected.previewUrl}
              poster={selected.thumbnailUrl ?? undefined}
              controls
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            <div className="flex items-start gap-2">
              <FileVideo className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white truncate">{selected.file.name}</p>
                <p className="text-[11px] text-slate-400">
                  {formatBytes(selected.file.size)} ・ {formatDuration(selected.meta.durationSec)} ・{' '}
                  {selected.meta.width}×{selected.meta.height}
                </p>
              </div>
              {!busy && (
                <button
                  type="button"
                  onClick={startOver}
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                  title="選び直す"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {selected.thumbnailUrl && (
              <div className="flex items-center gap-2">
                <img
                  src={selected.thumbnailUrl}
                  alt="自動生成サムネイル"
                  className="w-10 h-14 object-cover rounded border border-slate-700"
                />
                <span className="text-[11px] text-slate-400">サムネイルを自動生成しました</span>
              </div>
            )}
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              タイトル
              <input
                className={inputClass}
                value={title}
                maxLength={100}
                onChange={(e) => setTitle(e.target.value)}
                disabled={busy}
                placeholder="例: 新商品を使ってみた"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-400">
              説明（任意）
              <textarea
                className={`${inputClass} min-h-[72px]`}
                value={description}
                maxLength={2000}
                onChange={(e) => setDescription(e.target.value)}
                disabled={busy}
              />
            </label>
            {mode === 'admin' && (
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={autoApprove}
                  onChange={(e) => setAutoApprove(e.target.checked)}
                  disabled={busy}
                />
                審査を省略してすぐに公開する
              </label>
            )}
          </div>
        </div>
      )}

      {warning && (
        <p className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          {warning}
        </p>
      )}
      {error && (
        <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{error}</p>
      )}

      {(phase === 'uploading' || phase === 'completing') && (
        <div className="flex flex-col gap-1">
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-[width] duration-200"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>
              {phase === 'completing' ? 'ファイルを確認しています…' : `アップロード中 ${Math.round(progress * 100)}%`}
            </span>
            {phase === 'uploading' && (
              <button type="button" onClick={cancel} className="text-slate-300 hover:underline cursor-pointer">
                中止
              </button>
            )}
          </div>
        </div>
      )}

      {selected && (
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
            {mode === 'admin' && autoApprove ? 'アップロードして公開' : 'アップロードして審査に出す'}
          </button>
          {phase === 'error' && (
            <button
              type="button"
              onClick={startOver}
              className="px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
              title="最初からやり直す"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </form>
  );
};
