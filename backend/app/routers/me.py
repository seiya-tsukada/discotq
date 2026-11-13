from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends

from backend.app.auth import ConnDep, PrincipalDep, VerifiedUserDep
from backend.app.deps import get_storage
from backend.app.errors import ApiError, bad_request
from backend.app.repositories import videos as videos_repo
from backend.app.repositories.audit import write_audit_log
from backend.app.schemas.common import OkResponse
from backend.app.schemas.videos import ClaimResponse, MyVideo, MyVideosResponse
from backend.app.services import videos as video_service
from backend.app.storage.base import VideoStorage

router = APIRouter(prefix="/me", tags=["me"])
StorageDep = Annotated[VideoStorage, Depends(get_storage)]


def to_my_video(r: dict[str, Any]) -> MyVideo:
    return MyVideo(
        id=r["id"],
        title=r["title"],
        description=r["description"],
        status=r["status"],
        rejection_reason=r["rejection_reason"],
        public_url=r["public_url"],
        thumb_url=r["thumb_url"],
        mime_type=r["mime_type"],
        size_bytes=r["size_bytes"],
        duration_sec=float(r["duration_sec"]) if r["duration_sec"] is not None else None,
        width=r["width"],
        height=r["height"],
        is_claimed=r["uploader_user_id"] is not None,
        created_at=r["created_at"],
        approved_at=r["approved_at"],
    )


@router.get("/videos", response_model=MyVideosResponse)
def my_videos(conn: ConnDep, principal: PrincipalDep) -> MyVideosResponse:
    """自分の投稿と審査ステータス。未ログインなら X-Anonymous-Id の投稿を返す。"""
    user_id = principal.user.id if principal.user else None
    rows = videos_repo.list_owned_videos(
        conn, user_id=user_id, anonymous_id=principal.anonymous_id
    )
    claimable = (
        videos_repo.count_claimable(conn, principal.anonymous_id)
        if principal.user is not None and principal.anonymous_id is not None
        else 0
    )
    return MyVideosResponse(items=[to_my_video(r) for r in rows], claimable_count=claimable)


@router.delete("/videos/{video_id}", response_model=OkResponse)
def delete_my_video(
    video_id: UUID, conn: ConnDep, storage: StorageDep, principal: PrincipalDep
) -> OkResponse:
    video = videos_repo.get_video(conn, video_id, for_update=True)
    if video is None or not video_service.can_manage_user_video(video, principal):
        raise ApiError(404, "not_found", "動画が見つかりません")
    video_service.delete_own_video(conn, storage, video=video, principal=principal)
    return OkResponse()


@router.post("/claim", response_model=ClaimResponse)
def claim(conn: ConnDep, principal: PrincipalDep, user: VerifiedUserDep) -> ClaimResponse:
    """この端末（X-Anonymous-Id）で匿名投稿した動画を、ログイン中のアカウントに紐づける。"""
    if principal.anonymous_id is None:
        raise bad_request("anonymous_id_required", "X-Anonymous-Id ヘッダーが必要です")
    ids = videos_repo.claim_anonymous_videos(conn, anonymous_id=principal.anonymous_id, user_id=user.id)
    if ids:
        write_audit_log(
            conn,
            actor_type="user",
            actor_id=str(user.id),
            action="video.claim",
            target_type="user",
            target_id=str(user.id),
            payload={"anonymous_id": str(principal.anonymous_id), "video_ids": [str(i) for i in ids]},
        )
    return ClaimResponse(claimed=len(ids))
