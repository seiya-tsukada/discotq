"""フィードに出す動画の選び方・並べ方（フィード戦略）。

/api/videos/feed はどの動画をどの順で返すかを ``FeedStrategy`` に任せる。
独自のアルゴリズム（人気順・視聴履歴を使ったおすすめなど）を入れるときは、
``FeedStrategy`` を満たすクラスを足して ``get_feed_strategy`` の戻り値を差し替えるだけでよく、
ルーターやフロントは変えなくてよい。

戦略が守ること:
* 返すのは承認済み（status = 'approved'）の動画だけ。行は ``videos_repo.list_feed`` と同じ列を持つ
  （FeedItem への変換に使う。uploader_name / like_count / comment_count を含む）
* カーソルは戦略ごとに自由な形式でよい（クライアントには不透明な文字列として渡す）。
  不正なカーソルは ``bad_request("invalid_cursor", ...)`` にする
* 閲覧者ごとに結果が変わるなら ``personalized = True`` にする。共有 CDN にキャッシュさせないため
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from backend.app.auth import Principal
from backend.app.db import Conn
from backend.app.pagination import decode_cursor, encode_cursor
from backend.app.repositories import videos as videos_repo
from backend.app.repositories.videos import VideoRow


@dataclass(frozen=True)
class FeedPage:
    rows: list[VideoRow]
    # 続きが無ければ None
    next_cursor: str | None


class FeedStrategy(Protocol):
    # ログや計測で使う識別名
    name: str
    # True なら閲覧者ごとに結果が変わる（レスポンスを共有キャッシュさせない）
    personalized: bool

    def fetch_page(
        self, conn: Conn, *, viewer: Principal, cursor: str | None, limit: int
    ) -> FeedPage: ...


class LatestApprovedStrategy:
    """承認日時の新しい順。閲覧者によらず同じ結果を返す。"""

    name = "latest"
    personalized = False

    def fetch_page(
        self, conn: Conn, *, viewer: Principal, cursor: str | None, limit: int
    ) -> FeedPage:
        after = decode_cursor(cursor) if cursor else None
        rows = videos_repo.list_feed(conn, limit=limit + 1, after=after)
        has_more = len(rows) > limit
        rows = rows[:limit]
        next_cursor = (
            encode_cursor(rows[-1]["approved_at"], rows[-1]["id"]) if has_more and rows else None
        )
        return FeedPage(rows=rows, next_cursor=next_cursor)


def get_feed_strategy() -> FeedStrategy:
    """今使うフィード戦略。アルゴリズムを切り替えるときはここを差し替える（テストでは上書きできる）。"""
    return LatestApprovedStrategy()
