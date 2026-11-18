import type { FeedVideo } from '../types/api';

// フィード上の投稿者名。運営投稿は管理者個人ではなくサービス名で出す
export const PLATFORM_UPLOADER_NAME = 'DiscoTQ';
export const GUEST_UPLOADER_NAME = 'ゲスト';

export const uploaderDisplayName = (video: Pick<FeedVideo, 'source' | 'uploader_name'>): string => {
  if (video.source === 'platform') return PLATFORM_UPLOADER_NAME;
  return video.uploader_name?.trim() || GUEST_UPLOADER_NAME;
};
