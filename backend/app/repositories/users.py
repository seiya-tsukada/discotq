from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from backend.app.db import Conn

EmailPurpose = str  # 'verify_email' | 'password_reset'


def find_user_by_email(conn: Conn, email: str) -> dict[str, Any] | None:
    return conn.execute(
        "select * from discotq.users where lower(email) = lower(%s)", (email,)
    ).fetchone()


def find_user_by_id(conn: Conn, user_id: UUID) -> dict[str, Any] | None:
    return conn.execute("select * from discotq.users where id = %s", (user_id,)).fetchone()


def create_user(conn: Conn, *, email: str, password_hash: str, display_name: str | None) -> dict[str, Any]:
    row = conn.execute(
        """
        insert into discotq.users (email, password_hash, display_name)
        values (%s, %s, %s)
        returning *
        """,
        (email, password_hash, display_name),
    ).fetchone()
    assert row is not None
    return row


def update_password(conn: Conn, user_id: UUID, password_hash: str) -> None:
    conn.execute(
        "update discotq.users set password_hash = %s where id = %s", (password_hash, user_id)
    )


def mark_email_verified(conn: Conn, user_id: UUID) -> None:
    conn.execute(
        "update discotq.users set email_verified_at = coalesce(email_verified_at, now()) where id = %s",
        (user_id,),
    )


def is_admin(conn: Conn, user_id: UUID) -> bool:
    return (
        conn.execute("select 1 from discotq.admins where user_id = %s", (user_id,)).fetchone()
        is not None
    )


# ---------------------------------------------------------------- sessions


def create_session(
    conn: Conn,
    *,
    user_id: UUID,
    token_hash: str,
    expires_at: datetime,
    ip_hash: str | None,
    user_agent: str | None,
) -> None:
    conn.execute(
        """
        insert into discotq.sessions (user_id, token_hash, expires_at, ip_hash, user_agent)
        values (%s, %s, %s, %s, %s)
        """,
        (user_id, token_hash, expires_at, ip_hash, (user_agent or "")[:300] or None),
    )


def find_session_user(conn: Conn, token_hash: str) -> dict[str, Any] | None:
    """有効なセッションとユーザー・管理者フラグをまとめて取得する。"""
    return conn.execute(
        """
        select s.id as session_id, s.last_seen_at, s.expires_at,
               u.id, u.email, u.display_name, u.email_verified_at, u.created_at,
               (a.user_id is not null) as is_admin
        from discotq.sessions s
        join discotq.users u on u.id = s.user_id
        left join discotq.admins a on a.user_id = u.id
        where s.token_hash = %s and s.expires_at > now()
        """,
        (token_hash,),
    ).fetchone()


def touch_session(conn: Conn, session_id: UUID, expires_at: datetime) -> None:
    conn.execute(
        "update discotq.sessions set last_seen_at = now(), expires_at = %s where id = %s",
        (expires_at, session_id),
    )


def delete_session(conn: Conn, token_hash: str) -> None:
    conn.execute("delete from discotq.sessions where token_hash = %s", (token_hash,))


def delete_user_sessions(conn: Conn, user_id: UUID) -> None:
    conn.execute("delete from discotq.sessions where user_id = %s", (user_id,))


# ---------------------------------------------------------------- email tokens


def create_email_token(
    conn: Conn, *, user_id: UUID, purpose: EmailPurpose, token_hash: str, expires_at: datetime
) -> None:
    conn.execute(
        """
        insert into discotq.email_tokens (user_id, purpose, token_hash, expires_at)
        values (%s, %s, %s, %s)
        """,
        (user_id, purpose, token_hash, expires_at),
    )


def latest_email_token_at(conn: Conn, user_id: UUID, purpose: EmailPurpose) -> datetime | None:
    row = conn.execute(
        """
        select max(created_at) as created_at from discotq.email_tokens
        where user_id = %s and purpose = %s
        """,
        (user_id, purpose),
    ).fetchone()
    return row["created_at"] if row else None


def consume_email_token(conn: Conn, token_hash: str, purpose: EmailPurpose) -> UUID | None:
    """未使用かつ有効期限内のトークンを使用済みにし、user_id を返す。"""
    row = conn.execute(
        """
        update discotq.email_tokens
           set used_at = now()
         where token_hash = %s and purpose = %s and used_at is null and expires_at > now()
        returning user_id
        """,
        (token_hash, purpose),
    ).fetchone()
    return row["user_id"] if row else None


def invalidate_email_tokens(conn: Conn, user_id: UUID, purpose: EmailPurpose) -> None:
    conn.execute(
        """
        update discotq.email_tokens set used_at = now()
        where user_id = %s and purpose = %s and used_at is null
        """,
        (user_id, purpose),
    )


# ---------------------------------------------------------------- login attempts


def record_login_attempt(conn: Conn, *, email: str, ip_hash: str | None, succeeded: bool) -> None:
    conn.execute(
        """
        insert into discotq.login_attempts (email_lower, ip_hash, succeeded)
        values (lower(%s), %s, %s)
        """,
        (email, ip_hash, succeeded),
    )


def count_recent_failed_logins(
    conn: Conn, *, email: str, ip_hash: str | None, window_minutes: int
) -> tuple[int, int]:
    row = conn.execute(
        """
        select
          count(*) filter (where email_lower = lower(%(email)s)) as by_email,
          count(*) filter (where %(ip)s::text is not null and ip_hash = %(ip)s) as by_ip
        from discotq.login_attempts
        where not succeeded
          and created_at > now() - make_interval(mins => %(win)s)
          and (email_lower = lower(%(email)s) or ip_hash = %(ip)s)
        """,
        {"email": email, "ip": ip_hash, "win": window_minutes},
    ).fetchone()
    assert row is not None
    return int(row["by_email"]), int(row["by_ip"])
