"""pytest 共通フィクスチャ。

* DB: 実 Postgres を使う。``TEST_DATABASE_URL`` が未設定なら DB を使うテストはスキップ。
  例) docker run -d --rm --name discotq-pg-test -e POSTGRES_PASSWORD=postgres -p 54329:5432 postgres:17-alpine
      export TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:54329/postgres
  セッション開始時に discotq スキーマを作り直して init.sql を適用する。
* ストレージ: moto の S3 モックで R2Storage を動かす
* メール: ConsoleEmailSender に差し替え、送信内容を検査できるようにする
"""

from __future__ import annotations

import os
import re
from collections.abc import Iterator
from pathlib import Path
from typing import Any
from uuid import uuid4

import pytest

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
ROOT = Path(__file__).resolve().parents[2]

# アプリの import 前に環境変数を用意する（Settings は起動時に検証される）
os.environ.update(
    {
        "R2_ACCOUNT_ID": "test-account",
        "R2_ACCESS_KEY_ID": "testing",
        "R2_SECRET_ACCESS_KEY": "testing",
        "R2_BUCKET_PRIVATE": "discotq-private-test",
        "R2_BUCKET_PUBLIC": "discotq-public-test",
        "R2_PUBLIC_BASE_URL": "https://media.example.test",
        "DATABASE_URL": TEST_DATABASE_URL or "postgresql://invalid/none",
        "MAX_UPLOAD_BYTES": str(50 * 1024 * 1024),
        "MAX_VIDEO_DURATION_SEC": "180",
        "ANON_DAILY_UPLOAD_LIMIT": "3",
        "USER_DAILY_UPLOAD_LIMIT": "5",
        "CORS_ALLOWED_ORIGINS": "http://localhost:3000",
        "APP_BASE_URL": "http://localhost:3000",
        "IP_HASH_SALT": "test-salt",
        "SESSION_COOKIE_SECURE": "false",
        "EMAIL_BACKEND": "console",
        "AWS_DEFAULT_REGION": "us-east-1",
    }
)

import boto3  # noqa: E402
from botocore.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from moto import mock_aws  # noqa: E402

from backend.app.db import Conn, connect  # noqa: E402
from backend.app.deps import get_email_sender, get_storage  # noqa: E402
from backend.app.email import ConsoleEmailSender  # noqa: E402
from backend.app.main import app  # noqa: E402
from backend.app.storage.r2 import R2Storage  # noqa: E402

PRIVATE = os.environ["R2_BUCKET_PRIVATE"]
PUBLIC = os.environ["R2_BUCKET_PUBLIC"]

requires_db = pytest.mark.skipif(not TEST_DATABASE_URL, reason="TEST_DATABASE_URL が未設定")

TABLES = [
    "audit_logs",
    "video_reviews",
    "videos",
    "admins",
    "login_attempts",
    "email_tokens",
    "sessions",
    "users",
]


@pytest.fixture(scope="session")
def _schema() -> None:
    assert TEST_DATABASE_URL
    sql = (ROOT / "supabase/migration/init.sql").read_text()
    with connect(TEST_DATABASE_URL) as conn:
        conn.autocommit = True
        conn.execute("drop schema if exists discotq cascade")
        conn.execute(sql)


@pytest.fixture
def db(_schema: None) -> Iterator[Conn]:
    assert TEST_DATABASE_URL
    with connect(TEST_DATABASE_URL) as conn:
        conn.autocommit = True
        conn.execute(f"truncate {', '.join('discotq.' + t for t in TABLES)} cascade")
        yield conn


@pytest.fixture
def storage() -> Iterator[R2Storage]:
    with mock_aws():
        client = boto3.client(
            "s3", region_name="us-east-1", config=Config(signature_version="s3v4")
        )
        client.create_bucket(Bucket=PRIVATE)
        client.create_bucket(Bucket=PUBLIC)
        yield R2Storage(
            endpoint_url="https://test-account.r2.cloudflarestorage.com",
            access_key_id="testing",
            secret_access_key="testing",
            private_bucket=PRIVATE,
            public_bucket=PUBLIC,
            public_base_url=os.environ["R2_PUBLIC_BASE_URL"],
            client=client,
        )


@pytest.fixture
def outbox() -> ConsoleEmailSender:
    return ConsoleEmailSender()


@pytest.fixture
def make_client(
    db: Conn, storage: R2Storage, outbox: ConsoleEmailSender
) -> Iterator[Any]:
    app.dependency_overrides[get_storage] = lambda: storage
    app.dependency_overrides[get_email_sender] = lambda: outbox
    clients: list[TestClient] = []

    def factory(*, anonymous_id: str | None = None, ip: str = "203.0.113.10") -> TestClient:
        headers = {"X-Requested-With": "discotq", "X-Real-IP": ip}
        if anonymous_id:
            headers["X-Anonymous-Id"] = anonymous_id
        c = TestClient(app, headers=headers)
        clients.append(c)
        return c

    yield factory
    for c in clients:
        c.close()
    app.dependency_overrides.clear()


@pytest.fixture
def anon_client(make_client: Any) -> TestClient:
    return make_client(anonymous_id=str(uuid4()))  # type: ignore[no-any-return]


# ---------------------------------------------------------------- helpers


def token_from_outbox(outbox: ConsoleEmailSender, path: str) -> str:
    for msg in reversed(outbox.outbox):
        m = re.search(rf"{re.escape(path)}\?token=([\w\-]+)", msg.text)
        if m:
            return m.group(1)
    raise AssertionError(f"{path} のリンクを含むメールがありません")


def signup(
    client: TestClient,
    outbox: ConsoleEmailSender,
    *,
    email: str | None = None,
    password: str = "correct-horse-battery",
    verify: bool = True,
) -> dict[str, Any]:
    email = email or f"user-{uuid4().hex[:8]}@example.com"
    res = client.post("/api/auth/signup", json={"email": email, "password": password})
    assert res.status_code == 201, res.text
    if verify:
        token = token_from_outbox(outbox, "/verify-email")
        assert client.post("/api/auth/verify-email", json={"token": token}).status_code == 200
    user: dict[str, Any] = client.get("/api/auth/me").json()["user"]
    return user


def make_admin(db: Conn, client: TestClient, outbox: ConsoleEmailSender) -> dict[str, Any]:
    user = signup(client, outbox)
    db.execute("insert into discotq.admins (user_id) values (%s)", (user["id"],))
    return user


def intent_payload(**overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "filename": "clip.mp4",
        "mime_type": "video/mp4",
        "size_bytes": 1024,
        "duration_sec": 12.5,
        "width": 1080,
        "height": 1920,
        "title": "テスト動画",
        "description": "説明",
        "thumbnail": {"size_bytes": 64},
    }
    payload.update(overrides)
    return payload


def put_uploads(
    storage: R2Storage,
    intent: dict[str, Any],
    *,
    body: bytes | None = None,
    content_type: str = "video/mp4",
    thumb: bool = True,
) -> None:
    """ブラウザからの署名付き PUT の代わりに、moto へ直接オブジェクトを置く。"""
    video_id = intent["video_id"]
    ext = {"video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov"}[content_type]
    storage.client.put_object(
        Bucket=PRIVATE,
        Key=f"videos/{video_id}/original.{ext}",
        Body=body if body is not None else b"\0" * 1024,
        ContentType=content_type,
    )
    if thumb and intent.get("thumbnail_upload"):
        storage.client.put_object(
            Bucket=PRIVATE,
            Key=f"videos/{video_id}/thumb.jpg",
            Body=b"\xff" * 64,
            ContentType="image/jpeg",
        )


def upload_video(client: TestClient, storage: R2Storage, **overrides: Any) -> dict[str, Any]:
    res = client.post("/api/uploads/intent", json=intent_payload(**overrides))
    assert res.status_code == 201, res.text
    intent: dict[str, Any] = res.json()
    put_uploads(storage, intent)
    res = client.post(f"/api/uploads/{intent['video_id']}/complete")
    assert res.status_code == 200, res.text
    return intent


def object_exists(storage: R2Storage, bucket: str, key: str) -> bool:
    try:
        storage.client.head_object(Bucket=bucket, Key=key)
        return True
    except storage.client.exceptions.ClientError:
        return False
