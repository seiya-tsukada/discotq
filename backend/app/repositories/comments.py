"""動画へのコメント。削除は deleted_at を入れる論理削除で、一覧・件数からは外す。"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from backend.app.db import Conn

CommentRow = dict[str, Any]

_SELECT = """
    select c.id, c.video_id, c.user_id, c.body, c.created_at, c.deleted_at,
           u.display_name as author_name
    from discotq.video_comments c
    join discotq.users u on u.id = c.user_id
"""


def create(conn: Conn, *, video_id: UUID, user_id: UUID, body: str) -> CommentRow:
    row = conn.execute(
        """
        insert into discotq.video_comments (video_id, user_id, body)
        values (%s, %s, %s)
        returning id
        """,
        (video_id, user_id, body),
    ).fetchone()
    assert row is not None
    created = get(conn, row["id"])
    assert created is not None
    return created


def get(conn: Conn, comment_id: UUID) -> CommentRow | None:
    """削除済みも含めて 1 件返す。"""
    return conn.execute(_SELECT + " where c.id = %s", (comment_id,)).fetchone()


def list_for_video(
    conn: Conn, video_id: UUID, *, limit: int, after: tuple[datetime, UUID] | None
) -> list[CommentRow]:
    """削除されていないコメントを新しい順に返す。"""
    return conn.execute(
        _SELECT
        + """
        where c.video_id = %(video_id)s
          and c.deleted_at is null
          and (%(after_at)s::timestamptz is null or (c.created_at, c.id) < (%(after_at)s, %(after_id)s))
        order by c.created_at desc, c.id desc
        limit %(limit)s
        """,
        {
            "video_id": video_id,
            "after_at": after[0] if after else None,
            "after_id": after[1] if after else None,
            "limit": limit,
        },
    ).fetchall()


def count_for_video(conn: Conn, video_id: UUID) -> int:
    row = conn.execute(
        "select count(*) as n from discotq.video_comments where video_id = %s and deleted_at is null",
        (video_id,),
    ).fetchone()
    assert row is not None
    return int(row["n"])


def soft_delete(conn: Conn, comment_id: UUID, *, deleted_by: UUID) -> bool:
    """削除済みにする。対象が無いか、すでに削除済みなら False。"""
    row = conn.execute(
        """
        update discotq.video_comments
        set deleted_at = now(), deleted_by = %s
        where id = %s and deleted_at is null
        returning id
        """,
        (deleted_by, comment_id),
    ).fetchone()
    return row is not None


def seconds_since_last_post(conn: Conn, user_id: UUID) -> float | None:
    """このユーザーが最後に投稿してからの秒数（削除したものも数える）。投稿が無ければ None。"""
    row = conn.execute(
        """
        select extract(epoch from now() - max(created_at)) as sec
        from discotq.video_comments where user_id = %s
        """,
        (user_id,),
    ).fetchone()
    if row is None or row["sec"] is None:
        return None
    return float(row["sec"])


def count_recent_posts(conn: Conn, user_id: UUID, *, minutes: int) -> int:
    row = conn.execute(
        """
        select count(*) as n from discotq.video_comments
        where user_id = %s and created_at > now() - make_interval(mins => %s)
        """,
        (user_id, minutes),
    ).fetchone()
    assert row is not None
    return int(row["n"])
