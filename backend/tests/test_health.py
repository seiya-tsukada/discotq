"""GET /api/health（liveness、DB なし）と GET /api/health/ready（DB の readiness）。"""

from __future__ import annotations

import os
from typing import Any

import psycopg
import pytest

from backend.app.config import get_settings
from backend.tests.conftest import requires_db


@requires_db
def test_ready_ok_when_database_is_reachable(make_client: Any) -> None:
    res = make_client().get("/api/health/ready")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "db": "ok"}


def test_ready_503_when_database_is_unreachable(monkeypatch: pytest.MonkeyPatch) -> None:
    from fastapi.testclient import TestClient

    from backend.app import db
    from backend.app.main import app

    def unreachable(*_args: object, **_kwargs: object) -> None:
        raise psycopg.OperationalError("connection refused")

    monkeypatch.setattr(db, "ping", unreachable)
    with TestClient(app) as client:
        res = client.get("/api/health/ready")
        assert res.status_code == 503
        assert res.json() == {"status": "error", "db": "unavailable"}
        # liveness は DB に触れない
        live = client.get("/api/health")
        assert live.status_code == 200
        assert live.json() == {"status": "ok", "email": "console"}


@requires_db
def test_ping_succeeds_against_database() -> None:
    from backend.app.db import ping

    ping()


def test_ping_raises_when_database_is_unreachable(monkeypatch: pytest.MonkeyPatch) -> None:
    from backend.app.db import ping

    monkeypatch.setenv("DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:1/none")
    get_settings.cache_clear()
    try:
        with pytest.raises(psycopg.OperationalError):
            ping(timeout_s=1)
    finally:
        monkeypatch.setenv("DATABASE_URL", os.environ.get("TEST_DATABASE_URL") or "postgresql://invalid/none")
        get_settings.cache_clear()
