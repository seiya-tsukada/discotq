from __future__ import annotations

from fastapi import APIRouter

from backend.app.db import connect

router = APIRouter(tags=["health"])


@router.get("/health")
def health(deep: bool = False) -> dict[str, str]:
    """死活監視。``?deep=true`` で DB 接続も確認する。"""
    result = {"status": "ok"}
    if deep:
        try:
            with connect() as conn:
                conn.execute("select 1")
            result["db"] = "ok"
        except Exception:  # noqa: BLE001
            result["status"] = "degraded"
            result["db"] = "error"
    return result
