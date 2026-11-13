import type { UploadConfig, VideoMime, VideoStatus } from '../types/api';

export interface VideoMetadata {
  durationSec: number;
  width: number;
  height: number;
}

export const THUMBNAIL_MAX_EDGE = 720;
export const THUMBNAIL_QUALITY = 0.8;

// ブラウザによって .mov の MIME が空になることがあるため拡張子でも判定する
export const resolveVideoMime = (file: Pick<File, 'type' | 'name'>): VideoMime | null => {
  const type = file.type.toLowerCase();
  if (type === 'video/mp4' || type === 'video/webm' || type === 'video/quicktime') return type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'mp4' || ext === 'm4v') return 'video/mp4';
  if (ext === 'webm') return 'video/webm';
  if (ext === 'mov') return 'video/quicktime';
  return null;
};

export const validateVideoFile = (
  file: Pick<File, 'type' | 'name' | 'size'>,
  config: Pick<UploadConfig, 'max_upload_bytes' | 'allowed_mime_types'>
): string | null => {
  const mime = resolveVideoMime(file);
  if (!mime || !config.allowed_mime_types.includes(mime)) {
    return '対応している形式は MP4 / WebM / MOV です';
  }
  if (file.size <= 0) return 'ファイルが空です';
  if (file.size > config.max_upload_bytes) {
    return `ファイルサイズの上限は ${formatBytes(config.max_upload_bytes)} です`;
  }
  return null;
};

export const validateDuration = (durationSec: number, maxSec: number): string | null =>
  durationSec > maxSec ? `動画の長さの上限は ${maxSec} 秒です（この動画は ${Math.ceil(durationSec)} 秒）` : null;

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

export const formatDuration = (sec: number | null | undefined): string => {
  if (sec === null || sec === undefined || !Number.isFinite(sec)) return '-';
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// サムネイルの縮小サイズ（長辺 THUMBNAIL_MAX_EDGE に収める）
export const fitWithin = (width: number, height: number, maxEdge = THUMBNAIL_MAX_EDGE) => {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
};

export const STATUS_LABELS: Record<VideoStatus, string> = {
  pending_upload: 'アップロード中',
  uploaded: 'アップロード済み',
  in_review: '審査中',
  approved: '公開中',
  rejected: '却下',
  unpublished: '非公開',
  failed: '失敗',
  deleted: '削除済み',
};

export const STATUS_TONES: Record<VideoStatus, string> = {
  pending_upload: 'bg-slate-800 text-slate-300 border-slate-700',
  uploaded: 'bg-slate-800 text-slate-300 border-slate-700',
  in_review: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  approved: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  rejected: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  unpublished: 'bg-slate-700/40 text-slate-300 border-slate-600',
  failed: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  deleted: 'bg-slate-800 text-slate-500 border-slate-700',
};

// ---------------------------------------------------------------- browser only

const loadVideoElement = (file: File): Promise<{ video: HTMLVideoElement; revoke: () => void }> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    const revoke = () => URL.revokeObjectURL(url);
    video.onloadedmetadata = () => resolve({ video, revoke });
    video.onerror = () => {
      revoke();
      reject(new Error('このブラウザでは動画を読み込めませんでした（コーデック非対応の可能性があります）'));
    };
  });

// MediaRecorder で作られた WebM などはメタデータに長さが無く duration が Infinity になる。
// 末尾へシークさせるとブラウザが実際の長さを計算するので、それを待つ
const resolveDuration = (video: HTMLVideoElement): Promise<number> =>
  new Promise((resolve, reject) => {
    if (Number.isFinite(video.duration)) {
      resolve(video.duration);
      return;
    }
    const timer = window.setTimeout(() => reject(new Error('動画の長さを取得できませんでした')), 10000);
    video.ondurationchange = () => {
      if (!Number.isFinite(video.duration)) return;
      window.clearTimeout(timer);
      video.ondurationchange = null;
      video.currentTime = 0;
      resolve(video.duration);
    };
    video.currentTime = Number.MAX_SAFE_INTEGER;
  });

export const readVideoMetadata = async (file: File): Promise<VideoMetadata> => {
  const { video, revoke } = await loadVideoElement(file);
  try {
    const durationSec = await resolveDuration(video);
    return { durationSec, width: video.videoWidth, height: video.videoHeight };
  } finally {
    revoke();
  }
};

// video 要素から 1 フレームを canvas に描画して JPEG を作る（R2 にはトランスコード機能がないため）
export const captureThumbnail = async (file: File, atSec?: number): Promise<Blob> => {
  const { video, revoke } = await loadVideoElement(file);
  try {
    const duration = await resolveDuration(video);
    const target = Math.min(atSec ?? 1, Math.max(0, duration / 2));
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('サムネイル生成がタイムアウトしました')), 10000);
      video.onseeked = () => {
        window.clearTimeout(timer);
        resolve();
      };
      video.currentTime = target;
    });
    const { width, height } = fitWithin(video.videoWidth, video.videoHeight);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas を利用できません');
    ctx.drawImage(video, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('サムネイルの生成に失敗しました'))),
        'image/jpeg',
        THUMBNAIL_QUALITY
      )
    );
  } finally {
    revoke();
  }
};
