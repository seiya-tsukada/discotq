from __future__ import annotations

import re
from typing import Any
from uuid import uuid4

import psycopg
import pytest
from fastapi.testclient import TestClient

from backend.app.db import Conn
from backend.app.email import ConsoleEmailSender
from backend.app.services import rewards as reward_service
from backend.tests.conftest import requires_db, signup

pytestmark = requires_db


def _video(
    db: Conn,
    *,
    duration: float | None = 12.5,
    status: str = "approved",
    uploader_user_id: str | None = None,
    anonymous_id: str | None = None,
    title: str = "テスト動画",
) -> str:
    """フィードに出せる状態の動画を直接作る（投稿のレート制限を避けるため API を通さない）。"""
    vid = str(uuid4())
    db.execute(
        """
        insert into discotq.videos
          (id, source, uploader_user_id, anonymous_id, title, bucket, object_key, public_url,
           mime_type, size_bytes, duration_sec, status, approved_at)
        values (%s, 'user', %s, %s, %s, 'b', %s, %s, 'video/mp4', 1024, %s, %s,
                case when %s = 'approved' then now() end)
        """,
        (
            vid,
            uploader_user_id,
            anonymous_id or (None if uploader_user_id else str(uuid4())),
            title,
            f"videos/{vid}/original.mp4",
            f"https://media.example.test/{vid}.mp4" if status == "approved" else None,
            duration,
            status,
            status,
        ),
    )
    return vid


def _start(client: TestClient, vid: str) -> dict[str, Any]:
    res = client.post(f"/api/videos/{vid}/views")
    assert res.status_code == 201, res.text
    body: dict[str, Any] = res.json()
    return body


def _backdate(db: Conn, session_id: str, seconds: int) -> None:
    db.execute(
        "update discotq.view_sessions set started_at = now() - make_interval(secs => %s) where id = %s",
        (seconds, session_id),
    )


def _watch(client: TestClient, db: Conn, vid: str) -> dict[str, Any]:
    """視聴開始 → 最低秒数を経過させて受け取る。"""
    s = _start(client, vid)
    _backdate(db, s["view_session_id"], s["min_watch_seconds"] + 1)
    res = client.post(f"/api/views/{s['view_session_id']}/claim")
    assert res.status_code == 200, res.text
    body: dict[str, Any] = res.json()
    return body


def _balance(client: TestClient) -> int:
    return int(client.get("/api/me/rewards").json()["balance"])


def _grant(db: Conn, user_id: str, points: int) -> None:
    db.execute(
        "insert into discotq.point_ledger (user_id, kind, points, title) values (%s, 'adjustment', %s, 'テスト付与')",
        (user_id, points),
    )


# ---------------------------------------------------------------- 視聴開始・受取


def test_claim_requires_min_watch_time_on_server_clock(make_client: Any, db: Conn) -> None:
    vid = _video(db)
    guest = make_client(anonymous_id=str(uuid4()))
    s = _start(guest, vid)
    assert s["min_watch_seconds"] == 5
    assert s["reward_points"] == 10
    assert s["already_claimed"] is False and s["reward_eligible"] is True

    # すぐに受け取ろうとしても、サーバーの時計で足りなければ断る
    res = guest.post(f"/api/views/{s['view_session_id']}/claim")
    assert res.status_code == 425
    assert res.json()["error"]["code"] == "too_early"
    assert 1 <= res.json()["error"]["retry_after_sec"] <= 5

    _backdate(db, s["view_session_id"], 6)
    body = guest.post(f"/api/views/{s['view_session_id']}/claim").json()
    assert body["earned"] is True and body["points"] == 10
    assert body["summary"] == {"owner": "anonymous", "balance": 10, "total_earned": 10, "level": "ブロンズ"}


def test_same_video_is_rewarded_only_once(make_client: Any, db: Conn) -> None:
    vid = _video(db)
    guest = make_client(anonymous_id=str(uuid4()))
    s = _start(guest, vid)
    _backdate(db, s["view_session_id"], 10)
    assert guest.post(f"/api/views/{s['view_session_id']}/claim").json()["earned"] is True
    # 同じセッションの再送
    again = guest.post(f"/api/views/{s['view_session_id']}/claim").json()
    assert again["earned"] is False and again["points"] == 0
    # 新しく視聴を始め直しても付かない
    assert _start(guest, vid)["already_claimed"] is True
    assert _watch(guest, db, vid)["earned"] is False

    mine = guest.get("/api/me/rewards").json()
    assert mine["balance"] == 10
    assert mine["claimed_video_ids"] == [vid]


def test_min_watch_seconds_follows_short_videos(make_client: Any, db: Conn) -> None:
    guest = make_client(anonymous_id=str(uuid4()))
    assert _start(guest, _video(db, duration=2.7))["min_watch_seconds"] == 2
    assert _start(guest, _video(db, duration=0.4))["min_watch_seconds"] == 1
    assert _start(guest, _video(db, duration=None))["min_watch_seconds"] == 5
    assert _start(guest, _video(db, duration=60))["min_watch_seconds"] == 5


def test_cannot_claim_someone_elses_session(make_client: Any, db: Conn) -> None:
    vid = _video(db)
    a = make_client(anonymous_id=str(uuid4()))
    b = make_client(anonymous_id=str(uuid4()))
    s = _start(a, vid)
    _backdate(db, s["view_session_id"], 10)
    res = b.post(f"/api/views/{s['view_session_id']}/claim")
    assert res.status_code == 404
    assert _balance(b) == 0


def test_expired_session_and_unpublished_video(make_client: Any, db: Conn) -> None:
    guest = make_client(anonymous_id=str(uuid4()))
    vid = _video(db)
    s = _start(guest, vid)
    _backdate(db, s["view_session_id"], reward_service.VIEW_SESSION_TTL_SEC + 5)
    res = guest.post(f"/api/views/{s['view_session_id']}/claim")
    assert res.status_code == 410

    # 視聴中に非公開になった
    s = _start(guest, vid)
    _backdate(db, s["view_session_id"], 10)
    db.execute("update discotq.videos set status = 'unpublished' where id = %s", (vid,))
    assert guest.post(f"/api/views/{s['view_session_id']}/claim").status_code == 404

    # 承認前の動画は視聴開始もできない
    assert guest.post(f"/api/videos/{_video(db, status='in_review')}/views").status_code == 404
    assert _balance(guest) == 0


def test_view_requires_some_identity(make_client: Any, db: Conn) -> None:
    res = make_client().post(f"/api/videos/{_video(db)}/views")
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "anonymous_id_required"


def test_own_video_is_not_rewarded(make_client: Any, db: Conn, outbox: ConsoleEmailSender) -> None:
    client = make_client(anonymous_id=str(uuid4()))
    user = signup(client, outbox)
    vid = _video(db, uploader_user_id=user["id"])
    s = _start(client, vid)
    assert s["reward_eligible"] is False
    _backdate(db, s["view_session_id"], 10)
    res = client.post(f"/api/views/{s['view_session_id']}/claim")
    assert res.status_code == 403 and res.json()["error"]["code"] == "own_video"

    anon_id = str(uuid4())
    guest = make_client(anonymous_id=anon_id)
    assert _start(guest, _video(db, anonymous_id=anon_id))["reward_eligible"] is False


def test_anonymous_claims_are_rate_limited_per_ip(
    make_client: Any, db: Conn, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(reward_service, "ANON_CLAIM_DAILY_LIMIT", 2)
    monkeypatch.setattr(reward_service, "ANON_CLAIM_DAILY_LIMIT_PER_IP", 3)
    a = make_client(anonymous_id=str(uuid4()))
    assert _watch(a, db, _video(db))["earned"] is True
    assert _watch(a, db, _video(db))["earned"] is True
    s = _start(a, _video(db))
    _backdate(db, s["view_session_id"], 10)
    res = a.post(f"/api/views/{s['view_session_id']}/claim")
    assert res.status_code == 429

    # 匿名 ID を作り直しても、同じ IP からは上限で止まる
    b = make_client(anonymous_id=str(uuid4()))
    assert _watch(b, db, _video(db))["earned"] is True
    s = _start(b, _video(db))
    _backdate(db, s["view_session_id"], 10)
    assert b.post(f"/api/views/{s['view_session_id']}/claim").status_code == 429
    # 別の IP なら受け取れる
    c = make_client(anonymous_id=str(uuid4()), ip="198.51.100.7")
    assert _watch(c, db, _video(db))["earned"] is True


def test_user_claims_are_rate_limited(
    make_client: Any, db: Conn, outbox: ConsoleEmailSender, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(reward_service, "USER_CLAIM_HOURLY_LIMIT", 1)
    client = make_client(anonymous_id=str(uuid4()))
    signup(client, outbox)
    assert _watch(client, db, _video(db))["earned"] is True
    s = _start(client, _video(db))
    _backdate(db, s["view_session_id"], 10)
    assert client.post(f"/api/views/{s['view_session_id']}/claim").status_code == 429


# ---------------------------------------------------------------- ログイン時の引き継ぎ


def test_guest_points_move_to_account_on_activate(
    make_client: Any, db: Conn, outbox: ConsoleEmailSender
) -> None:
    v1, v2, v3 = _video(db), _video(db), _video(db)
    anon_id = str(uuid4())
    client = make_client(anonymous_id=anon_id)
    _watch(client, db, v1)
    _watch(client, db, v2)
    assert client.get("/api/me/rewards").json()["owner"] == "anonymous"
    assert _balance(client) == 20

    signup(client, outbox)
    res = client.post("/api/me/rewards/activate").json()
    # 引き継ぐ分があるので、ウェルカムボーナスは付かない
    assert res["transferred_points"] == 20 and res["welcome_points"] == 0
    assert res["summary"]["owner"] == "user" and res["summary"]["balance"] == 20
    mine = client.get("/api/me/rewards").json()
    assert set(mine["claimed_video_ids"]) == {v1, v2}

    # 匿名側は 0 になっている
    guest_again = make_client(anonymous_id=anon_id)
    assert _balance(guest_again) == 0

    # 何度呼んでも増えない
    again = client.post("/api/me/rewards/activate").json()
    assert again["transferred_points"] == 0 and again["welcome_points"] == 0
    assert _balance(client) == 20

    # ログアウト後に同じ端末で貯めた分は、次のログインで引き継げる。受取済みの動画は二重にならない
    _watch(client, db, v3)  # ユーザーとして受取
    user = client.get("/api/auth/me").json()["user"]
    assert client.post("/api/auth/logout").status_code == 200
    v4 = _video(db)
    assert _watch(client, db, v1)["earned"] is False  # 匿名 ID で受取済み
    assert _watch(client, db, v3)["earned"] is True
    assert _watch(client, db, v4)["earned"] is True
    assert _balance(client) == 20
    login = client.post("/api/auth/login", json={"email": user["email"], "password": "correct-horse-battery"})
    assert login.status_code == 200
    res = client.post("/api/me/rewards/activate").json()
    assert res["transferred_points"] == 10  # v4 だけ。v3 はユーザーとして受取済み
    assert res["summary"]["balance"] == 20 + 10 + 10
    rows = db.execute("select payload from discotq.audit_logs where action = 'reward.guest_transfer'").fetchall()
    assert [r["payload"]["points"] for r in rows] == [20, 10]


def test_guest_transfer_skips_videos_already_claimed(
    make_client: Any, db: Conn, outbox: ConsoleEmailSender
) -> None:
    v1, v2 = _video(db), _video(db)
    client = make_client(anonymous_id=str(uuid4()))
    user = signup(client, outbox)
    client.post("/api/me/rewards/activate")  # ウェルカム 30pt
    _watch(client, db, v1)
    client.post("/api/auth/logout")

    _watch(client, db, v1)
    _watch(client, db, v2)
    assert _balance(client) == 20
    login = client.post("/api/auth/login", json={"email": user["email"], "password": "correct-horse-battery"})
    assert login.status_code == 200
    res = client.post("/api/me/rewards/activate").json()
    assert res["transferred_points"] == 10
    assert res["summary"]["balance"] == 30 + 10 + 10
    # 写せなかった v1 の分も匿名側からは消える
    client.post("/api/auth/logout")
    assert _balance(client) == 0


def test_welcome_bonus_only_once(make_client: Any, outbox: ConsoleEmailSender) -> None:
    client = make_client(anonymous_id=str(uuid4()))
    signup(client, outbox)
    first = client.post("/api/me/rewards/activate").json()
    assert first["welcome_points"] == 30 and first["summary"]["balance"] == 30
    assert client.post("/api/me/rewards/activate").json()["welcome_points"] == 0
    assert _balance(client) == 30
    assert make_client().post("/api/me/rewards/activate").status_code == 401


# ---------------------------------------------------------------- 履歴・ギフト交換


def test_history_is_paginated_newest_first(make_client: Any, db: Conn) -> None:
    guest = make_client(anonymous_id=str(uuid4()))
    vids = [_video(db, title=f"動画{i}") for i in range(3)]
    for v in vids:
        _watch(guest, db, v)
    page1 = guest.get("/api/me/rewards/history", params={"limit": 2}).json()
    assert [i["title"] for i in page1["items"]] == ["視聴リワード: 動画2", "視聴リワード: 動画1"]
    assert all(i["kind"] == "watch" and i["points"] == 10 for i in page1["items"])
    page2 = guest.get("/api/me/rewards/history", params={"limit": 2, "cursor": page1["next_cursor"]}).json()
    assert [i["title"] for i in page2["items"]] == ["視聴リワード: 動画0"]
    assert page2["next_cursor"] is None


def test_gifts_are_listed(make_client: Any) -> None:
    items = make_client().get("/api/rewards/gifts").json()["items"]
    assert [g["id"] for g in items][:2] == ["gift-1", "gift-2"]
    assert items[0]["points_cost"] == 500


def test_exchange_deducts_points_once(make_client: Any, db: Conn, outbox: ConsoleEmailSender) -> None:
    client = make_client(anonymous_id=str(uuid4()))
    user = signup(client, outbox)
    key = str(uuid4())

    res = client.post("/api/me/rewards/exchange", json={"gift_id": "gift-5", "idempotency_key": key})
    assert res.status_code == 409 and res.json()["error"]["code"] == "insufficient_points"

    _grant(db, user["id"], 350)
    res = client.post("/api/me/rewards/exchange", json={"gift_id": "gift-5", "idempotency_key": key})
    assert res.status_code == 200, res.text
    body = res.json()
    assert re.fullmatch(r"DISCOTQ-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}", body["code"])
    assert body["summary"]["balance"] == 50
    # 交換しても累計獲得は減らない
    assert body["summary"]["total_earned"] == 350

    # 同じキーの再送では引き落とさず、同じコードを返す
    replay = client.post("/api/me/rewards/exchange", json={"gift_id": "gift-5", "idempotency_key": key}).json()
    assert replay["code"] == body["code"] and replay["summary"]["balance"] == 50
    bad = client.post("/api/me/rewards/exchange", json={"gift_id": "gift-1", "idempotency_key": key})
    assert bad.status_code == 409 and bad.json()["error"]["code"] == "idempotency_conflict"

    history = client.get("/api/me/rewards/history").json()["items"]
    assert history[0]["kind"] == "exchange" and history[0]["points"] == -300
    assert history[0]["gift_code"] == body["code"]
    logs = db.execute("select count(*) as n from discotq.audit_logs where action = 'reward.exchange'").fetchone()
    assert logs is not None and logs["n"] == 1


def test_exchange_requires_verified_user_and_known_gift(
    make_client: Any, db: Conn, outbox: ConsoleEmailSender
) -> None:
    payload = {"gift_id": "gift-5", "idempotency_key": str(uuid4())}
    assert make_client(anonymous_id=str(uuid4())).post("/api/me/rewards/exchange", json=payload).status_code == 401

    unverified = make_client()
    user = signup(unverified, outbox, verify=False)
    _grant(db, user["id"], 1000)
    res = unverified.post("/api/me/rewards/exchange", json=payload)
    assert res.status_code == 403 and res.json()["error"]["code"] == "email_not_verified"

    verified = make_client()
    signup(verified, outbox)
    res = verified.post("/api/me/rewards/exchange", json={**payload, "gift_id": "nope"})
    assert res.status_code == 404


def test_exchange_is_rate_limited(
    make_client: Any, db: Conn, outbox: ConsoleEmailSender, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(reward_service, "EXCHANGE_DAILY_LIMIT", 1)
    client = make_client()
    user = signup(client, outbox)
    _grant(db, user["id"], 1000)
    ok = client.post("/api/me/rewards/exchange", json={"gift_id": "gift-5", "idempotency_key": str(uuid4())})
    assert ok.status_code == 200
    res = client.post("/api/me/rewards/exchange", json={"gift_id": "gift-5", "idempotency_key": str(uuid4())})
    assert res.status_code == 429


# ---------------------------------------------------------------- 台帳の制約


def test_ledger_constraints(db: Conn, make_client: Any, outbox: ConsoleEmailSender) -> None:
    client = make_client()
    user = signup(client, outbox)
    vid = _video(db)
    bad = [
        # 交換はマイナスのみ
        ("insert into discotq.point_ledger (user_id, kind, points, gift_id, gift_code, idempotency_key)"
         " values (%s, 'exchange', 100, 'g', 'c', gen_random_uuid())", (user["id"],)),
        # 匿名 ID はボーナスを持てない
        ("insert into discotq.point_ledger (anonymous_id, kind, points) values (gen_random_uuid(), 'welcome', 30)", ()),
        # 持ち主はどちらか一方
        ("insert into discotq.point_ledger (kind, points) values ('adjustment', 1)", ()),
    ]
    for sql, params in bad:
        with pytest.raises(psycopg.errors.CheckViolation):
            db.execute(sql, params)
    db.execute(
        "insert into discotq.point_ledger (user_id, kind, points, video_id) values (%s, 'watch', 10, %s)",
        (user["id"], vid),
    )
    with pytest.raises(psycopg.errors.UniqueViolation):
        db.execute(
            "insert into discotq.point_ledger (user_id, kind, points, video_id) values (%s, 'watch', 10, %s)",
            (user["id"], vid),
        )

    # 動画を物理削除しても台帳の行は残る（残高を変えない）
    db.execute("delete from discotq.videos where id = %s", (vid,))
    row = db.execute(
        "select count(*) as n from discotq.point_ledger where user_id = %s and kind = 'watch'", (user["id"],)
    ).fetchone()
    assert row is not None and row["n"] == 1
