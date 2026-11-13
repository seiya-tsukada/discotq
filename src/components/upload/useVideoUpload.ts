import { useCallback, useEffect, useRef, useState } from 'react';
import { adminApi, errorMessage, putToSignedUrl, videoApi } from '../../lib/api';
import {
  captureThumbnail,
  readVideoMetadata,
  resolveVideoMime,
  validateDuration,
  validateVideoFile,
  VideoMetadata,
} from '../../lib/videoFile';
import type { MyVideo, UploadConfig, VideoMime } from '../../types/api';

export type UploadPhase = 'idle' | 'preparing' | 'ready' | 'uploading' | 'completing' | 'done' | 'error';

export interface SelectedVideo {
  file: File;
  mime: VideoMime;
  meta: VideoMetadata;
  previewUrl: string;
  thumbnail: Blob | null;
  thumbnailUrl: string | null;
}

export interface UploadInput {
  title: string;
  description: string;
  autoApprove?: boolean;
}

let cachedConfig: Promise<UploadConfig> | null = null;
const loadUploadConfig = () => {
  cachedConfig ??= videoApi.uploadConfig().catch((e) => {
    cachedConfig = null;
    throw e;
  });
  return cachedConfig;
};

// 投稿フロー: ファイル選択 → メタ情報・サムネ生成 → intent → R2 へ直接 PUT（進捗）→ complete
export const useVideoUpload = (mode: 'user' | 'admin') => {
  const [config, setConfig] = useState<UploadConfig | null>(null);
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [selected, setSelected] = useState<SelectedVideo | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [result, setResult] = useState<MyVideo | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadUploadConfig()
      .then(setConfig)
      .catch((e) => setError(`アップロード設定を取得できませんでした: ${errorMessage(e)}`));
  }, []);

  // プレビュー用の Object URL を解放する
  useEffect(
    () => () => {
      if (selected) {
        URL.revokeObjectURL(selected.previewUrl);
        if (selected.thumbnailUrl) URL.revokeObjectURL(selected.thumbnailUrl);
      }
    },
    [selected]
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setSelected(null);
    setPhase('idle');
    setProgress(0);
    setError(null);
    setWarning(null);
    setResult(null);
  }, []);

  const selectFile = useCallback(
    async (file: File) => {
      if (!config) return;
      reset();
      const invalid = validateVideoFile(file, config);
      const mime = resolveVideoMime(file);
      if (invalid || !mime) {
        setError(invalid ?? '非対応の形式です');
        setPhase('error');
        return;
      }
      setPhase('preparing');
      try {
        const meta = await readVideoMetadata(file);
        const tooLong = validateDuration(meta.durationSec, config.max_video_duration_sec);
        if (tooLong) throw new Error(tooLong);

        let thumbnail: Blob | null = null;
        try {
          thumbnail = await captureThumbnail(file);
          if (thumbnail.size > config.max_thumbnail_bytes) thumbnail = null;
        } catch {
          setWarning('サムネイルを自動生成できませんでした。サムネイルなしで投稿します。');
        }
        if (meta.height > 0 && meta.width > meta.height) {
          setWarning((w) => w ?? '横長の動画です。フィードは縦型（9:16）表示のため上下左右が切り取られます。');
        }
        setSelected({
          file,
          mime,
          meta,
          previewUrl: URL.createObjectURL(file),
          thumbnail,
          thumbnailUrl: thumbnail ? URL.createObjectURL(thumbnail) : null,
        });
        setPhase('ready');
      } catch (e) {
        setError(errorMessage(e));
        setPhase('error');
      }
    },
    [config, reset]
  );

  const upload = useCallback(
    async ({ title, description, autoApprove }: UploadInput) => {
      if (!selected) return;
      const controller = new AbortController();
      abortRef.current = controller;
      setError(null);
      setPhase('uploading');
      setProgress(0);
      try {
        const body = {
          filename: selected.file.name,
          mime_type: selected.mime,
          size_bytes: selected.file.size,
          duration_sec: Math.round(selected.meta.durationSec * 100) / 100,
          width: selected.meta.width || undefined,
          height: selected.meta.height || undefined,
          title: title.trim(),
          description: description.trim(),
          thumbnail: selected.thumbnail ? { size_bytes: selected.thumbnail.size } : null,
        };
        const intent =
          mode === 'admin'
            ? await adminApi.createIntent({ ...body, auto_approve: !!autoApprove })
            : await videoApi.createIntent(body);

        const thumbBytes = intent.thumbnail_upload && selected.thumbnail ? selected.thumbnail.size : 0;
        const total = selected.file.size + thumbBytes;
        await putToSignedUrl(intent.upload, selected.file, (loaded) => setProgress(loaded / total), controller.signal);
        if (intent.thumbnail_upload && selected.thumbnail) {
          await putToSignedUrl(
            intent.thumbnail_upload,
            selected.thumbnail,
            (loaded) => setProgress((selected.file.size + loaded) / total),
            controller.signal
          );
        }
        setProgress(1);
        setPhase('completing');
        const done = await videoApi.complete(intent.video_id);
        setResult(done);
        setPhase('done');
        return done;
      } catch (e) {
        setError(errorMessage(e));
        setPhase('error');
        return undefined;
      } finally {
        abortRef.current = null;
      }
    },
    [mode, selected]
  );

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  return { config, phase, selected, progress, error, warning, result, selectFile, upload, cancel, reset };
};
