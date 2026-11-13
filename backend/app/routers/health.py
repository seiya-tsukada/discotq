"""死活監視。

* ``GET /api/health``       : liveness。DB・ストレージに接続しない（安価なので頻繁に叩いてよい）
* ``GET /api/health/ready`` : readiness。DB に ``select 1``、R2 の両バケットに読み取り
  （ListObjectsV2, MaxKeys=1）、公開ドメインに HTTP HEAD を行い、すべて通れば 200、
  どれかが失敗すれば 503。呼ぶたびに外部へ接続するため、外形監視やデプロイ後の確認に使う
"""

from __future__ import annotations

import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from backend.app import db
from backend.app.config import get_settings
from backend.app.deps import get_storage
from backend.app.storage.base import VideoStorage

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/health", tags=["health"])

StorageDep = Annotated[VideoStorage, Depends(get_storage)]
CHECK_TIMEOUT_SEC = 3


@router.get("")
def health() -> dict[str, str]:
    return {"status": "ok", "email": get_settings().email_backend}


@router.get("/ready", response_model=None)
def health_ready(storage: StorageDep) -> dict[str, Any] | JSONResponse:
    healthy = True

    try:
        db.ping(timeout_s=CHECK_TIMEOUT_SEC)
        db_status = "ok"
    except Exception:  # noqa: BLE001 - 原因はログに残し、応答では詳細を出さない
        logger.exception("health/ready: database check failed")
        db_status = "unavailable"
        healthy = False

    try:
        storage_status = storage.check(timeout_s=CHECK_TIMEOUT_SEC)
    except Exception:  # noqa: BLE001
        logger.exception("health/ready: storage check failed")
        storage_status = {"error": "check_failed"}
    if any(v != "ok" for v in storage_status.values()):
        healthy = False

    body: dict[str, Any] = {
        "status": "ok" if healthy else "error",
        "db": db_status,
        "storage": storage_status,
    }
    return body if healthy else JSONResponse(body, status_code=503)
