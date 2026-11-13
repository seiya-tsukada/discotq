"""GET /api/health（liveness）と GET /api/health/ready（DB・R2 の readiness）。"""

from __future__ import annotations

import os
from collections.abc import Iterator
from typing import Any

import httpx
import psycopg
import pytest
from fastapi.testclient import TestClient

from backend.app.config import get_settings
from backend.app.deps import get_storage
from backend.app.main import app
from backend.app.storage.r2 import R2Storage
from backend.tests.conftest import PRIVATE, requires_db

ALL_OK = {"private": "ok", "public": "ok", "public_url": "ok"}


@pytest.fixture
def public_url_ok(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("httpx.head", lambda url, **_: httpx.Response(404, request=httpx.Request("HEAD", url))
    )


@pytest.fixture
def client(storage: R2Storage, public_url_ok: None) -> Iterator[TestClient]:
    app.dependency_overrides[get_storage] = lambda: storage
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _db_unreachable(monkeypatch: pytest.MonkeyPatch) -> None:
    from backend.app import db

    def unreachable(*_args: object, **_kwargs: object) -> None:
        raise psycopg.OperationalError("connection refused")

    monkeypatch.setattr(db, "ping", unreachable)


@requires_db
def test_ready_ok_when_database_and_storage_are_reachable(client: TestClient) -> None:
    res = client.get("/api/health/ready")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "db": "ok", "storage": ALL_OK}


def test_ready_503_when_database_is_unreachable(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _db_unreachable(monkeypatch)
    res = client.get("/api/health/ready")
    assert res.status_code == 503
    assert res.json() == {"status": "error", "db": "unavailable", "storage": ALL_OK}
    # liveness は DB・ストレージに触れない
    live = client.get("/api/health")
    assert live.status_code == 200
    assert live.json() == {"status": "ok", "email": "console"}


def test_ready_503_when_bucket_is_missing(
    client: TestClient, storage: R2Storage, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setattr("backend.app.db.ping", lambda *_a, **_k: None)
    storage.client.delete_bucket(Bucket=PRIVATE)
    res = client.get("/api/health/ready")
    assert res.status_code == 503
    assert res.json() == {
        "status": "error",
        "db": "ok",
        "storage": {"private": "NoSuchBucket", "public": "ok", "public_url": "ok"},
    }
    assert "storage_check_failed target=private" in caplog.text
    assert "code=NoSuchBucket" in caplog.text


def test_ready_503_when_storage_check_raises(
    storage: R2Storage, public_url_ok: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("backend.app.db.ping", lambda *_a, **_k: None)

    class Broken:
        def check(self, **_: Any) -> dict[str, str]:
            raise RuntimeError("bug")

    app.dependency_overrides[get_storage] = lambda: Broken()
    try:
        with TestClient(app) as c:
            res = c.get("/api/health/ready")
    finally:
        app.dependency_overrides.clear()
    assert res.status_code == 503
    assert res.json()["storage"] == {"error": "check_failed"}


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
