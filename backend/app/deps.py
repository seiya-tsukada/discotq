"""差し替え可能な外部依存（ストレージ・メール）の生成。テストでは dependency_overrides で置き換える。"""

from __future__ import annotations

from functools import lru_cache

from backend.app.config import get_settings
from backend.app.email import ConsoleEmailSender, EmailSender, ResendEmailSender
from backend.app.storage.base import VideoStorage
from backend.app.storage.r2 import R2Storage


@lru_cache
def get_storage() -> VideoStorage:
    s = get_settings()
    return R2Storage(
        endpoint_url=s.r2_endpoint,
        access_key_id=s.r2_access_key_id,
        secret_access_key=s.r2_secret_access_key.get_secret_value(),
        private_bucket=s.r2_bucket_private,
        public_bucket=s.r2_bucket_public,
        public_base_url=s.r2_public_base_url,
    )


@lru_cache
def get_email_sender() -> EmailSender:
    s = get_settings()
    if s.email_backend == "console":
        return ConsoleEmailSender()
    assert s.resend_api_key is not None
    return ResendEmailSender(s.resend_api_key.get_secret_value(), s.email_from)
