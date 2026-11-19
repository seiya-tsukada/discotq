from __future__ import annotations

from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, StringConstraints

# 前後の空白を除いてから長さを見る（空白だけのコメントは投稿できない）
CommentBody = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]


class CreateCommentRequest(BaseModel):
    body: CommentBody


class Comment(BaseModel):
    id: UUID
    video_id: UUID
    # 投稿者の表示名。未設定なら null（メールアドレスは公開しない）
    author_name: str | None
    body: str
    created_at: datetime
    is_mine: bool
    # 本人か管理者なら削除できる
    can_delete: bool


class CommentsResponse(BaseModel):
    items: list[Comment]
    next_cursor: str | None
    # 削除済みを除いた件数
    total_count: int
