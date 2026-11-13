from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from backend.app.auth import ConnDep, PrincipalDep, SettingsDep
from backend.app.deps import get_storage
from backend.app.routers.me import to_my_video
from backend.app.schemas.videos import (
    MIME_EXTENSIONS,
    MyVideo,
    UploadConfig,
    UploadIntentRequest,
    UploadIntentResponse,
)
from backend.app.services import videos as video_service
from backend.app.storage.base import VideoStorage

router = APIRouter(prefix="/uploads", tags=["uploads"])
StorageDep = Annotated[VideoStorage, Depends(get_storage)]


@router.get("/config", response_model=UploadConfig)
def upload_config(settings: SettingsDep) -> UploadConfig:
    """フロントで事前チェックするためのアップロード上限。"""
    return UploadConfig(
        allowed_mime_types=list(MIME_EXTENSIONS),
        max_upload_bytes=settings.max_upload_bytes,
        max_video_duration_sec=settings.max_video_duration_sec,
        max_thumbnail_bytes=settings.max_thumbnail_bytes,
    )


@router.post("/intent", response_model=UploadIntentResponse, status_code=201)
def upload_intent(
    req: UploadIntentRequest,
    conn: ConnDep,
    storage: StorageDep,
    settings: SettingsDep,
    principal: PrincipalDep,
) -> UploadIntentResponse:
    """エンドユーザーの動画投稿を開始し、R2 への署名付き PUT URL を返す。ログインは任意。"""
    return video_service.create_upload_intent(
        conn, storage, settings, req=req, source="user", principal=principal
    )


@router.post("/{video_id}/complete", response_model=MyVideo)
def upload_complete(
    video_id: UUID, conn: ConnDep, storage: StorageDep, principal: PrincipalDep
) -> MyVideo:
    """R2 へのアップロード完了を通知する。実ファイルを検証して審査待ちにする。"""
    video = video_service.complete_upload(conn, storage, video_id=video_id, principal=principal)
    return to_my_video(video)
