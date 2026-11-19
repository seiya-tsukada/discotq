// バックエンド (backend/app/schemas) のレスポンス型
import type { LedgerKind, UserLevel } from './index';

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
  is_pickup: boolean;
  /** ユーザー投稿の投稿者の表示名（未設定・匿名・運営投稿は null） */
  uploader_name: string | null;
  title: string;
  description: string;
  video_url: string;
  thumb_url: string | null;
  mime_type: string;
  duration_sec: number | null;
  width: number | null;
  height: number | null;
  approved_at: string;
  // フィードは CDN で短時間キャッシュされるため、少し遅れることがある
  like_count: number;
  // 削除済みを除いたコメント数（like_count と同じく少し遅れることがある）
  comment_count: number;
}

export interface FeedResponse {
  items: FeedVideo[];
  next_cursor: string | null;
}

export interface LikeResponse {
  liked: boolean;
  like_count: number;
}

export interface BookmarkResponse {
  bookmarked: boolean;
}

export interface MyEngagementResponse {
  liked_video_ids: string[];
  bookmarked_video_ids: string[];
}

export interface VideoComment {
  id: string;
  video_id: string;
  /** 投稿者の表示名。未設定なら null */
  author_name: string | null;
  body: string;
  created_at: string;
  is_mine: boolean;
  /** 本人か管理者なら削除できる */
  can_delete: boolean;
}

export interface CommentsResponse {
  items: VideoComment[];
  next_cursor: string | null;
  total_count: number;
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
  pickup?: boolean;
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
  is_pickup: boolean;
  picked_up_at: string | null;
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

// ---------------------------------------------------------------- rewards

export interface RewardSummary {
  owner: 'user' | 'anonymous';
  balance: number;
  total_earned: number;
  level: UserLevel;
}

export interface MyRewardsResponse extends RewardSummary {
  claimed_video_ids: string[];
}

export interface StartViewResponse {
  view_session_id: string;
  min_watch_seconds: number;
  reward_points: number;
  already_claimed: boolean;
  reward_eligible: boolean;
}

export interface ClaimRewardResponse {
  earned: boolean;
  points: number;
  video_id: string;
  summary: RewardSummary;
}

export interface LedgerEntry {
  id: string;
  kind: LedgerKind;
  points: number;
  title: string;
  video_id: string | null;
  gift_id: string | null;
  gift_code: string | null;
  created_at: string;
}

export interface RewardHistoryResponse {
  items: LedgerEntry[];
  next_cursor: string | null;
}

export interface ActivateRewardsResponse {
  transferred_points: number;
  welcome_points: number;
  summary: RewardSummary;
}

export interface ApiGift {
  id: string;
  name: string;
  brand: string;
  points_cost: number;
  icon_url: string;
  category: string;
  stock: number;
  popular: boolean;
  value_description: string;
}

export interface ExchangeResponse {
  gift: ApiGift;
  code: string;
  summary: RewardSummary;
}
