from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel


class LikeResponse(BaseModel):
    liked: bool
    like_count: int


class BookmarkResponse(BaseModel):
    bookmarked: bool


class MyEngagementResponse(BaseModel):
    # 公開中の動画だけを新しい順に返す
    liked_video_ids: list[UUID]
    bookmarked_video_ids: list[UUID]
