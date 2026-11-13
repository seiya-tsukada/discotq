from __future__ import annotations

from typing import Any
from uuid import uuid4

from fastapi.testclient import TestClient

from backend.app.db import Conn
from backend.app.email import ConsoleEmailSender
from backend.app.storage.r2 import R2Storage
from backend.tests.conftest import (
    PRIVATE,
    intent_payload,
    object_exists,
    put_uploads,
    requires_db,
    signup,
    upload_video,
)

pytestmark = requires_db


def test_intent_returns_signed_urls_and_creates_pending_row(
    anon_client: TestClient, db: Conn
) -> None:
    res = anon_client.post("/api/uploads/intent", json=intent_payload())
    assert res.status_code == 201, res.text
    body = res.json()
    url = body["upload"]["url"]
    assert body["upload"]["method"] == "PUT"
    assert body["upload"]["headers"] == {"Content-Type": "video/mp4"}
    # サイズと MIME が署名に含まれている
    assert "X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost" in url
    assert "X-Amz-Expires=900" in url
    assert f"videos/{body['video_id']}/original.mp4" in url
    assert body["thumbnail_upload"] is not None

    row = db.execute("select * from discotq.videos where id = %s", (body["video_id"],)).fetchone()
    assert row is not None
    assert row["status"] == "pending_upload"
    assert row["source"] == "user"
    assert row["bucket"] == PRIVATE
    assert row["uploader_ip_hash"] and row["uploader_ip_hash"] != "203.0.113.10"


def test_intent_validation(anon_client: TestClient) -> None:
    res = anon_client.post("/api/uploads/intent", json=intent_payload(mime_type="video/avi"))
    assert res.status_code == 422
    res = anon_client.post("/api/uploads/intent", json=intent_payload(size_bytes=51 * 1024 * 1024))
    assert res.status_code == 413
    assert res.json()["error"]["code"] == "file_too_large"
    res = anon_client.post("/api/uploads/intent", json=intent_payload(duration_sec=181))
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "video_too_long"


def test_intent_requires_anonymous_id_when_not_logged_in(make_client: Any) -> None:
    res = make_client().post("/api/uploads/intent", json=intent_payload())
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "anonymous_id_required"
    res = make_client(anonymous_id="not-a-uuid").post("/api/uploads/intent", json=intent_payload())
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "invalid_anonymous_id"


def test_complete_moves_to_in_review(anon_client: TestClient, storage: R2Storage, db: Conn) -> None:
    intent = upload_video(anon_client, storage)
    row = db.execute("select * from discotq.videos where id = %s", (intent["video_id"],)).fetchone()
    assert row is not None
    assert row["status"] == "in_review"
    assert row["thumb_key"] == f"videos/{intent['video_id']}/thumb.jpg"
    actions = [
        r["action"]
        for r in db.execute(
            "select action from discotq.audit_logs where target_id = %s order by id", (intent["video_id"],)
        ).fetchall()
    ]
    assert actions == ["video.upload_intent", "video.upload_complete"]


def test_complete_with_size_mismatch_marks_failed_and_deletes(
    anon_client: TestClient, storage: R2Storage, db: Conn
) -> None:
    intent = anon_client.post("/api/uploads/intent", json=intent_payload()).json()
    put_uploads(storage, intent, body=b"\0" * 999)
    res = anon_client.post(f"/api/uploads/{intent['video_id']}/complete")
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "upload_mismatch"
    row = db.execute("select status from discotq.videos where id = %s", (intent["video_id"],)).fetchone()
    assert row is not None and row["status"] == "failed"
    assert not object_exists(storage, PRIVATE, f"videos/{intent['video_id']}/original.mp4")
    assert not object_exists(storage, PRIVATE, f"videos/{intent['video_id']}/thumb.jpg")


def test_complete_with_content_type_mismatch_marks_failed(
    anon_client: TestClient, storage: R2Storage, db: Conn
) -> None:
    intent = anon_client.post("/api/uploads/intent", json=intent_payload()).json()
    storage.client.put_object(
        Bucket=PRIVATE,
        Key=f"videos/{intent['video_id']}/original.mp4",
        Body=b"\0" * 1024,
        ContentType="video/webm",
    )
    res = anon_client.post(f"/api/uploads/{intent['video_id']}/complete")
    assert res.status_code == 400
    row = db.execute("select status from discotq.videos where id = %s", (intent["video_id"],)).fetchone()
    assert row is not None and row["status"] == "failed"


def test_complete_without_object_keeps_pending(anon_client: TestClient, db: Conn) -> None:
    intent = anon_client.post("/api/uploads/intent", json=intent_payload()).json()
    res = anon_client.post(f"/api/uploads/{intent['video_id']}/complete")
    assert res.status_code == 409
    row = db.execute("select status from discotq.videos where id = %s", (intent["video_id"],)).fetchone()
    assert row is not None and row["status"] == "pending_upload"


def test_missing_thumbnail_is_tolerated(anon_client: TestClient, storage: R2Storage, db: Conn) -> None:
    intent = anon_client.post("/api/uploads/intent", json=intent_payload()).json()
    put_uploads(storage, intent, thumb=False)
    res = anon_client.post(f"/api/uploads/{intent['video_id']}/complete")
    assert res.status_code == 200
    row = db.execute("select status, thumb_key from discotq.videos where id = %s", (intent["video_id"],)).fetchone()
    assert row is not None and row["status"] == "in_review" and row["thumb_key"] is None


def test_other_anonymous_user_cannot_complete_or_delete(
    anon_client: TestClient, make_client: Any, storage: R2Storage
) -> None:
    intent = anon_client.post("/api/uploads/intent", json=intent_payload()).json()
    put_uploads(storage, intent)
    other = make_client(anonymous_id=str(uuid4()))
    assert other.post(f"/api/uploads/{intent['video_id']}/complete").status_code == 404
    assert anon_client.post(f"/api/uploads/{intent['video_id']}/complete").status_code == 200
    assert other.delete(f"/api/me/videos/{intent['video_id']}").status_code == 404
    # 二重 complete は不可
    assert anon_client.post(f"/api/uploads/{intent['video_id']}/complete").status_code == 409


def test_anonymous_rate_limit_by_anonymous_id_and_ip(make_client: Any) -> None:
    c = make_client(anonymous_id=str(uuid4()), ip="198.51.100.1")
    for _ in range(3):
        assert c.post("/api/uploads/intent", json=intent_payload()).status_code == 201
    res = c.post("/api/uploads/intent", json=intent_payload())
    assert res.status_code == 429
    assert res.json()["error"]["code"] == "rate_limited"

    # 同じ IP から anonymous_id を変えても制限される
    same_ip = make_client(anonymous_id=str(uuid4()), ip="198.51.100.1")
    assert same_ip.post("/api/uploads/intent", json=intent_payload()).status_code == 429
    # 別 IP・別 ID なら可
    other = make_client(anonymous_id=str(uuid4()), ip="198.51.100.2")
    assert other.post("/api/uploads/intent", json=intent_payload()).status_code == 201


def test_my_videos_and_delete(anon_client: TestClient, storage: R2Storage) -> None:
    intent = upload_video(anon_client, storage)
    res = anon_client.get("/api/me/videos")
    assert res.status_code == 200
    items = res.json()["items"]
    assert [v["id"] for v in items] == [intent["video_id"]]
    assert items[0]["status"] == "in_review"
    assert items[0]["is_claimed"] is False

    assert anon_client.delete(f"/api/me/videos/{intent['video_id']}").status_code == 200
    assert anon_client.get("/api/me/videos").json()["items"] == []


def test_claim_links_anonymous_videos_to_verified_user(
    make_client: Any, storage: R2Storage, outbox: ConsoleEmailSender, db: Conn
) -> None:
    anon_id = str(uuid4())
    c = make_client(anonymous_id=anon_id)
    first = upload_video(c, storage)
    upload_video(c, storage)

    signup(c, outbox, verify=False)
    assert c.get("/api/me/videos").json()["claimable_count"] == 2
    # 未確認ユーザーは紐づけ不可
    res = c.post("/api/me/claim")
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "email_not_verified"

    from backend.tests.conftest import token_from_outbox

    c.post("/api/auth/verify-email", json={"token": token_from_outbox(outbox, "/verify-email")})
    res = c.post("/api/me/claim")
    assert res.status_code == 200 and res.json()["claimed"] == 2
    body = c.get("/api/me/videos").json()
    assert body["claimable_count"] == 0
    assert all(v["is_claimed"] for v in body["items"])

    # 紐づけ後は anonymous_id だけでは操作できない
    anon_only = make_client(anonymous_id=anon_id)
    assert anon_only.get("/api/me/videos").json()["items"] == []
    assert anon_only.delete(f"/api/me/videos/{first['video_id']}").status_code == 404
    assert c.delete(f"/api/me/videos/{first['video_id']}").status_code == 200
    log = db.execute("select * from discotq.audit_logs where action = 'video.claim'").fetchone()
    assert log is not None and len(log["payload"]["video_ids"]) == 2


def test_verified_user_upload_without_anonymous_id(
    make_client: Any, storage: R2Storage, outbox: ConsoleEmailSender
) -> None:
    c = make_client()
    user = signup(c, outbox)
    intent = upload_video(c, storage)
    items = c.get("/api/me/videos").json()["items"]
    assert items[0]["id"] == intent["video_id"] and items[0]["is_claimed"] is True
    assert user["email_verified"]
