"""フィードが services/feed.py の戦略に従うこと。"""

from __future__ import annotations

from typing import Any
from uuid import uuid4

from backend.app.auth import Principal
from backend.app.db import Conn
from backend.app.email import ConsoleEmailSender
from backend.app.main import app
from backend.app.repositories import videos as videos_repo
from backend.app.services.feed import FeedPage, get_feed_strategy
from backend.app.storage.r2 import R2Storage
from backend.tests.conftest import requires_db
from backend.tests.test_engagement import _approved_video

pytestmark = requires_db


class OldestFirstStrategy:
    """差し替えの確認用: 古い順に並べ、閲覧者を受け取ったことを記録する。"""

    name = "oldest"
    personalized = True

    def __init__(self) -> None:
        self.viewers: list[Principal] = []

    def fetch_page(
        self, conn: Conn, *, viewer: Principal, cursor: str | None, limit: int
    ) -> FeedPage:
        self.viewers.append(viewer)
        rows = videos_repo.list_feed(conn, limit=50, after=None)
        return FeedPage(rows=list(reversed(rows))[:limit], next_cursor=None)


def test_default_strategy_is_newest_first_and_cdn_cached(
    make_client: Any, storage: R2Storage, db: Conn, outbox: ConsoleEmailSender
) -> None:
    first, _ = _approved_video(make_client, storage, db, outbox)
    second, _ = _approved_video(make_client, storage, db, outbox)
    res = make_client().get("/api/videos/feed")
    assert [i["id"] for i in res.json()["items"]] == [second, first]
    assert res.headers["cdn-cache-control"].startswith("public")


def test_feed_uses_the_configured_strategy(
    make_client: Any, storage: R2Storage, db: Conn, outbox: ConsoleEmailSender
) -> None:
    first, _ = _approved_video(make_client, storage, db, outbox)
    second, _ = _approved_video(make_client, storage, db, outbox)
    strategy = OldestFirstStrategy()
    app.dependency_overrides[get_feed_strategy] = lambda: strategy

    anon_id = str(uuid4())
    res = make_client(anonymous_id=anon_id).get("/api/videos/feed")
    assert [i["id"] for i in res.json()["items"]] == [first, second]
    assert str(strategy.viewers[-1].anonymous_id) == anon_id
    # 閲覧者ごとの結果は共有キャッシュさせない
    assert res.headers["cache-control"] == "private, no-store"
    assert "cdn-cache-control" not in res.headers
