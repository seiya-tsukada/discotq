"""動画のアップロード・審査に関する業務ロジック。ルーターから呼ばれる。"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from backend.app.auth import Principal
from backend.app.config import Settings
from backend.app.db import Conn
from backend.app.errors import ApiError, bad_request, conflict
from backend.app.repositories import videos as videos_repo
from backend.app.repositories.audit import ActorType, write_audit_log
from backend.app.schemas.videos import (
    MIME_EXTENSIONS,
    THUMBNAIL_MIME,
    PresignedPut,
    UploadIntentRequest,
    UploadIntentResponse,
)
from backend.app.storage.base import PresignedUpload, VideoStorage

logger = logging.getLogger(__name__)

# 審査操作ごとに許可する遷移元ステータス
APPROVABLE = frozenset({"in_review", "rejected", "unpublished"})
REJECTABLE = frozenset({"in_review", "approved", "unpublished"})
UNPUBLISHABLE = frozenset({"approved"})


def video_key(video_id: UUID, mime_type: str) -> str:
    return f"videos/{video_id}/original.{MIME_EXTENSIONS[mime_type]}"


def thumb_key(video_id: UUID) -> str:
    return f"videos/{video_id}/thumb.jpg"


def _presigned(p: PresignedUpload) -> PresignedPut:
    return PresignedPut(url=p.url, method=p.method, headers=p.headers, expires_at=p.expires_at)


# ---------------------------------------------------------------- upload


def validate_upload_request(req: UploadIntentRequest, settings: Settings) -> None:
    if req.size_bytes > settings.max_upload_bytes:
        raise ApiError(
            413,
            "file_too_large",
            f"ファイルサイズの上限は {settings.max_upload_bytes // (1024 * 1024)}MB です",
            max_bytes=settings.max_upload_bytes,
        )
    if req.duration_sec > settings.max_video_duration_sec:
        raise bad_request(
            "video_too_long",
            f"動画の長さの上限は {settings.max_video_duration_sec} 秒です",
            max_duration_sec=settings.max_video_duration_sec,
        )
    if req.thumbnail and req.thumbnail.size_bytes > settings.max_thumbnail_bytes:
        raise bad_request("thumbnail_too_large", "サムネイル画像が大きすぎます")


def enforce_user_rate_limit(conn: Conn, principal: Principal, settings: Settings) -> None:
    """ユーザー投稿のレート制限（直近 24 時間、videos 行の件数で判定）。

    * メール確認済みのログインユーザー: user_id 単位で USER_DAILY_UPLOAD_LIMIT
    * それ以外（匿名・未確認ユーザー）: anonymous_id 単位と IP 単位でそれぞれ ANON_DAILY_UPLOAD_LIMIT
    """
    user = principal.user
    if user is not None and user.email_verified:
        videos_repo.lock_uploader(conn, f"user:{user.id}")
        n = videos_repo.count_recent_uploads(conn, user_id=user.id)
        limit = settings.user_daily_upload_limit
    else:
        if principal.anonymous_id is None:
            raise bad_request("anonymous_id_required", "X-Anonymous-Id ヘッダーが必要です")
        videos_repo.lock_uploader(conn, f"anon:{principal.anonymous_id}")
        if principal.ip_hash:
            videos_repo.lock_uploader(conn, f"ip:{principal.ip_hash}")
        n = max(
            videos_repo.count_recent_uploads(conn, anonymous_id=principal.anonymous_id),
            videos_repo.count_recent_uploads(conn, ip_hash=principal.ip_hash)
            if principal.ip_hash
            else 0,
        )
        limit = settings.anon_daily_upload_limit
    if n >= limit:
        raise ApiError(
            429,
            "rate_limited",
            f"1日に投稿できる動画は {limit} 件までです。時間をおいて再度お試しください",
            limit=limit,
        )


def create_upload_intent(
    conn: Conn,
    storage: VideoStorage,
    settings: Settings,
    *,
    req: UploadIntentRequest,
    source: str,
    principal: Principal,
    auto_approve: bool = False,
) -> UploadIntentResponse:
    validate_upload_request(req, settings)
    if source == "user":
        enforce_user_rate_limit(conn, principal, settings)

    video_id = uuid4()
    key = video_key(video_id, req.mime_type)
    t_key = thumb_key(video_id) if req.thumbnail else None

    videos_repo.create_video(
        conn,
        video_id=video_id,
        source=source,
        uploader_user_id=principal.user.id if principal.user else None,
        anonymous_id=principal.anonymous_id if source == "user" else None,
        uploader_ip_hash=principal.ip_hash,
        title=req.title.strip(),
        description=req.description.strip(),
        storage_provider=storage.provider,
        bucket=storage.private_location,
        object_key=key,
        thumb_key=t_key,
        mime_type=req.mime_type,
        size_bytes=req.size_bytes,
        duration_sec=req.duration_sec,
        width=req.width,
        height=req.height,
        auto_approve=auto_approve,
    )
    actor_type, actor_id = principal.actor
    write_audit_log(
        conn,
        actor_type=_as_actor(actor_type),
        actor_id=actor_id,
        action="video.upload_intent",
        target_type="video",
        target_id=str(video_id),
        payload={
            "source": source,
            "filename": req.filename,
            "mime_type": req.mime_type,
            "size_bytes": req.size_bytes,
            "auto_approve": auto_approve,
        },
    )

    upload = storage.presign_private_upload(
        key,
        content_type=req.mime_type,
        content_length=req.size_bytes,
        expires_in=settings.upload_url_ttl_sec,
    )
    thumb_upload = (
        storage.presign_private_upload(
            t_key,
            content_type=THUMBNAIL_MIME,
            content_length=req.thumbnail.size_bytes,
            expires_in=settings.upload_url_ttl_sec,
        )
        if t_key and req.thumbnail
        else None
    )
    return UploadIntentResponse(
        video_id=video_id,
        upload=_presigned(upload),
        thumbnail_upload=_presigned(thumb_upload) if thumb_upload else None,
    )


def can_manage_user_video(video: dict[str, Any], principal: Principal) -> bool:
    """エンドユーザーが自分の投稿として操作できるか。

    アカウントに紐づいた投稿はそのユーザーだけ、未紐づけの匿名投稿は同じ anonymous_id だけが操作できる。
    """
    if video["source"] != "user":
        return False
    if video["uploader_user_id"] is not None:
        return principal.user is not None and principal.user.id == video["uploader_user_id"]
    return principal.anonymous_id is not None and principal.anonymous_id == video["anonymous_id"]


def complete_upload(
    conn: Conn,
    storage: VideoStorage,
    *,
    video_id: UUID,
    principal: Principal,
) -> dict[str, Any]:
    video = videos_repo.get_video(conn, video_id, for_update=True)
    if video is None:
        raise ApiError(404, "not_found", "動画が見つかりません")

    if video["source"] == "platform":
        if principal.user is None or not principal.user.is_admin:
            raise ApiError(404, "not_found", "動画が見つかりません")
    elif not can_manage_user_video(video, principal):
        raise ApiError(404, "not_found", "動画が見つかりません")

    if video["status"] != "pending_upload":
        raise conflict("invalid_status", "この動画はアップロード完了処理の対象ではありません")

    actor_type, actor_id = principal.actor
    info = storage.head_private(video["object_key"])
    if info is None:
        # まだ PUT が終わっていない可能性があるので状態は変えない（24時間後にメンテ SQL で failed）
        raise conflict("upload_not_found", "アップロードされたファイルが見つかりません")

    mismatches: dict[str, Any] = {}
    if info.size_bytes != video["size_bytes"]:
        mismatches["size_bytes"] = {"expected": video["size_bytes"], "actual": info.size_bytes}
    if (info.content_type or "").split(";")[0].strip().lower() != video["mime_type"]:
        mismatches["content_type"] = {"expected": video["mime_type"], "actual": info.content_type}

    if mismatches:
        _safe_delete_private(storage, video["object_key"])
        if video["thumb_key"]:
            _safe_delete_private(storage, video["thumb_key"])
        videos_repo.update_video(conn, video_id, status="failed")
        write_audit_log(
            conn,
            actor_type=_as_actor(actor_type),
            actor_id=actor_id,
            action="video.upload_failed",
            target_type="video",
            target_id=str(video_id),
            payload={"mismatches": mismatches},
        )
        # failed への更新は残したいので、エラー応答の前に確定させる
        conn.commit()
        raise bad_request("upload_mismatch", "アップロードされたファイルが申告内容と一致しません")

    # サムネイルは任意。欠けている・不正な場合は動画自体は受け付け、サムネ無しとして扱う
    if video["thumb_key"]:
        t_info = storage.head_private(video["thumb_key"])
        if t_info is None or (t_info.content_type or "").lower() != THUMBNAIL_MIME:
            if t_info is not None:
                _safe_delete_private(storage, video["thumb_key"])
            video = videos_repo.update_video(conn, video_id, thumb_key=None)

    video = videos_repo.update_video(conn, video_id, status="in_review")
    write_audit_log(
        conn,
        actor_type=_as_actor(actor_type),
        actor_id=actor_id,
        action="video.upload_complete",
        target_type="video",
        target_id=str(video_id),
        payload={"size_bytes": info.size_bytes},
    )

    if video["source"] == "platform" and video["auto_approve"]:
        assert principal.user is not None
        video = approve_video(
            conn, storage, video=video, reviewer_id=principal.user.id, action="auto_approve"
        )
    return video


# ---------------------------------------------------------------- review


def approve_video(
    conn: Conn,
    storage: VideoStorage,
    *,
    video: dict[str, Any],
    reviewer_id: UUID,
    action: str = "approve",
) -> dict[str, Any]:
    if video["status"] not in APPROVABLE:
        raise conflict("invalid_status", f"現在のステータス（{video['status']}）からは承認できません")
    public_url = storage.publish(video["object_key"])
    thumb_url = storage.publish(video["thumb_key"]) if video["thumb_key"] else None
    updated = videos_repo.update_video(
        conn,
        video["id"],
        status="approved",
        public_url=public_url,
        thumb_url=thumb_url,
        approved_by=reviewer_id,
        approved_at=datetime.now(UTC),
        rejection_reason=None,
    )
    _record_review(conn, video=video, reviewer_id=reviewer_id, action=action, reason=None)
    return updated


def reject_video(
    conn: Conn, storage: VideoStorage, *, video: dict[str, Any], reviewer_id: UUID, reason: str
) -> dict[str, Any]:
    reason = reason.strip()
    if not reason:
        raise bad_request("reason_required", "却下理由を入力してください")
    if video["status"] not in REJECTABLE:
        raise conflict("invalid_status", f"現在のステータス（{video['status']}）からは却下できません")
    _remove_public_copies(storage, video)
    updated = videos_repo.update_video(
        conn,
        video["id"],
        status="rejected",
        rejection_reason=reason,
        public_url=None,
        thumb_url=None,
    )
    _record_review(conn, video=video, reviewer_id=reviewer_id, action="reject", reason=reason)
    return updated


def unpublish_video(
    conn: Conn, storage: VideoStorage, *, video: dict[str, Any], reviewer_id: UUID, reason: str | None
) -> dict[str, Any]:
    if video["status"] not in UNPUBLISHABLE:
        raise conflict("invalid_status", "公開中の動画ではありません")
    _remove_public_copies(storage, video)
    updated = videos_repo.update_video(
        conn, video["id"], status="unpublished", public_url=None, thumb_url=None
    )
    _record_review(conn, video=video, reviewer_id=reviewer_id, action="unpublish", reason=reason)
    return updated


def delete_own_video(
    conn: Conn, storage: VideoStorage, *, video: dict[str, Any], principal: Principal
) -> None:
    if video["status"] == "deleted":
        return
    _remove_public_copies(storage, video)
    videos_repo.update_video(
        conn,
        video["id"],
        status="deleted",
        deleted_at=datetime.now(UTC),
        public_url=None,
        thumb_url=None,
    )
    actor_type, actor_id = principal.actor
    write_audit_log(
        conn,
        actor_type=_as_actor(actor_type),
        actor_id=actor_id,
        action="video.delete",
        target_type="video",
        target_id=str(video["id"]),
        payload={"previous_status": video["status"]},
    )


# ---------------------------------------------------------------- helpers


def _record_review(
    conn: Conn, *, video: dict[str, Any], reviewer_id: UUID, action: str, reason: str | None
) -> None:
    videos_repo.insert_review(
        conn, video_id=video["id"], reviewer_id=reviewer_id, action=action, reason=reason
    )
    write_audit_log(
        conn,
        actor_type="admin",
        actor_id=str(reviewer_id),
        action=f"video.{action}",
        target_type="video",
        target_id=str(video["id"]),
        payload={"previous_status": video["status"], "reason": reason},
    )


def _remove_public_copies(storage: VideoStorage, video: dict[str, Any]) -> None:
    if video["public_url"]:
        storage.unpublish(video["object_key"])
    if video["thumb_url"] and video["thumb_key"]:
        storage.unpublish(video["thumb_key"])


def _safe_delete_private(storage: VideoStorage, key: str) -> None:
    try:
        storage.delete_private(key)
    except Exception:  # noqa: BLE001 - 削除失敗は purge 対象として後で拾える
        logger.exception("failed to delete private object: %s", key)


def _as_actor(value: str) -> ActorType:
    assert value in ("user", "anonymous", "admin", "system")
    return value  # type: ignore[return-value]
