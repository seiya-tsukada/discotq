"""ハッシュ・トークン・パスワードなどの小さなユーティリティ。"""

from __future__ import annotations

import hashlib
import hmac
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

_hasher = PasswordHasher()  # argon2id（ライブラリ既定のパラメータ）
# 存在しないユーザーでも検証コストを揃えるためのダミーハッシュ
_DUMMY_HASH = _hasher.hash("discotq-dummy-password")

PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    try:
        return _hasher.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def password_needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)


def new_token() -> str:
    """Cookie やメールリンクに載せるランダムトークン（256bit）。"""
    return secrets.token_urlsafe(32)


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def hash_ip(ip: str | None, salt: str) -> str | None:
    if not ip:
        return None
    return hmac.new(salt.encode(), ip.encode(), hashlib.sha256).hexdigest()
