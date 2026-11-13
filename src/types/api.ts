// バックエンド (backend/app/schemas) のレスポンス型

export type VideoMime = 'video/mp4' | 'video/webm' | 'video/quicktime';
export type VideoStatus =
  'pending_upload' | 'uploaded' | 'in_review' | 'approved' | 'rejected' | 'unpublished' | 'failed' | 'deleted';
export type VideoSource = 'platform' | 'user';

export interface AuthUser {
  id: string;
  email: string;
  display_name: string | null;
  email_verified: boolean;
  is_admin: boolean;
  created_at: string;
}

export interface FeedVideo {
  id: string;
  source: VideoSource;
  title: string;
  description: string;
  video_url: string;
  thumb_url: string | null;
  mime_type: string;
  duration_sec: number | null;
  width: number | null;
  height: number | null;
  approved_at: string;
}

export interface FeedResponse {
  items: FeedVideo[];
  next_cursor: string | null;
}

export interface UploadConfig {
  allowed_mime_types: VideoMime[];
  max_upload_bytes: number;
  max_video_duration_sec: number;
  max_thumbnail_bytes: number;
}

export interface PresignedPut {
  url: string;
  method: string;
  headers: Record<string, string>;
  expires_at: string | null;
}

export interface UploadIntentRequest {
  filename: string;
  mime_type: VideoMime;
  size_bytes: number;
  duration_sec: number;
  width?: number;
  height?: number;
  title: string;
  description: string;
  thumbnail?: { size_bytes: number } | null;
  auto_approve?: boolean;
}

export interface UploadIntentResponse {
  video_id: string;
  upload: PresignedPut;
  thumbnail_upload: PresignedPut | null;
}

export interface MyVideo {
  id: string;
  title: string;
  description: string;
  status: VideoStatus;
  rejection_reason: string | null;
  public_url: string | null;
  thumb_url: string | null;
  mime_type: string;
  size_bytes: number;
  duration_sec: number | null;
  width: number | null;
  height: number | null;
  is_claimed: boolean;
  created_at: string;
  approved_at: string | null;
}

export interface MyVideosResponse {
  items: MyVideo[];
  claimable_count: number;
}

export interface AdminVideo {
  id: string;
  source: VideoSource;
  status: VideoStatus;
  title: string;
  description: string;
  uploader_user_id: string | null;
  uploader_email: string | null;
  anonymous_id: string | null;
  storage_provider: string;
  bucket: string;
  object_key: string;
  thumb_key: string | null;
  public_url: string | null;
  thumb_url: string | null;
  mime_type: string;
  size_bytes: number;
  duration_sec: number | null;
  width: number | null;
  height: number | null;
  rejection_reason: string | null;
  approved_by_email: string | null;
  approved_at: string | null;
  auto_approve: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminVideoDetail extends AdminVideo {
  reviews: { action: string; reason: string | null; reviewer_email: string | null; created_at: string }[];
}

export interface AdminVideosResponse {
  items: AdminVideo[];
  next_offset: number | null;
}

export interface AdminStats {
  counts: Partial<Record<VideoStatus, number>>;
  oldest_in_review_at: string | null;
}

export interface PreviewUrlResponse {
  video_url: string;
  thumb_url: string | null;
  expires_in: number;
}
