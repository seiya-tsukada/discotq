from __future__ import annotations

from typing import Any
from uuid import uuid4

from fastapi.testclient import TestClient

from backend.app.db import Conn
from backend.app.email import ConsoleEmailSender
from backend.app.storage.r2 import R2Storage
from backend.tests.conftest import requires_db, signup
from backend.tests.test_engagement import _approved_video

pytestmark = requires_db


def _member(make_client: Any, outbox: ConsoleEmailSender, **kw: Any) -> TestClient:
    c: TestClient = make_client(anonymous_id=str(uuid4()))
    signup(c, outbox, **kw)
    return c


def _allow_next_post(db: Conn) -> None:
    """連投間隔の制限を避けるため、既存コメントの投稿時刻を過去にずらす。"""
    db.execute("update discotq.video_comments set created_at = created_at - interval '1 minute'")


def _feed_comment_count(client: TestClient, vid: str) -> int:
    items = client.get("/api/videos/feed").json()["items"]
    return int(next(i for i in items if i["id"] == vid)["comment_count"])


def test_post_and_list_comments(
    make_client: Any, storage: R2Storage, db: Conn, outbox: ConsoleEmailSender
) -> None:
    vid, _ = _approved_video(make_client, storage, db, outbox)
    member = _member(make_client, outbox)

    res = member.post(f"/api/videos/{vid}/comments", json={"body": "  最高でした  "})
    assert res.status_code == 201, res.text
    first = res.json()
    assert first["body"] == "最高でした"
    assert first["is_mine"] is True and first["can_delete"] is True
    _allow_next_post(db)
    second = member.post(f"/api/videos/{vid}/comments", json={"body": "2回目"}).json()

    # 他人（ゲスト）からも見える。新しい順で、自分のものではない
    guest = make_client(anonymous_id=str(uuid4()))
    body = guest.get(f"/api/videos/{vid}/comments").json()
    assert [c["id"] for c in body["items"]] == [second["id"], first["id"]]
    assert body["total_count"] == 2 and body["next_cursor"] is None
    assert all(c["is_mine"] is False and c["can_delete"] is False for c in body["items"])
    assert _feed_comment_count(guest, vid) == 2


def test_pagination(
    make_client: Any, storage: R2Storage, db: Conn, outbox: ConsoleEmailSender
) -> None:
    vid, _ = _approved_video(make_client, storage, db, outbox)
    member = _member(make_client, outbox)
    ids = []
    for i in range(3):
        ids.append(member.post(f"/api/videos/{vid}/comments", json={"body": f"c{i}"}).json()["id"])
        _allow_next_post(db)

    page1 = member.get(f"/api/videos/{vid}/comments", params={"limit": 2}).json()
    assert [c["id"] for c in page1["items"]] == [ids[2], ids[1]]
    assert page1["next_cursor"] and page1["total_count"] == 3
    page2 = member.get(
        f"/api/videos/{vid}/comments", params={"limit": 2, "cursor": page1["next_cursor"]}
    ).json()
    assert [c["id"] for c in page2["items"]] == [ids[0]]
    assert page2["next_cursor"] is None


def test_guest_and_unverified_user_cannot_post(
    make_client: Any, storage: R2Storage, db: Conn, outbox: ConsoleEmailSender
) -> None:
    vid, _ = _approved_video(make_client, storage, db, outbox)
    guest = make_client(anonymous_id=str(uuid4()))
    assert guest.post(f"/api/videos/{vid}/comments", json={"body": "hi"}).status_code == 401
    unverified = _member(make_client, outbox, verify=False)
    res = unverified.post(f"/api/videos/{vid}/comments", json={"body": "hi"})
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "email_not_verified"


def test_body_validation(
    make_client: Any, storage: R2Storage, db: Conn, outbox: ConsoleEmailSender
) -> None:
    vid, _ = _approved_video(make_client, storage, db, outbox)
    member = _member(make_client, outbox)
    for body in ("", "   ", "あ" * 501):
        assert member.post(f"/api/videos/{vid}/comments", json={"body": body}).status_code == 422
    assert member.post(f"/api/videos/{vid}/comments", json={"body": "あ" * 500}).status_code == 201


def test_rate_limit(
    make_client: Any, storage: R2Storage, db: Conn, outbox: ConsoleEmailSender
) -> None:
    vid, _ = _approved_video(make_client, storage, db, outbox)
    member = _member(make_client, outbox)
    assert member.post(f"/api/videos/{vid}/comments", json={"body": "1"}).status_code == 201
    res = member.post(f"/api/videos/{vid}/comments", json={"body": "2"})
    assert res.status_code == 429
    assert res.json()["error"]["code"] == "rate_limited"

    # 1 時間あたりの上限
    user_id = member.get("/api/auth/me").json()["user"]["id"]
    db.execute(
        """
        insert into discotq.video_comments (video_id, user_id, body, created_at)
        select %s, %s, 'x', now() - interval '30 minutes' from generate_series(1, 30)
        """,
        (vid, user_id),
    )
    _allow_next_post(db)
    res = member.post(f"/api/videos/{vid}/comments", json={"body": "3"})
    assert res.status_code == 429 and res.json()["error"]["limit"] == 30


def test_cannot_comment_on_missing_or_unpublished_video(
    make_client: Any, storage: R2Storage, db: Conn, outbox: ConsoleEmailSender
) -> None:
    vid, admin = _approved_video(make_client, storage, db, outbox)
    member = _member(make_client, outbox)
    assert member.post(f"/api/videos/{uuid4()}/comments", json={"body": "x"}).status_code == 404
    assert member.get(f"/api/videos/{uuid4()}/comments").status_code == 404
    assert admin.post(f"/api/admin/videos/{vid}/unpublish", json={"reason": None}).status_code == 200
    assert member.post(f"/api/videos/{vid}/comments", json={"body": "x"}).status_code == 404
    assert member.get(f"/api/videos/{vid}/comments").status_code == 404


def test_owner_can_soft_delete(
    make_client: Any, storage: R2Storage, db: Conn, outbox: ConsoleEmailSender
) -> None:
    vid, _ = _approved_video(make_client, storage, db, outbox)
    author = _member(make_client, outbox)
    other = _member(make_client, outbox)
    cid = author.post(f"/api/videos/{vid}/comments", json={"body": "消す"}).json()["id"]

    # 他人・ゲストは消せない
    assert other.delete(f"/api/comments/{cid}").status_code == 403
    assert make_client(anonymous_id=str(uuid4())).delete(f"/api/comments/{cid}").status_code == 401

    assert author.delete(f"/api/comments/{cid}").json() == {"ok": True}
    assert author.delete(f"/api/comments/{cid}").status_code == 404
    body = author.get(f"/api/videos/{vid}/comments").json()
    assert body["items"] == [] and body["total_count"] == 0
    assert _feed_comment_count(author, vid) == 0

    # 本文は残っている（論理削除）
    row = db.execute(
        "select body, deleted_at, deleted_by, user_id from discotq.video_comments where id = %s", (cid,)
    ).fetchone()
    assert row is not None and row["body"] == "消す" and row["deleted_at"] is not None
    assert row["deleted_by"] == row["user_id"]
    log = db.execute(
        "select actor_type from discotq.audit_logs where action = 'comment.delete' and target_id = %s",
        (cid,),
    ).fetchone()
    assert log is not None and log["actor_type"] == "user"


def test_admin_can_delete_any_comment(
    make_client: Any, storage: R2Storage, db: Conn, outbox: ConsoleEmailSender
) -> None:
    vid, admin = _approved_video(make_client, storage, db, outbox)
    author = _member(make_client, outbox)
    cid = author.post(f"/api/videos/{vid}/comments", json={"body": "荒らし"}).json()["id"]

    listed = admin.get(f"/api/videos/{vid}/comments").json()["items"][0]
    assert listed["is_mine"] is False and listed["can_delete"] is True
    assert admin.delete(f"/api/comments/{cid}").status_code == 200
    log = db.execute(
        "select actor_type from discotq.audit_logs where action = 'comment.delete' and target_id = %s",
        (cid,),
    ).fetchone()
    assert log is not None and log["actor_type"] == "admin"


def test_comments_are_removed_with_the_video(
    make_client: Any, storage: R2Storage, db: Conn, outbox: ConsoleEmailSender
) -> None:
    vid, _ = _approved_video(make_client, storage, db, outbox)
    author = _member(make_client, outbox)
    author.post(f"/api/videos/{vid}/comments", json={"body": "x"})
    db.execute("delete from discotq.videos where id = %s", (vid,))
    row = db.execute("select count(*) as n from discotq.video_comments").fetchone()
    assert row is not None and row["n"] == 0
