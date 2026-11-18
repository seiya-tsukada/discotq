"""いいね・保存。

本人は ``Owner``（ログインユーザーなら user_id、未ログインなら anonymous_id のどちらか一方）で表す。
テーブル名は呼び出し側から受け取らず、``Kind`` から固定の名前に引く。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal
from uuid import UUID

from backend.app.db import Conn

Kind = Literal["like", "bookmark"]

_TABLES: dict[Kind, str] = {
    "like": "discotq.video_likes",
    "bookmark": "discotq.video_bookmarks",
}

# 自分のいいね・保存一覧で返す上限（新しい順）
MY_ENGAGEMENT_LIMIT = 1000


@dataclass(frozen=True)
class Owner:
    user_id: UUID | None
    anonymous_id: UUID | None

    def __post_init__(self) -> None:
        if (self.user_id is None) == (self.anonymous_id is None):
            raise ValueError("user_id と anonymous_id はどちらか一方だけを指定する")

    @property
    def column(self) -> str:
        return "user_id" if self.user_id is not None else "anonymous_id"

    @property
    def value(self) -> UUID:
        v = self.user_id if self.user_id is not None else self.anonymous_id
        assert v is not None
        return v


def add(conn: Conn, kind: Kind, *, video_id: UUID, owner: Owner) -> None:
    """登録する。すでに登録済みなら何もしない（冪等）。"""
    col = owner.column
    conn.execute(
        f"""
        insert into {_TABLES[kind]} (video_id, {col})
        values (%s, %s)
        on conflict ({col}, video_id) where {col} is not null do nothing
        """,
        (video_id, owner.value),
    )


def remove(conn: Conn, kind: Kind, *, video_id: UUID, owner: Owner) -> None:
    """解除する。登録されていなければ何もしない（冪等）。"""
    conn.execute(
        f"delete from {_TABLES[kind]} where video_id = %s and {owner.column} = %s",
        (video_id, owner.value),
    )


def count_likes(conn: Conn, video_id: UUID) -> int:
    row = conn.execute(
        "select count(*) as n from discotq.video_likes where video_id = %s", (video_id,)
    ).fetchone()
    assert row is not None
    return int(row["n"])


def list_video_ids(conn: Conn, kind: Kind, *, owner: Owner) -> list[UUID]:
    """自分が登録した、公開中の動画 ID を新しい順に返す。"""
    rows = conn.execute(
        f"""
        select e.video_id
        from {_TABLES[kind]} e
        join discotq.videos v on v.id = e.video_id
        where e.{owner.column} = %s and v.status = 'approved'
        order by e.created_at desc, e.id desc
        limit %s
        """,
        (owner.value, MY_ENGAGEMENT_LIMIT),
    ).fetchall()
    return [r["video_id"] for r in rows]
