"""死活監視。

* ``GET /api/health``       : liveness。DB に接続しない（安価なので頻繁に叩いてよい）
* ``GET /api/health/ready`` : readiness。DB に ``select 1`` が通れば 200、届かなければ 503。
  呼ぶたびに DB 接続を開くため、外形監視やデプロイ後の確認に使う
"""

from __future__ import annotations

import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from backend.app import db
from backend.app.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
def health() -> dict[str, str]:
    return {"status": "ok", "email": get_settings().email_backend}


@router.get("/ready", response_model=None)
def health_ready() -> dict[str, str] | JSONResponse:
    try:
        db.ping()
    except Exception:  # noqa: BLE001 - 原因はログに残し、応答では詳細を出さない
        logger.exception("health/ready: database check failed")
        return JSONResponse({"status": "error", "db": "unavailable"}, status_code=503)
    return {"status": "ok", "db": "ok"}
