"""いいね・保存。

ログイン中はアカウント（user_id）、未ログインは X-Anonymous-Id で記録する。
ログインしても匿名でのいいね・保存はアカウントに引き継がない。
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter

from backend.app.auth import ConnDep, Principal, PrincipalDep
from backend.app.db import Conn
from backend.app.errors import bad_request, not_found
from backend.app.repositories import engagement as engagement_repo
from backend.app.repositories import videos as videos_repo
from backend.app.repositories.engagement import Owner
from backend.app.schemas.engagement import BookmarkResponse, LikeResponse, MyEngagementResponse

router = APIRouter(tags=["engagement"])


def owner_of(principal: Principal) -> Owner:
    if principal.user is not None:
        return Owner(user_id=principal.user.id, anonymous_id=None)
    if principal.anonymous_id is not None:
        return Owner(user_id=None, anonymous_id=principal.anonymous_id)
    raise bad_request("anonymous_id_required", "X-Anonymous-Id ヘッダーが必要です")


def require_public_video(conn: Conn, video_id: UUID) -> None:
    video = videos_repo.get_video(conn, video_id)
    if video is None or video["status"] != "approved":
        raise not_found("動画が見つかりません")


@router.post("/videos/{video_id}/like", response_model=LikeResponse)
def like(video_id: UUID, conn: ConnDep, principal: PrincipalDep) -> LikeResponse:
    owner = owner_of(principal)
    require_public_video(conn, video_id)
    engagement_repo.add(conn, "like", video_id=video_id, owner=owner)
    return LikeResponse(liked=True, like_count=engagement_repo.count_likes(conn, video_id))


@router.delete("/videos/{video_id}/like", response_model=LikeResponse)
def unlike(video_id: UUID, conn: ConnDep, principal: PrincipalDep) -> LikeResponse:
    # 非公開になった動画でも解除はできるようにする
    engagement_repo.remove(conn, "like", video_id=video_id, owner=owner_of(principal))
    return LikeResponse(liked=False, like_count=engagement_repo.count_likes(conn, video_id))


@router.post("/videos/{video_id}/bookmark", response_model=BookmarkResponse)
def bookmark(video_id: UUID, conn: ConnDep, principal: PrincipalDep) -> BookmarkResponse:
    owner = owner_of(principal)
    require_public_video(conn, video_id)
    engagement_repo.add(conn, "bookmark", video_id=video_id, owner=owner)
    return BookmarkResponse(bookmarked=True)


@router.delete("/videos/{video_id}/bookmark", response_model=BookmarkResponse)
def unbookmark(video_id: UUID, conn: ConnDep, principal: PrincipalDep) -> BookmarkResponse:
    engagement_repo.remove(conn, "bookmark", video_id=video_id, owner=owner_of(principal))
    return BookmarkResponse(bookmarked=False)


@router.get("/me/engagement", response_model=MyEngagementResponse)
def my_engagement(conn: ConnDep, principal: PrincipalDep) -> MyEngagementResponse:
    """自分がいいね・保存した公開中の動画 ID。本人が特定できなければ空を返す。"""
    if principal.user is None and principal.anonymous_id is None:
        return MyEngagementResponse(liked_video_ids=[], bookmarked_video_ids=[])
    owner = owner_of(principal)
    return MyEngagementResponse(
        liked_video_ids=engagement_repo.list_video_ids(conn, "like", owner=owner),
        bookmarked_video_ids=engagement_repo.list_video_ids(conn, "bookmark", owner=owner),
    )
