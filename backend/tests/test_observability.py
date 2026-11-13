"""障害時のログ出力とエラー応答（Vercel のログで原因を追えること）。DB 不要のテスト。"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from typing import Any

import httpx
import psycopg
import pytest
from botocore.exceptions import ClientError, EndpointConnectionError
from fastapi.testclient import TestClient
from pydantic import ValidationError

from backend.app.config import Settings
from backend.app.db import get_conn
from backend.app.main import app
from backend.app.observability import (
    db_url_warnings,
    describe_db_target,
    describe_settings_error,
)
from backend.app.repositories import videos as videos_repo


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app, headers={"X-Requested-With": "discotq"}) as c:
        yield c
    app.dependency_overrides.clear()


def _use_fake_conn() -> None:
    app.dependency_overrides[get_conn] = lambda: iter([object()])


# ---------------------------------------------------------------- 起動時


def test_settings_error_lists_env_names_without_values(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("R2_ACCOUNT_ID")
    monkeypatch.delenv("R2_BUCKET_PUBLIC")
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:super-secret@db:6543/postgres")
    with pytest.raises(ValidationError) as info:
        Settings(_env_file=None)
    described = describe_settings_error(info.value)
    assert "R2_ACCOUNT_ID: 未設定" in described
    assert "R2_BUCKET_PUBLIC: 未設定" in described
    # Vercel のログに秘密情報が残らない
    assert "super-secret" not in described
    assert "super-secret" not in str(info.value)


def test_describe_db_target_hides_password() -> None:
    url = "postgresql://postgres.abcdef:p%40ss@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres"
    assert describe_db_target(url) == "postgres.abcdef@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres"


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("postgresql://postgres.abc:pw@aws-0-x.pooler.supabase.com:6543/postgres", None),
        ("postgresql://postgres:pw@db.abc.supabase.co:5432/postgres", "IPv6"),
        ("postgresql://postgres.abc:pw@aws-0-x.pooler.supabase.com:5432/postgres", "6543"),
        ("postgresql://postgres:pw@aws-0-x.pooler.supabase.com:6543/postgres", "project-ref"),
        ("mysql://u:pw@host/db", "スキーム"),
    ],
)
def test_db_url_warnings(url: str, expected: str | None) -> None:
    warnings = db_url_warnings(url)
    if expected is None:
        assert warnings == []
    else:
        assert any(expected in w for w in warnings), warnings


# ---------------------------------------------------------------- リクエスト


def test_access_log_and_request_id(client: TestClient, caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.INFO, logger="discotq")
    res = client.get("/api/health", headers={"x-vercel-id": "hnd1::abc-123"})
    assert res.status_code == 200
    assert res.headers["X-Request-Id"] == "hnd1::abc-123"
    assert "GET /api/health -> 200" in caplog.text
    assert "request_id=hnd1::abc-123" in caplog.text


def test_db_unavailable_returns_503_and_logs(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    def unreachable() -> Iterator[Any]:
        raise psycopg.OperationalError('connection to server at "db" failed: Connection refused')
        yield  # pragma: no cover

    app.dependency_overrides[get_conn] = unreachable
    res = client.get("/api/videos/feed", headers={"x-vercel-id": "hnd1::db"})
    assert res.status_code == 503
    assert res.json()["error"] == {
        "code": "db_unavailable",
        "message": "データベースに接続できません。時間をおいて再度お試しください",
        "request_id": "hnd1::db",
    }
    assert "db_unavailable" in caplog.text and "Connection refused" in caplog.text
    assert "GET /api/videos/feed -> 503" in caplog.text


def test_missing_table_logs_init_sql_hint(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    _use_fake_conn()

    def undefined_table(*_: Any, **__: Any) -> Any:
        raise psycopg.errors.UndefinedTable('relation "discotq.videos" does not exist')

    monkeypatch.setattr(videos_repo, "list_feed", undefined_table)
    res = client.get("/api/videos/feed")
    assert res.status_code == 500
    assert res.json()["error"]["code"] == "db_error"
    assert "init.sql" in caplog.text
    assert "discotq.videos" in caplog.text


def test_storage_errors_return_502(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    from backend.app import auth
    from backend.app.routers import admin as admin_router
    from backend.app.services import videos as video_service

    _use_fake_conn()
    app.dependency_overrides[auth.require_admin] = lambda: _FakeUser()
    monkeypatch.setattr(admin_router, "_load", lambda *_a, **_k: {})
    errors: list[Exception] = [
        ClientError({"Error": {"Code": "AccessDenied", "Message": "Access Denied"}}, "CopyObject"),
        EndpointConnectionError(endpoint_url="https://acc.r2.cloudflarestorage.com"),
    ]
    for err in errors:

        def boom(*_: Any, _err: Exception = err, **__: Any) -> Any:
            raise _err

        monkeypatch.setattr(video_service, "approve_video", boom)
        res = client.post("/api/admin/videos/00000000-0000-0000-0000-000000000000/approve")
        assert res.status_code == 502, res.text
        assert res.json()["error"]["code"] == "storage_error"
    assert "AccessDenied" in caplog.text and "CopyObject" in caplog.text
    assert "EndpointConnectionError" in caplog.text


def test_email_error_returns_502(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    from backend.app import auth
    from backend.app.routers import auth as auth_router

    _use_fake_conn()
    app.dependency_overrides[auth.require_user] = lambda: _FakeUser()

    def fail(*_: Any, **__: Any) -> Any:
        raise httpx.ConnectError("resend unreachable")

    monkeypatch.setattr(auth_router, "_too_soon", lambda *_a, **_k: False)
    monkeypatch.setattr(auth_router, "_send_verification", fail)
    res = client.post("/api/auth/resend-verification")
    assert res.status_code == 502
    assert res.json()["error"]["code"] == "email_error"
    assert "resend unreachable" in caplog.text


class _FakeUser:
    id = "00000000-0000-0000-0000-000000000001"
    email = "a@example.com"
    email_verified = False
    is_admin = True


def test_unhandled_exception_returns_json_500_with_traceback(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    _use_fake_conn()

    def bug(*_: Any, **__: Any) -> Any:
        raise RuntimeError("unexpected bug")

    monkeypatch.setattr(videos_repo, "list_feed", bug)
    res = client.get("/api/videos/feed", headers={"x-vercel-id": "hnd1::bug"})
    assert res.status_code == 500
    assert res.json()["error"] == {
        "code": "internal_error",
        "message": "サーバーでエラーが発生しました",
        "request_id": "hnd1::bug",
    }
    assert "unhandled_error" in caplog.text
    assert "RuntimeError: unexpected bug" in caplog.text  # スタックトレース付き
    assert res.headers["X-Request-Id"] == "hnd1::bug"


def test_api_errors_include_request_id(client: TestClient) -> None:
    _use_fake_conn()
    res = client.get("/api/admin/stats", headers={"x-vercel-id": "hnd1::auth"})
    assert res.status_code == 401
    assert res.json()["error"]["request_id"] == "hnd1::auth"
