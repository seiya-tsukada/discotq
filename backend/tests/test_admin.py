from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient

from backend.app.db import Conn
from backend.app.email import ConsoleEmailSender
from backend.app.storage.r2 import PUBLIC_CACHE_CONTROL, R2Storage
from backend.tests.conftest import (
    PUBLIC,
    intent_payload,
    make_admin,
    object_exists,
    put_uploads,
    requires_db,
    signup,
    upload_video,
)

pytestmark = requires_db


def _admin(make_client: Any, db: Conn, outbox: ConsoleEmailSender) -> TestClient:
    c: TestClient = make_client()
    make_admin(db, c, outbox)
    return c


def test_admin_endpoints_require_admin(make_client: Any, outbox: ConsoleEmailSender) -> None:
    anon = make_client()
    assert anon.get("/api/admin/videos").status_code == 401
    user = make_client()
    signup(user, outbox)
    assert user.get("/api/admin/videos").status_code == 403


def test_unverified_admin_is_rejected(make_client: Any, outbox: ConsoleEmailSender, db: Conn) -> None:
    c = make_client()
    u = signup(c, outbox, verify=False)
    db.execute("insert into discotq.admins (user_id) values (%s)", (u["id"],))
    assert c.get("/api/admin/stats").status_code == 403


def test_review_queue_is_oldest_first(
    make_client: Any, anon_client: TestClient, storage: R2Storage, db: Conn, outbox: ConsoleEmailSender
) -> None:
    a = upload_video(anon_client, storage, title="first")
    b = upload_video(anon_client, storage, title="second")
    db.execute(
        "update discotq.videos set created_at = now() - interval '1 hour' where id = %s", (a["video_id"],)
    )
    admin = _admin(make_client, db, outbox)
    items = admin.get("/api/admin/videos", params={"status": "in_review"}).json()["items"]
    assert [v["id"] for v in items] == [a["video_id"], b["video_id"]]
    stats = admin.get("/api/admin/stats").json()
    assert stats["counts"] == {"in_review": 2}
    assert stats["oldest_in_review_at"] is not None


def test_preview_url_is_short_lived_signed_get(
    make_client: Any, anon_client: TestClient, storage: R2Storage, db: Conn, outbox: ConsoleEmailSender
) -> None:
    v = upload_video(anon_client, storage)
    admin = _admin(make_client, db, outbox)
    body = admin.get(f"/api/admin/videos/{v['video_id']}/preview-url").json()
    assert body["expires_in"] == 300
    assert "X-Amz-Expires=300" in body["video_url"]
    assert body["thumb_url"] is not None


def test_approve_publishes_to_feed(
    make_client: Any, anon_client: TestClient, storage: R2Storage, db: Conn, outbox: ConsoleEmailSender
) -> None:
    v = upload_video(anon_client, storage)
    vid = v["video_id"]
    admin = _admin(make_client, db, outbox)
    res = admin.post(f"/api/admin/videos/{vid}/approve")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "approved"
    assert body["public_url"] == f"https://media.example.test/videos/{vid}/original.mp4"
    assert body["thumb_url"] == f"https://media.example.test/videos/{vid}/thumb.jpg"

    head = storage.client.head_object(Bucket=PUBLIC, Key=f"videos/{vid}/original.mp4")
    assert head["ContentType"] == "video/mp4"
    assert head["CacheControl"] == PUBLIC_CACHE_CONTROL

    feed = make_client().get("/api/videos/feed").json()
    assert [i["id"] for i in feed["items"]] == [vid]
    assert feed["items"][0]["video_url"] == body["public_url"]

    reviews = db.execute("select action from discotq.video_reviews where video_id = %s", (vid,)).fetchall()
    assert [r["action"] for r in reviews] == ["approve"]
    assert db.execute(
        "select 1 from discotq.audit_logs where action = 'video.approve' and target_id = %s", (vid,)
    ).fetchone()
    # 投稿者からも承認済みに見える
    assert anon_client.get("/api/me/videos").json()["items"][0]["status"] == "approved"
    # 二重承認は不可
    assert admin.post(f"/api/admin/videos/{vid}/approve").status_code == 409


def test_reject_requires_reason_and_removes_public(
    make_client: Any, anon_client: TestClient, storage: R2Storage, db: Conn, outbox: ConsoleEmailSender
) -> None:
    vid = upload_video(anon_client, storage)["video_id"]
    admin = _admin(make_client, db, outbox)
    assert admin.post(f"/api/admin/videos/{vid}/reject", json={}).status_code == 422
    assert admin.post(f"/api/admin/videos/{vid}/reject", json={"reason": "   "}).status_code == 400

    admin.post(f"/api/admin/videos/{vid}/approve")
    assert object_exists(storage, PUBLIC, f"videos/{vid}/original.mp4")
    res = admin.post(f"/api/admin/videos/{vid}/reject", json={"reason": "権利侵害の疑い"})
    assert res.status_code == 200
    assert res.json()["status"] == "rejected"
    assert res.json()["public_url"] is None
    assert not object_exists(storage, PUBLIC, f"videos/{vid}/original.mp4")
    assert not object_exists(storage, PUBLIC, f"videos/{vid}/thumb.jpg")

    mine = anon_client.get("/api/me/videos").json()["items"][0]
    assert mine["status"] == "rejected"
    assert mine["rejection_reason"] == "権利侵害の疑い"
    assert make_client().get("/api/videos/feed").json()["items"] == []

    detail = admin.get(f"/api/admin/videos/{vid}").json()
    assert [r["action"] for r in detail["reviews"]] == ["approve", "reject"]


def test_unpublish(
    make_client: Any, anon_client: TestClient, storage: R2Storage, db: Conn, outbox: ConsoleEmailSender
) -> None:
    vid = upload_video(anon_client, storage)["video_id"]
    admin = _admin(make_client, db, outbox)
    assert admin.post(f"/api/admin/videos/{vid}/unpublish").status_code == 409
    admin.post(f"/api/admin/videos/{vid}/approve")
    res = admin.post(f"/api/admin/videos/{vid}/unpublish", json={"reason": "期間終了"})
    assert res.status_code == 200 and res.json()["status"] == "unpublished"
    assert not object_exists(storage, PUBLIC, f"videos/{vid}/original.mp4")
    # 再承認できる（非公開バケットに原本が残っている）
    assert admin.post(f"/api/admin/videos/{vid}/approve").status_code == 200


def test_user_delete_of_approved_video_removes_public(
    make_client: Any, anon_client: TestClient, storage: R2Storage, db: Conn, outbox: ConsoleEmailSender
) -> None:
    vid = upload_video(anon_client, storage)["video_id"]
    admin = _admin(make_client, db, outbox)
    admin.post(f"/api/admin/videos/{vid}/approve")
    assert anon_client.delete(f"/api/me/videos/{vid}").status_code == 200
    assert not object_exists(storage, PUBLIC, f"videos/{vid}/original.mp4")
    row = db.execute("select status, deleted_at, public_url from discotq.videos where id = %s", (vid,)).fetchone()
    assert row is not None
    assert row["status"] == "deleted" and row["deleted_at"] is not None and row["public_url"] is None


def test_admin_platform_upload_auto_approve(
    make_client: Any, storage: R2Storage, db: Conn, outbox: ConsoleEmailSender
) -> None:
    admin = _admin(make_client, db, outbox)
    res = admin.post("/api/admin/uploads/intent", json=intent_payload(auto_approve=True))
    assert res.status_code == 201
    intent = res.json()
    put_uploads(storage, intent)
    done = admin.post(f"/api/uploads/{intent['video_id']}/complete")
    assert done.status_code == 200
    assert done.json()["status"] == "approved"
    reviews = db.execute(
        "select action from discotq.video_reviews where video_id = %s", (intent["video_id"],)
    ).fetchall()
    assert [r["action"] for r in reviews] == ["auto_approve"]

    # auto_approve なしなら審査待ち
    res2 = admin.post("/api/admin/uploads/intent", json=intent_payload()).json()
    put_uploads(storage, res2)
    assert admin.post(f"/api/uploads/{res2['video_id']}/complete").json()["status"] == "in_review"
    listed = admin.get("/api/admin/videos", params={"source": "platform"}).json()["items"]
    assert {v["id"] for v in listed} == {intent["video_id"], res2["video_id"]}


def test_non_admin_cannot_complete_platform_upload(
    make_client: Any, storage: R2Storage, db: Conn, outbox: ConsoleEmailSender
) -> None:
    admin = _admin(make_client, db, outbox)
    intent = admin.post("/api/admin/uploads/intent", json=intent_payload()).json()
    put_uploads(storage, intent)
    assert make_client().post(f"/api/uploads/{intent['video_id']}/complete").status_code == 404


def test_feed_cursor_paging(
    make_client: Any, anon_client: TestClient, storage: R2Storage, db: Conn, outbox: ConsoleEmailSender
) -> None:
    admin = _admin(make_client, db, outbox)
    ids = []
    for i in range(3):
        vid = upload_video(anon_client, storage, title=f"v{i}")["video_id"]
        admin.post(f"/api/admin/videos/{vid}/approve")
        ids.append(vid)
    viewer = make_client()
    p1 = viewer.get("/api/videos/feed", params={"limit": 2}).json()
    assert [i["id"] for i in p1["items"]] == [ids[2], ids[1]]
    assert p1["next_cursor"]
    p2 = viewer.get("/api/videos/feed", params={"limit": 2, "cursor": p1["next_cursor"]}).json()
    assert [i["id"] for i in p2["items"]] == [ids[0]]
    assert p2["next_cursor"] is None
    assert viewer.get("/api/videos/feed", params={"cursor": "!!bad"}).status_code == 400


def test_feed_cache_headers_do_not_let_browsers_serve_stale(make_client: Any) -> None:
    res = make_client().get("/api/videos/feed")
    assert res.headers["cache-control"] == "public, max-age=0, must-revalidate"
    assert "stale-while-revalidate" in res.headers["cdn-cache-control"]
