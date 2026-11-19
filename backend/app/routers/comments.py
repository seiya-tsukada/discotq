"""動画へのコメント。

* 一覧は誰でも見られる（公開中の動画のみ）
* 投稿はメール確認済みのログインユーザーだけ。連投は間隔と 1 時間あたりの件数で止める
* 削除は本人か管理者が行い、論理削除（本文は残す）。操作は監査ログに残す
"""

from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Query

from backend.app.auth import ConnDep, CurrentUser, PrincipalDep, UserDep, VerifiedUserDep
from backend.app.errors import ApiError, not_found
from backend.app.pagination import decode_cursor, encode_cursor
from backend.app.repositories import comments as comments_repo
from backend.app.repositories.audit import write_audit_log
from backend.app.routers.engagement import require_public_video
from backend.app.schemas.comments import Comment, CommentsResponse, CreateCommentRequest
from backend.app.schemas.common import OkResponse

router = APIRouter(tags=["comments"])

# 連投対策: 前の投稿から最低これだけ空ける / 1 時間に投稿できる件数
COMMENT_MIN_INTERVAL_SEC = 10
COMMENT_HOURLY_LIMIT = 30


def to_comment(r: dict[str, Any], viewer: CurrentUser | None) -> Comment:
    is_mine = viewer is not None and viewer.id == r["user_id"]
    return Comment(
        id=r["id"],
        video_id=r["video_id"],
        author_name=r["author_name"],
        body=r["body"],
        created_at=r["created_at"],
        is_mine=is_mine,
        can_delete=is_mine or (viewer is not None and viewer.is_admin),
    )


def enforce_comment_rate_limit(conn: ConnDep, user: CurrentUser) -> None:
    since = comments_repo.seconds_since_last_post(conn, user.id)
    if since is not None and since < COMMENT_MIN_INTERVAL_SEC:
        wait = max(1, int(COMMENT_MIN_INTERVAL_SEC - since) + 1)
        raise ApiError(
            429,
            "rate_limited",
            f"コメントの連続投稿はできません。{wait} 秒ほどおいて再度お試しください",
            retry_after_sec=wait,
        )
    if comments_repo.count_recent_posts(conn, user.id, minutes=60) >= COMMENT_HOURLY_LIMIT:
        raise ApiError(
            429,
            "rate_limited",
            f"1 時間に投稿できるコメントは {COMMENT_HOURLY_LIMIT} 件までです。時間をおいて再度お試しください",
            limit=COMMENT_HOURLY_LIMIT,
        )


@router.get("/videos/{video_id}/comments", response_model=CommentsResponse)
def list_comments(
    video_id: UUID,
    conn: ConnDep,
    principal: PrincipalDep,
    cursor: str | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> CommentsResponse:
    """公開中の動画のコメントを新しい順に返す（カーソルページング）。"""
    require_public_video(conn, video_id)
    after = decode_cursor(cursor) if cursor else None
    rows = comments_repo.list_for_video(conn, video_id, limit=limit + 1, after=after)
    has_more = len(rows) > limit
    rows = rows[:limit]
    return CommentsResponse(
        items=[to_comment(r, principal.user) for r in rows],
        next_cursor=encode_cursor(rows[-1]["created_at"], rows[-1]["id"]) if has_more and rows else None,
        total_count=comments_repo.count_for_video(conn, video_id),
    )


@router.post("/videos/{video_id}/comments", response_model=Comment, status_code=201)
def create_comment(
    video_id: UUID, req: CreateCommentRequest, conn: ConnDep, user: VerifiedUserDep
) -> Comment:
    require_public_video(conn, video_id)
    enforce_comment_rate_limit(conn, user)
    row = comments_repo.create(conn, video_id=video_id, user_id=user.id, body=req.body)
    return to_comment(row, user)


@router.delete("/comments/{comment_id}", response_model=OkResponse)
def delete_comment(comment_id: UUID, conn: ConnDep, user: UserDep) -> OkResponse:
    """本人または管理者が削除する。動画が非公開になった後でも本人は消せる。"""
    row = comments_repo.get(conn, comment_id)
    if row is None or row["deleted_at"] is not None:
        raise not_found("コメントが見つかりません")
    is_owner = row["user_id"] == user.id
    is_admin = user.is_admin and user.email_verified
    if not is_owner and not is_admin:
        raise ApiError(403, "forbidden", "このコメントは削除できません")
    if not comments_repo.soft_delete(conn, comment_id, deleted_by=user.id):
        # 同時に削除された
        raise not_found("コメントが見つかりません")
    write_audit_log(
        conn,
        actor_type="user" if is_owner else "admin",
        actor_id=str(user.id),
        action="comment.delete",
        target_type="comment",
        target_id=str(comment_id),
        payload={"video_id": str(row["video_id"]), "author_id": str(row["user_id"])},
    )
    return OkResponse()
