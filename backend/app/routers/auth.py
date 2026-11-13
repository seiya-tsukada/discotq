"""独自認証（メール + パスワード、httpOnly Cookie セッション、Resend によるメール確認・再設定）。"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any
from urllib.parse import urlencode
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response
from psycopg import errors as pg_errors

from backend.app.auth import (
    ConnDep,
    CurrentUser,
    OptionalUserDep,
    SettingsDep,
    UserDep,
    end_session,
    get_ip_hash,
    start_session,
)
from backend.app.config import Settings
from backend.app.db import Conn
from backend.app.deps import get_email_sender
from backend.app.email import EmailSender, password_reset_email, verification_email
from backend.app.errors import ApiError, bad_request
from backend.app.repositories import users as users_repo
from backend.app.repositories.audit import write_audit_log
from backend.app.schemas.auth import (
    LoginRequest,
    MeResponse,
    PasswordResetConfirm,
    PasswordResetRequest,
    SignupRequest,
    TokenRequest,
    UserOut,
)
from backend.app.schemas.common import OkResponse
from backend.app.security import (
    hash_password,
    new_token,
    password_needs_rehash,
    sha256_hex,
    verify_password,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

EmailDep = Annotated[EmailSender, Depends(get_email_sender)]
IpHashDep = Annotated[str | None, Depends(get_ip_hash)]

VERIFY_TOKEN_TTL = timedelta(hours=24)
RESET_TOKEN_TTL = timedelta(hours=1)
EMAIL_RESEND_INTERVAL = timedelta(seconds=60)
LOGIN_WINDOW_MINUTES = 15
LOGIN_MAX_FAILURES_PER_EMAIL = 10
LOGIN_MAX_FAILURES_PER_IP = 50


def _user_out(user: CurrentUser) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        email_verified=user.email_verified,
        is_admin=user.is_admin,
        created_at=user.created_at,
    )


def _row_to_user(conn: Conn, row: dict[str, Any]) -> UserOut:
    return UserOut(
        id=row["id"],
        email=row["email"],
        display_name=row["display_name"],
        email_verified=row["email_verified_at"] is not None,
        is_admin=users_repo.is_admin(conn, row["id"]),
        created_at=row["created_at"],
    )


def _link(settings: Settings, path: str, token: str) -> str:
    return f"{settings.app_base_url.rstrip('/')}{path}?{urlencode({'token': token})}"


def _send_verification(
    conn: Conn, settings: Settings, email_sender: EmailSender, user_id: UUID, email: str
) -> None:
    token = new_token()
    users_repo.invalidate_email_tokens(conn, user_id, "verify_email")
    users_repo.create_email_token(
        conn,
        user_id=user_id,
        purpose="verify_email",
        token_hash=sha256_hex(token),
        expires_at=datetime.now(UTC) + VERIFY_TOKEN_TTL,
    )
    email_sender.send(verification_email(email, _link(settings, "/verify-email", token)))


def _too_soon(conn: Conn, user_id: UUID, purpose: str) -> bool:
    last = users_repo.latest_email_token_at(conn, user_id, purpose)
    return last is not None and datetime.now(UTC) - last < EMAIL_RESEND_INTERVAL


@router.get("/me", response_model=MeResponse)
def me(user: OptionalUserDep) -> MeResponse:
    return MeResponse(user=_user_out(user) if user else None)


@router.post("/signup", response_model=MeResponse, status_code=201)
def signup(
    req: SignupRequest,
    request: Request,
    response: Response,
    conn: ConnDep,
    settings: SettingsDep,
    email_sender: EmailDep,
) -> MeResponse:
    display_name = (req.display_name or "").strip() or None
    try:
        with conn.transaction():
            row = users_repo.create_user(
                conn,
                email=str(req.email),
                password_hash=hash_password(req.password),
                display_name=display_name,
            )
    except pg_errors.UniqueViolation as e:
        raise ApiError(409, "email_taken", "このメールアドレスは既に登録されています") from e

    user_id = row["id"]
    write_audit_log(
        conn,
        actor_type="user",
        actor_id=str(user_id),
        action="user.signup",
        target_type="user",
        target_id=str(user_id),
    )
    _send_verification(conn, settings, email_sender, user_id, row["email"])
    start_session(conn, response, request, settings, user_id)
    return MeResponse(user=_row_to_user(conn, row))


@router.post("/login", response_model=MeResponse)
def login(
    req: LoginRequest,
    request: Request,
    response: Response,
    conn: ConnDep,
    settings: SettingsDep,
    ip_hash: IpHashDep,
) -> MeResponse:
    email = str(req.email)
    by_email, by_ip = users_repo.count_recent_failed_logins(
        conn, email=email, ip_hash=ip_hash, window_minutes=LOGIN_WINDOW_MINUTES
    )
    if by_email >= LOGIN_MAX_FAILURES_PER_EMAIL or by_ip >= LOGIN_MAX_FAILURES_PER_IP:
        raise ApiError(
            429, "too_many_attempts", "ログイン試行回数が多すぎます。しばらくしてから再度お試しください"
        )

    row = users_repo.find_user_by_email(conn, email)
    ok = verify_password(row["password_hash"] if row else None, req.password)
    users_repo.record_login_attempt(conn, email=email, ip_hash=ip_hash, succeeded=ok)
    if not ok or row is None:
        # 失敗の記録は残す
        conn.commit()
        raise ApiError(401, "invalid_credentials", "メールアドレスまたはパスワードが正しくありません")

    if password_needs_rehash(row["password_hash"]):
        users_repo.update_password(conn, row["id"], hash_password(req.password))
    start_session(conn, response, request, settings, row["id"])
    return MeResponse(user=_row_to_user(conn, row))


@router.post("/logout", response_model=OkResponse)
def logout(request: Request, response: Response, conn: ConnDep, settings: SettingsDep) -> OkResponse:
    end_session(conn, response, request, settings)
    return OkResponse()


@router.post("/verify-email", response_model=OkResponse)
def verify_email(req: TokenRequest, conn: ConnDep) -> OkResponse:
    user_id = users_repo.consume_email_token(conn, sha256_hex(req.token), "verify_email")
    if user_id is None:
        raise bad_request("invalid_token", "リンクが無効か、有効期限が切れています")
    users_repo.mark_email_verified(conn, user_id)
    write_audit_log(
        conn,
        actor_type="user",
        actor_id=str(user_id),
        action="user.verify_email",
        target_type="user",
        target_id=str(user_id),
    )
    return OkResponse()


@router.post("/resend-verification", response_model=OkResponse)
def resend_verification(
    conn: ConnDep, settings: SettingsDep, email_sender: EmailDep, user: UserDep
) -> OkResponse:
    if user.email_verified:
        return OkResponse()
    if _too_soon(conn, user.id, "verify_email"):
        raise ApiError(429, "too_soon", "確認メールは1分に1回まで再送できます")
    _send_verification(conn, settings, email_sender, user.id, user.email)
    return OkResponse()


@router.post("/password-reset/request", response_model=OkResponse, status_code=202)
def password_reset_request(
    req: PasswordResetRequest, conn: ConnDep, settings: SettingsDep, email_sender: EmailDep
) -> OkResponse:
    """登録有無に関わらず同じ応答を返す（メールアドレスの存在確認に使わせない）。"""
    row = users_repo.find_user_by_email(conn, str(req.email))
    if row is None or _too_soon(conn, row["id"], "password_reset"):
        return OkResponse()
    token = new_token()
    users_repo.invalidate_email_tokens(conn, row["id"], "password_reset")
    users_repo.create_email_token(
        conn,
        user_id=row["id"],
        purpose="password_reset",
        token_hash=sha256_hex(token),
        expires_at=datetime.now(UTC) + RESET_TOKEN_TTL,
    )
    try:
        email_sender.send(password_reset_email(row["email"], _link(settings, "/reset-password", token)))
    except Exception:  # noqa: BLE001 - 応答で失敗を区別しない
        logger.exception("failed to send password reset email")
    return OkResponse()


@router.post("/password-reset/confirm", response_model=OkResponse)
def password_reset_confirm(req: PasswordResetConfirm, conn: ConnDep) -> OkResponse:
    user_id = users_repo.consume_email_token(conn, sha256_hex(req.token), "password_reset")
    if user_id is None:
        raise bad_request("invalid_token", "リンクが無効か、有効期限が切れています")
    users_repo.update_password(conn, user_id, hash_password(req.password))
    # メールを受け取れた = アドレスの所有が確認できたので確認済みにする
    users_repo.mark_email_verified(conn, user_id)
    users_repo.delete_user_sessions(conn, user_id)
    write_audit_log(
        conn,
        actor_type="user",
        actor_id=str(user_id),
        action="user.password_reset",
        target_type="user",
        target_id=str(user_id),
    )
    return OkResponse()
