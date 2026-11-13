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
