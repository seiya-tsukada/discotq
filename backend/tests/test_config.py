from __future__ import annotations

import pytest
from pydantic import ValidationError

from backend.app.config import Settings


def test_missing_required_env_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("R2_BUCKET_PUBLIC")
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_resend_backend_requires_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("EMAIL_BACKEND", "resend")
    monkeypatch.delenv("RESEND_API_KEY", raising=False)
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_cors_origins_are_split(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "https://a.example, http://localhost:3000 ,")
    s = Settings(_env_file=None)
    assert s.cors_origins == ["https://a.example", "http://localhost:3000"]
    assert s.r2_endpoint == "https://test-account.r2.cloudflarestorage.com"


def test_limits_and_app_url_have_hardcoded_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in ("MAX_UPLOAD_BYTES", "MAX_VIDEO_DURATION_SEC", "ANON_DAILY_UPLOAD_LIMIT", "APP_BASE_URL"):
        monkeypatch.delenv(name, raising=False)
    s = Settings(_env_file=None)
    assert s.max_upload_bytes == 104_857_600
    assert s.max_video_duration_sec == 180
    assert s.anon_daily_upload_limit == 5
    assert s.app_base_url == "https://discotq.vercel.app"


def test_ip_hash_salt_is_derived_from_database_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:secret-a@db:6543/postgres")
    a1 = Settings(_env_file=None).ip_hash_salt
    a2 = Settings(_env_file=None).ip_hash_salt
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:secret-b@db:6543/postgres")
    b = Settings(_env_file=None).ip_hash_salt
    assert a1 == a2  # 同じ DATABASE_URL なら毎回同じ（再起動しても集計が続く）
    assert a1 != b
    assert len(a1) == 64 and "secret-a" not in a1
