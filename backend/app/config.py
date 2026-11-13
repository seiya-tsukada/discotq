"""環境変数の読み込み。

必須の値が未設定の場合は ``get_settings()`` の呼び出し（= アプリ起動時）に
``pydantic.ValidationError`` で失敗させる。

アップロード上限・メール内リンクの URL はコードの既定値を使う（環境変数の設定は不要）。
テストやローカル開発のために、同名の環境変数で上書きはできる。
"""

from __future__ import annotations

import hashlib
import hmac
from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


DEFAULT_MAX_UPLOAD_BYTES = 104_857_600  # 100MB
DEFAULT_MAX_VIDEO_DURATION_SEC = 180
DEFAULT_ANON_DAILY_UPLOAD_LIMIT = 5
DEFAULT_APP_BASE_URL = "https://discotq.vercel.app"
# ソルト導出用の固定ラベル（用途ごとに鍵を分けるため）
IP_HASH_SALT_CONTEXT = b"discotq:ip-hash-salt:v1"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
        # 起動エラーのメッセージ（= Vercel のログ）に DATABASE_URL などの値を含めない
        hide_input_in_errors=True,
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

    # --- アップロード制限（既定値で運用する） ---
    max_upload_bytes: int = Field(default=DEFAULT_MAX_UPLOAD_BYTES, gt=0)
    max_video_duration_sec: int = Field(default=DEFAULT_MAX_VIDEO_DURATION_SEC, gt=0)
    anon_daily_upload_limit: int = Field(default=DEFAULT_ANON_DAILY_UPLOAD_LIMIT, ge=0)
    user_daily_upload_limit: int = Field(default=50, ge=0)
    max_thumbnail_bytes: int = Field(default=2 * 1024 * 1024, gt=0)
    upload_url_ttl_sec: int = 15 * 60
    preview_url_ttl_sec: int = 5 * 60

    # --- CORS（カンマ区切り） ---
    cors_allowed_origins: str = ""

    # --- 認証 ---
    # メール内リンクの組み立てに使う。ローカル開発では http://localhost:3000 などで上書きする
    app_base_url: str = DEFAULT_APP_BASE_URL
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
    def ip_hash_salt(self) -> str:
        """IP アドレスのハッシュ化に使うソルト。

        専用の環境変数を持たず、秘密情報である DATABASE_URL から HMAC で導出する。
        DATABASE_URL（DB のパスワードなど）を変えるとソルトも変わり、
        それ以前に記録した IP ハッシュとは突合できなくなる（レート制限の集計がリセットされる）。
        """
        return hmac.new(
            IP_HASH_SALT_CONTEXT, self.database_url.get_secret_value().encode(), hashlib.sha256
        ).hexdigest()

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_allowed_origins.split(",") if o.strip()]

    @property
    def r2_endpoint(self) -> str:
        return self.r2_endpoint_url or f"https://{self.r2_account_id}.r2.cloudflarestorage.com"


@lru_cache
def get_settings() -> Settings:
    return Settings()
