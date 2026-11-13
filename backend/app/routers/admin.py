from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Query

from backend.app.auth import AdminDep, ConnDep, Principal, SettingsDep, get_ip_hash
from backend.app.deps import get_storage
from backend.app.errors import ApiError
from backend.app.repositories import videos as videos_repo
from backend.app.schemas.videos import (
    AdminStats,
    AdminUploadIntentRequest,
    AdminVideo,
    AdminVideoDetail,
    AdminVideosResponse,
    PreviewUrlResponse,
    RejectRequest,
    UploadIntentResponse,
    VideoReview,
    VideoSource,
    VideoStatus,
)
from backend.app.services import videos as video_service
from backend.app.storage.base import VideoStorage

router = APIRouter(prefix="/admin", tags=["admin"])
StorageDep = Annotated[VideoStorage, Depends(get_storage)]


def to_admin_video(r: dict[str, Any]) -> AdminVideo:
    return AdminVideo(
        id=r["id"],
        source=r["source"],
        status=r["status"],
        title=r["title"],
        description=r["description"],
        uploader_user_id=r["uploader_user_id"],
        uploader_email=r.get("uploader_email"),
        anonymous_id=r["anonymous_id"],
        storage_provider=r["storage_provider"],
        bucket=r["bucket"],
        object_key=r["object_key"],
        thumb_key=r["thumb_key"],
        public_url=r["public_url"],
        thumb_url=r["thumb_url"],
        mime_type=r["mime_type"],
        size_bytes=r["size_bytes"],
        duration_sec=float(r["duration_sec"]) if r["duration_sec"] is not None else None,
        width=r["width"],
        height=r["height"],
        rejection_reason=r["rejection_reason"],
        approved_by_email=r.get("approved_by_email"),
        approved_at=r["approved_at"],
        auto_approve=r["auto_approve"],
        created_at=r["created_at"],
        updated_at=r["updated_at"],
    )


def _load(conn: ConnDep, video_id: UUID) -> dict[str, Any]:
    video = videos_repo.get_video(conn, video_id, for_update=True)
    if video is None:
        raise ApiError(404, "not_found", "動画が見つかりません")
    return video


@router.get("/stats", response_model=AdminStats)
def stats(conn: ConnDep, _: AdminDep) -> AdminStats:
    return AdminStats(
        counts=videos_repo.status_counts(conn),
        oldest_in_review_at=videos_repo.oldest_in_review_at(conn),
    )


@router.get("/videos", response_model=AdminVideosResponse)
def list_videos(
    conn: ConnDep,
    _: AdminDep,
    status: VideoStatus | None = None,
    source: VideoSource | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AdminVideosResponse:
    """動画一覧。status=in_review を指定すると古い順（審査キュー）になる。"""
    rows = videos_repo.list_admin_videos(
        conn, status=status, source=source, limit=limit + 1, offset=offset
    )
    has_more = len(rows) > limit
    return AdminVideosResponse(
        items=[to_admin_video(r) for r in rows[:limit]],
        next_offset=offset + limit if has_more else None,
    )


@router.get("/videos/{video_id}", response_model=AdminVideoDetail)
def get_video(video_id: UUID, conn: ConnDep, _: AdminDep) -> AdminVideoDetail:
    video = videos_repo.get_admin_video(conn, video_id)
    if video is None:
        raise ApiError(404, "not_found", "動画が見つかりません")
    reviews = [
        VideoReview(
            action=r["action"],
            reason=r["reason"],
            reviewer_email=r["reviewer_email"],
            created_at=r["created_at"],
        )
        for r in videos_repo.list_reviews(conn, video_id)
    ]
    return AdminVideoDetail(**to_admin_video(video).model_dump(), reviews=reviews)


@router.get("/videos/{video_id}/preview-url", response_model=PreviewUrlResponse)
def preview_url(
    video_id: UUID, conn: ConnDep, storage: StorageDep, settings: SettingsDep, _: AdminDep
) -> PreviewUrlResponse:
    """審査用に非公開バケットの署名付き GET URL（短時間有効）を返す。"""
    video = videos_repo.get_video(conn, video_id)
    if video is None or video["status"] in ("pending_upload", "failed"):
        raise ApiError(404, "not_found", "プレビューできる動画がありません")
    ttl = settings.preview_url_ttl_sec
    return PreviewUrlResponse(
        video_url=storage.presign_private_download(video["object_key"], expires_in=ttl),
        thumb_url=storage.presign_private_download(video["thumb_key"], expires_in=ttl)
        if video["thumb_key"]
        else None,
        expires_in=ttl,
    )


@router.post("/videos/{video_id}/approve", response_model=AdminVideo)
def approve(video_id: UUID, conn: ConnDep, storage: StorageDep, admin: AdminDep) -> AdminVideo:
    video = video_service.approve_video(
        conn, storage, video=_load(conn, video_id), reviewer_id=admin.id
    )
    return to_admin_video(video)


@router.post("/videos/{video_id}/reject", response_model=AdminVideo)
def reject(
    video_id: UUID, req: RejectRequest, conn: ConnDep, storage: StorageDep, admin: AdminDep
) -> AdminVideo:
    video = video_service.reject_video(
        conn, storage, video=_load(conn, video_id), reviewer_id=admin.id, reason=req.reason
    )
    return to_admin_video(video)


@router.post("/videos/{video_id}/unpublish", response_model=AdminVideo)
def unpublish(
    video_id: UUID,
    conn: ConnDep,
    storage: StorageDep,
    admin: AdminDep,
    reason: Annotated[str | None, Body(embed=True, max_length=500)] = None,
) -> AdminVideo:
    video = video_service.unpublish_video(
        conn, storage, video=_load(conn, video_id), reviewer_id=admin.id, reason=reason
    )
    return to_admin_video(video)


@router.post("/uploads/intent", response_model=UploadIntentResponse, status_code=201)
def admin_upload_intent(
    req: AdminUploadIntentRequest,
    conn: ConnDep,
    storage: StorageDep,
    settings: SettingsDep,
    admin: AdminDep,
    ip_hash: Annotated[str | None, Depends(get_ip_hash)],
) -> UploadIntentResponse:
    """運営選定動画（source=platform）の投稿。完了処理は /api/uploads/{id}/complete を使う。"""
    principal = Principal(user=admin, anonymous_id=None, ip_hash=ip_hash)
    return video_service.create_upload_intent(
        conn,
        storage,
        settings,
        req=req,
        source="platform",
        principal=principal,
        auto_approve=req.auto_approve,
    )
