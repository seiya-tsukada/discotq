from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

VideoMime = Literal["video/mp4", "video/webm", "video/quicktime"]
VideoStatus = Literal[
    "pending_upload",
    "uploaded",
    "in_review",
    "approved",
    "rejected",
    "unpublished",
    "failed",
    "deleted",
]
VideoSource = Literal["platform", "user"]

MIME_EXTENSIONS: dict[str, str] = {
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
}
THUMBNAIL_MIME = "image/jpeg"


class UploadConfig(BaseModel):
    allowed_mime_types: list[str]
    max_upload_bytes: int
    max_video_duration_sec: int
    max_thumbnail_bytes: int


class ThumbnailSpec(BaseModel):
    size_bytes: int = Field(gt=0)


class UploadIntentRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    mime_type: VideoMime
    size_bytes: int = Field(gt=0)
    duration_sec: float = Field(ge=0)
    width: int | None = Field(default=None, gt=0, le=10000)
    height: int | None = Field(default=None, gt=0, le=10000)
    title: str = Field(default="", max_length=100)
    description: str = Field(default="", max_length=2000)
    thumbnail: ThumbnailSpec | None = None


class AdminUploadIntentRequest(UploadIntentRequest):
    # True なら complete 時に審査を省略して承認済みにする
    auto_approve: bool = False


class PresignedPut(BaseModel):
    url: str
    method: str
    headers: dict[str, str]
    expires_at: datetime | None


class UploadIntentResponse(BaseModel):
    video_id: UUID
    upload: PresignedPut
    thumbnail_upload: PresignedPut | None


class FeedItem(BaseModel):
    id: UUID
    source: VideoSource
    title: str
    description: str
    video_url: str
    thumb_url: str | None
    mime_type: str
    duration_sec: float | None
    width: int | None
    height: int | None
    approved_at: datetime


class FeedResponse(BaseModel):
    items: list[FeedItem]
    next_cursor: str | None


class MyVideo(BaseModel):
    id: UUID
    title: str
    description: str
    status: VideoStatus
    rejection_reason: str | None
    public_url: str | None
    thumb_url: str | None
    mime_type: str
    size_bytes: int
    duration_sec: float | None
    width: int | None
    height: int | None
    is_claimed: bool
    created_at: datetime
    approved_at: datetime | None


class MyVideosResponse(BaseModel):
    items: list[MyVideo]
    # ログイン中かつこの端末に未紐づけの匿名投稿がある場合の件数（紐づけ導線の表示に使う）
    claimable_count: int


class ClaimResponse(BaseModel):
    claimed: int


class VideoReview(BaseModel):
    action: str
    reason: str | None
    reviewer_email: str | None
    created_at: datetime


class AdminVideo(BaseModel):
    id: UUID
    source: VideoSource
    status: VideoStatus
    title: str
    description: str
    uploader_user_id: UUID | None
    uploader_email: str | None
    anonymous_id: UUID | None
    storage_provider: str
    bucket: str
    object_key: str
    thumb_key: str | None
    public_url: str | None
    thumb_url: str | None
    mime_type: str
    size_bytes: int
    duration_sec: float | None
    width: int | None
    height: int | None
    rejection_reason: str | None
    approved_by_email: str | None
    approved_at: datetime | None
    auto_approve: bool
    created_at: datetime
    updated_at: datetime


class AdminVideosResponse(BaseModel):
    items: list[AdminVideo]
    next_offset: int | None


class AdminVideoDetail(AdminVideo):
    reviews: list[VideoReview]


class PreviewUrlResponse(BaseModel):
    video_url: str
    thumb_url: str | None
    expires_in: int


class RejectRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


class AdminStats(BaseModel):
    counts: dict[str, int]
    oldest_in_review_at: datetime | None
