"""認証・認可。

* ログインユーザー: httpOnly Cookie のセッショントークン → discotq.sessions で照合
* 未ログイン: フロントが生成した UUID を ``X-Anonymous-Id`` ヘッダーで受け取る
* 管理者: discotq.admins に user_id があり、かつメール確認済みのユーザー
* CSRF: 更新系メソッドには ``X-Requested-With: discotq`` を必須にする（middleware）。
  カスタムヘッダー付きのクロスオリジン要求は CORS プリフライトで許可オリジン以外が弾かれる。
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse

from backend.app.config import Settings, get_settings
from backend.app.db import Conn, get_conn
from backend.app.errors import ApiError
from backend.app.repositories import users as users_repo
from backend.app.security import hash_ip, new_token, sha256_hex

ANONYMOUS_ID_HEADER = "X-Anonymous-Id"
CSRF_HEADER = "X-Requested-With"
CSRF_HEADER_VALUE = "discotq"
# セッションの有効期限延長（スライディング）は 1 日 1 回まで
SESSION_TOUCH_INTERVAL = timedelta(days=1)


@dataclass(frozen=True)
class CurrentUser:
    id: UUID
    email: str
    display_name: str | None
    email_verified: bool
    is_admin: bool
    created_at: datetime


@dataclass(frozen=True)
class Principal:
    user: CurrentUser | None
    anonymous_id: UUID | None
    ip_hash: str | None

    @property
    def actor(self) -> tuple[str, str | None]:
        """監査ログ用の (actor_type, actor_id)。"""
        if self.user is not None:
            return ("admin" if self.user.is_admin else "user"), str(self.user.id)
        if self.anonymous_id is not None:
            return "anonymous", str(self.anonymous_id)
        return "anonymous", None


SettingsDep = Annotated[Settings, Depends(get_settings)]
ConnDep = Annotated[Conn, Depends(get_conn)]


def client_ip(request: Request) -> str | None:
    # Vercel は x-real-ip / x-forwarded-for にクライアント IP を入れる
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def get_ip_hash(request: Request, settings: SettingsDep) -> str | None:
    return hash_ip(client_ip(request), settings.ip_hash_salt)


def get_anonymous_id(request: Request) -> UUID | None:
    raw = request.headers.get(ANONYMOUS_ID_HEADER)
    if not raw:
        return None
    try:
        return UUID(raw)
    except ValueError as e:
        raise ApiError(400, "invalid_anonymous_id", "X-Anonymous-Id が不正です") from e


def get_current_user(request: Request, conn: ConnDep, settings: SettingsDep) -> CurrentUser | None:
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        return None
    row = users_repo.find_session_user(conn, sha256_hex(token))
    if row is None:
        return None
    now = datetime.now(UTC)
    if now - row["last_seen_at"] > SESSION_TOUCH_INTERVAL:
        users_repo.touch_session(conn, row["session_id"], now + timedelta(days=settings.session_ttl_days))
    return CurrentUser(
        id=row["id"],
        email=row["email"],
        display_name=row["display_name"],
        email_verified=row["email_verified_at"] is not None,
        is_admin=bool(row["is_admin"]),
        created_at=row["created_at"],
    )


OptionalUserDep = Annotated[CurrentUser | None, Depends(get_current_user)]


def get_principal(
    user: OptionalUserDep,
    anonymous_id: Annotated[UUID | None, Depends(get_anonymous_id)],
    ip_hash: Annotated[str | None, Depends(get_ip_hash)],
) -> Principal:
    return Principal(user=user, anonymous_id=anonymous_id, ip_hash=ip_hash)


def require_user(user: OptionalUserDep) -> CurrentUser:
    if user is None:
        raise ApiError(401, "unauthenticated", "ログインが必要です")
    return user


def require_verified_user(user: Annotated[CurrentUser, Depends(require_user)]) -> CurrentUser:
    if not user.email_verified:
        raise ApiError(403, "email_not_verified", "メールアドレスの確認が必要です")
    return user


def require_admin(user: Annotated[CurrentUser, Depends(require_user)]) -> CurrentUser:
    if not user.is_admin or not user.email_verified:
        raise ApiError(403, "forbidden", "管理者権限が必要です")
    return user


PrincipalDep = Annotated[Principal, Depends(get_principal)]
UserDep = Annotated[CurrentUser, Depends(require_user)]
VerifiedUserDep = Annotated[CurrentUser, Depends(require_verified_user)]
AdminDep = Annotated[CurrentUser, Depends(require_admin)]


# ---------------------------------------------------------------- session cookie


def start_session(
    conn: Conn, response: Response, request: Request, settings: Settings, user_id: UUID
) -> None:
    token = new_token()
    users_repo.create_session(
        conn,
        user_id=user_id,
        token_hash=sha256_hex(token),
        expires_at=datetime.now(UTC) + timedelta(days=settings.session_ttl_days),
        ip_hash=hash_ip(client_ip(request), settings.ip_hash_salt),
        user_agent=request.headers.get("user-agent"),
    )
    response.set_cookie(
        settings.session_cookie_name,
        token,
        max_age=settings.session_ttl_days * 24 * 3600,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        path="/",
    )


def end_session(conn: Conn, response: Response, request: Request, settings: Settings) -> None:
    token = request.cookies.get(settings.session_cookie_name)
    if token:
        users_repo.delete_session(conn, sha256_hex(token))
    response.delete_cookie(
        settings.session_cookie_name,
        path="/",
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
    )


# ---------------------------------------------------------------- CSRF


class CsrfHeaderMiddleware(BaseHTTPMiddleware):
    UNSAFE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if (
            request.method in self.UNSAFE_METHODS
            and request.url.path.startswith("/api/")
            and request.headers.get(CSRF_HEADER) != CSRF_HEADER_VALUE
        ):
            return JSONResponse(
                status_code=403,
                content={"error": {"code": "csrf", "message": "不正なリクエストです"}},
            )
        return await call_next(request)
