from __future__ import annotations

from typing import Any

from backend.app.db import Conn
from backend.app.email import ConsoleEmailSender
from backend.tests.conftest import requires_db, signup, token_from_outbox

pytestmark = requires_db


def test_signup_logs_in_and_sends_verification(make_client: Any, outbox: ConsoleEmailSender) -> None:
    c = make_client()
    user = signup(c, outbox, email="Alice@Example.com", verify=False)
    assert user["email"] == "Alice@example.com"  # ドメイン部は正規化される
    assert user["email_verified"] is False
    assert user["is_admin"] is False
    assert "/verify-email?token=" in outbox.outbox[-1].text

    token = token_from_outbox(outbox, "/verify-email")
    assert c.post("/api/auth/verify-email", json={"token": token}).status_code == 200
    assert c.get("/api/auth/me").json()["user"]["email_verified"] is True
    # トークンは使い捨て
    assert c.post("/api/auth/verify-email", json={"token": token}).status_code == 400


def test_signup_duplicate_email_is_case_insensitive(make_client: Any, outbox: ConsoleEmailSender) -> None:
    signup(make_client(), outbox, email="bob@example.com")
    res = make_client().post(
        "/api/auth/signup", json={"email": "BOB@example.com", "password": "another-password"}
    )
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "email_taken"


def test_signup_rejects_short_password(make_client: Any) -> None:
    res = make_client().post("/api/auth/signup", json={"email": "x@example.com", "password": "short"})
    assert res.status_code == 422


def test_login_logout(make_client: Any, outbox: ConsoleEmailSender, db: Conn) -> None:
    signup(make_client(), outbox, email="carol@example.com", password="password-123")
    c = make_client()
    assert c.get("/api/auth/me").json()["user"] is None

    bad = c.post("/api/auth/login", json={"email": "carol@example.com", "password": "wrong-pass"})
    assert bad.status_code == 401
    assert bad.json()["error"]["code"] == "invalid_credentials"

    ok = c.post("/api/auth/login", json={"email": "CAROL@example.com", "password": "password-123"})
    assert ok.status_code == 200
    assert "httponly" in ok.headers["set-cookie"].lower()
    assert c.get("/api/auth/me").json()["user"]["email"] == "carol@example.com"

    assert c.post("/api/auth/logout").status_code == 200
    assert c.get("/api/auth/me").json()["user"] is None
    row = db.execute("select count(*) as n from discotq.login_attempts where not succeeded").fetchone()
    assert row is not None and row["n"] == 1


def test_login_is_rate_limited_per_email(make_client: Any, outbox: ConsoleEmailSender) -> None:
    signup(make_client(), outbox, email="dave@example.com", password="password-123")
    c = make_client()
    for _ in range(10):
        assert c.post("/api/auth/login", json={"email": "dave@example.com", "password": "nope-nope"}).status_code == 401
    res = c.post("/api/auth/login", json={"email": "dave@example.com", "password": "password-123"})
    assert res.status_code == 429


def test_unknown_email_login_fails_like_wrong_password(make_client: Any) -> None:
    res = make_client().post("/api/auth/login", json={"email": "ghost@example.com", "password": "whatever-1"})
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "invalid_credentials"


def test_password_reset_flow_revokes_sessions(make_client: Any, outbox: ConsoleEmailSender) -> None:
    logged_in = make_client()
    signup(logged_in, outbox, email="erin@example.com", password="old-password", verify=False)

    c = make_client()
    assert c.post("/api/auth/password-reset/request", json={"email": "erin@example.com"}).status_code == 202
    token = token_from_outbox(outbox, "/reset-password")

    res = c.post("/api/auth/password-reset/confirm", json={"token": token, "password": "new-password"})
    assert res.status_code == 200
    # 既存セッションは失効
    assert logged_in.get("/api/auth/me").json()["user"] is None
    assert c.post("/api/auth/login", json={"email": "erin@example.com", "password": "old-password"}).status_code == 401
    me = c.post("/api/auth/login", json={"email": "erin@example.com", "password": "new-password"})
    assert me.status_code == 200
    # リセットメールを受け取れた = メール確認済み扱い
    assert me.json()["user"]["email_verified"] is True
    # 再利用不可
    again = c.post("/api/auth/password-reset/confirm", json={"token": token, "password": "x-password"})
    assert again.status_code == 400


def test_password_reset_request_does_not_leak_existence(make_client: Any, outbox: ConsoleEmailSender) -> None:
    res = make_client().post("/api/auth/password-reset/request", json={"email": "nobody@example.com"})
    assert res.status_code == 202
    assert outbox.outbox == []


def test_resend_verification_is_throttled(make_client: Any, outbox: ConsoleEmailSender) -> None:
    c = make_client()
    signup(c, outbox, verify=False)
    res = c.post("/api/auth/resend-verification")
    assert res.status_code == 429


def test_csrf_header_required_for_unsafe_methods(make_client: Any) -> None:
    from fastapi.testclient import TestClient

    from backend.app.main import app

    with TestClient(app) as raw:
        res = raw.post("/api/auth/login", json={"email": "a@example.com", "password": "x"})
        assert res.status_code == 403
        assert res.json()["error"]["code"] == "csrf"
        assert raw.get("/api/health").status_code == 200
