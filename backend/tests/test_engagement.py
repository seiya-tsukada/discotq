from __future__ import annotations

from typing import Any
from uuid import uuid4

from fastapi.testclient import TestClient

from backend.app.db import Conn
from backend.app.email import ConsoleEmailSender
from backend.app.storage.r2 import R2Storage
from backend.tests.conftest import make_admin, requires_db, signup, upload_video

pytestmark = requires_db


def _approved_video(
    make_client: Any, storage: R2Storage, db: Conn, outbox: ConsoleEmailSender
) -> tuple[str, TestClient]:
    """承認済みの動画 ID と、管理者クライアントを返す。"""
    uploader: TestClient = make_client(anonymous_id=str(uuid4()))
    vid: str = upload_video(uploader, storage)["video_id"]
    admin: TestClient = make_client()
    make_admin(db, admin, outbox)
    assert admin.post(f"/api/admin/videos/{vid}/approve").status_code == 200
    return vid, admin


def _feed_like_count(client: TestClient, vid: str) -> int:
    items = client.get("/api/videos/feed").json()["items"]
    return int(next(i for i in items if i["id"] == vid)["like_count"])


def test_anonymous_like_is_idempotent_and_counted(
    make_client: Any, storage: R2Storage, db: Conn, outbox: ConsoleEmailSender
) -> None:
    vid, _ = _approved_video(make_client, storage, db, outbox)
    guest = make_client(anonymous_id=str(uuid4()))

    assert guest.post(f"/api/videos/{vid}/like").json() == {"liked": True, "like_count": 1}
    # 二重に押しても 1 件のまま
    assert guest.post(f"/api/videos/{vid}/like").json() == {"liked": True, "like_count": 1}
    assert guest.get("/api/me/engagement").json()["liked_video_ids"] == [vid]
    assert _feed_like_count(make_client(), vid) == 1

    assert guest.delete(f"/api/videos/{vid}/like").json() == {"liked": False, "like_count": 0}
    assert guest.delete(f"/api/videos/{vid}/like").json() == {"liked": False, "like_count": 0}
    assert guest.get("/api/me/engagement").json()["liked_video_ids"] == []
    assert _feed_like_count(make_client(), vid) == 0


def test_guest_and_account_are_kept_separate(
    make_client: Any, storage: R2Storage, db: Conn, outbox: ConsoleEmailSender
) -> None:
    vid, _ = _approved_video(make_client, storage, db, outbox)
    anon_id = str(uuid4())
    guest = make_client(anonymous_id=anon_id)
    assert guest.post(f"/api/videos/{vid}/like").status_code == 200
    assert guest.post(f"/api/videos/{vid}/bookmark").status_code == 200

    # 同じ端末（同じ匿名 ID）でログインしても、匿名でのいいね・保存は引き継がない
    member = make_client(anonymous_id=anon_id)
    signup(member, outbox)
    assert member.get("/api/me/engagement").json() == {
        "liked_video_ids": [],
        "bookmarked_video_ids": [],
    }

    # ログイン中のいいねはアカウントに付き、件数はゲスト分と合算される
    assert member.post(f"/api/videos/{vid}/like").json() == {"liked": True, "like_count": 2}
    row = db.execute(
        "select user_id, anonymous_id from discotq.video_likes where user_id is not null"
    ).fetchone()
    assert row is not None and row["anonymous_id"] is None

    # ログイン中に解除しても、ゲストのいいねは残る
    assert member.delete(f"/api/videos/{vid}/like").json() == {"liked": False, "like_count": 1}
    assert guest.get("/api/me/engagement").json() == {
        "liked_video_ids": [vid],
        "bookmarked_video_ids": [vid],
    }


def test_bookmark_list_hides_unpublished_but_can_still_be_removed(
    make_client: Any, storage: R2Storage, db: Conn, outbox: ConsoleEmailSender
) -> None:
    vid, admin = _approved_video(make_client, storage, db, outbox)
    guest = make_client(anonymous_id=str(uuid4()))
    assert guest.post(f"/api/videos/{vid}/bookmark").json() == {"bookmarked": True}
    assert guest.post(f"/api/videos/{vid}/bookmark").json() == {"bookmarked": True}
    assert guest.get("/api/me/engagement").json()["bookmarked_video_ids"] == [vid]

    assert admin.post(f"/api/admin/videos/{vid}/unpublish", json={"reason": None}).status_code == 200
    assert guest.get("/api/me/engagement").json()["bookmarked_video_ids"] == []
    # 非公開の動画には新たに登録できないが、解除はできる
    assert guest.post(f"/api/videos/{vid}/bookmark").status_code == 404
    assert guest.delete(f"/api/videos/{vid}/bookmark").json() == {"bookmarked": False}
    count = db.execute("select count(*) as n from discotq.video_bookmarks").fetchone()
    assert count is not None and count["n"] == 0


def test_cannot_like_missing_or_unapproved_video(
    make_client: Any, storage: R2Storage, outbox: ConsoleEmailSender
) -> None:
    guest = make_client(anonymous_id=str(uuid4()))
    pending = upload_video(guest, storage)["video_id"]
    assert guest.post(f"/api/videos/{pending}/like").status_code == 404
    assert guest.post(f"/api/videos/{uuid4()}/like").status_code == 404
    assert guest.post(f"/api/videos/{uuid4()}/bookmark").status_code == 404


def test_requires_anonymous_id_or_login(
    make_client: Any, storage: R2Storage, db: Conn, outbox: ConsoleEmailSender
) -> None:
    vid, _ = _approved_video(make_client, storage, db, outbox)
    nobody = make_client()
    res = nobody.post(f"/api/videos/{vid}/like")
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "anonymous_id_required"
    assert nobody.get("/api/me/engagement").json() == {
        "liked_video_ids": [],
        "bookmarked_video_ids": [],
    }


def test_likes_are_removed_with_the_video(
    make_client: Any, storage: R2Storage, db: Conn, outbox: ConsoleEmailSender
) -> None:
    vid, _ = _approved_video(make_client, storage, db, outbox)
    guest = make_client(anonymous_id=str(uuid4()))
    guest.post(f"/api/videos/{vid}/like")
    guest.post(f"/api/videos/{vid}/bookmark")
    db.execute("delete from discotq.videos where id = %s", (vid,))
    for table in ("video_likes", "video_bookmarks"):
        row = db.execute(f"select count(*) as n from discotq.{table}").fetchone()
        assert row is not None and row["n"] == 0
