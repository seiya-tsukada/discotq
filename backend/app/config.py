"""環境変数の読み込み。

必須の値が未設定の場合は ``get_settings()`` の呼び出し（= アプリ起動時）に
``pydantic.ValidationError`` で失敗させる。
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- Cloudflare R2 ---
    r2_account_id: str
    r2_access_key_id: str
    r2_secret_access_key: SecretStr
    r2_bucket_private: str
    r2_bucket_public: str
    r2_public_base_url: str
    # テストやローカルの S3 互換サーバー向け。通常は未設定（account_id から組み立てる）
    r2_endpoint_url: str | None = None

    # --- Database (Supabase transaction pooler, port 6543) ---
    database_url: SecretStr

    # --- アップロード制限 ---
    max_upload_bytes: int = Field(gt=0)
    max_video_duration_sec: int = Field(gt=0)
    anon_daily_upload_limit: int = Field(ge=0)
    user_daily_upload_limit: int = Field(default=50, ge=0)
    max_thumbnail_bytes: int = Field(default=2 * 1024 * 1024, gt=0)
    upload_url_ttl_sec: int = 15 * 60
    preview_url_ttl_sec: int = 5 * 60

    # --- CORS（カンマ区切り） ---
    cors_allowed_origins: str = ""

    # --- 認証 ---
    app_base_url: str  # メール内リンクの組み立てに使う（例: https://discotq.example.com）
    ip_hash_salt: SecretStr
    session_cookie_name: str = "discotq_session"
    session_cookie_secure: bool = True
    session_ttl_days: int = 30

    # --- メール ---
    email_backend: Literal["resend", "console"] = "resend"
    resend_api_key: SecretStr | None = None
    email_from: str = "DiscoTQ <no-reply@example.com>"

    @model_validator(mode="after")
    def _check_email_backend(self) -> Settings:
        if self.email_backend == "resend" and not self.resend_api_key:
            raise ValueError("EMAIL_BACKEND=resend の場合は RESEND_API_KEY が必須です")
        return self

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_allowed_origins.split(",") if o.strip()]

    @property
    def r2_endpoint(self) -> str:
        return self.r2_endpoint_url or f"https://{self.r2_account_id}.r2.cloudflarestorage.com"


@lru_cache
def get_settings() -> Settings:
    return Settings()
