from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from backend.app.db import Conn

VideoRow = dict[str, Any]


def create_video(
    conn: Conn,
    *,
    video_id: UUID,
    source: str,
    uploader_user_id: UUID | None,
    anonymous_id: UUID | None,
    uploader_ip_hash: str | None,
    title: str,
    description: str,
    storage_provider: str,
    bucket: str,
    object_key: str,
    thumb_key: str | None,
    mime_type: str,
    size_bytes: int,
    duration_sec: float | None,
    width: int | None,
    height: int | None,
    auto_approve: bool,
) -> VideoRow:
    row = conn.execute(
        """
        insert into discotq.videos (
          id, source, uploader_user_id, anonymous_id, uploader_ip_hash, title, description,
          storage_provider, bucket, object_key, thumb_key, mime_type, size_bytes,
          duration_sec, width, height, auto_approve, status
        ) values (
          %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending_upload'
        )
        returning *
        """,
        (
            video_id,
            source,
            uploader_user_id,
            anonymous_id,
            uploader_ip_hash,
            title,
            description,
            storage_provider,
            bucket,
            object_key,
            thumb_key,
            mime_type,
            size_bytes,
            duration_sec,
            width,
            height,
            auto_approve,
        ),
    ).fetchone()
    assert row is not None
    return row


def get_video(conn: Conn, video_id: UUID, *, for_update: bool = False) -> VideoRow | None:
    sql = "select * from discotq.videos where id = %s"
    if for_update:
        sql += " for update"
    return conn.execute(sql, (video_id,)).fetchone()


def update_video(conn: Conn, video_id: UUID, **fields: Any) -> VideoRow:
    if not fields:
        raise ValueError("no fields")
    assignments = ", ".join(f"{name} = %({name})s" for name in fields)
    row = conn.execute(
        f"update discotq.videos set {assignments} where id = %(__id)s returning *",  # noqa: S608
        {**fields, "__id": video_id},
    ).fetchone()
    assert row is not None
    return row


# ---------------------------------------------------------------- rate limit


def lock_uploader(conn: Conn, key: str) -> None:
    """同一投稿者の intent を直列化し、レート制限の同時実行による超過を防ぐ。"""
    conn.execute("select pg_advisory_xact_lock(hashtext(%s))", (f"discotq:upload:{key}",))


def count_recent_uploads(
    conn: Conn,
    *,
    user_id: UUID | None = None,
    anonymous_id: UUID | None = None,
    ip_hash: str | None = None,
    hours: int = 24,
) -> int:
    """直近 N 時間に intent された（= videos 行を作った）ユーザー投稿の件数。"""
    conditions = []
    params: dict[str, Any] = {"hours": hours}
    if user_id is not None:
        conditions.append("uploader_user_id = %(user_id)s")
        params["user_id"] = user_id
    if anonymous_id is not None:
        conditions.append("anonymous_id = %(anonymous_id)s")
        params["anonymous_id"] = anonymous_id
    if ip_hash is not None:
        conditions.append("uploader_ip_hash = %(ip_hash)s")
        params["ip_hash"] = ip_hash
    if not conditions:
        return 0
    row = conn.execute(
        f"""
        select count(*) as n from discotq.videos
        where source = 'user'
          and created_at > now() - make_interval(hours => %(hours)s)
          and ({" and ".join(conditions)})
        """,  # noqa: S608
        params,
    ).fetchone()
    assert row is not None
    return int(row["n"])


# ---------------------------------------------------------------- feed


def list_feed(
    conn: Conn, *, limit: int, after: tuple[datetime, UUID] | None
) -> list[VideoRow]:
    if after is None:
        return conn.execute(
            """
            select * from discotq.videos
            where status = 'approved'
            order by approved_at desc, id desc
            limit %s
            """,
            (limit,),
        ).fetchall()
    return conn.execute(
        """
        select * from discotq.videos
        where status = 'approved' and (approved_at, id) < (%s, %s)
        order by approved_at desc, id desc
        limit %s
        """,
        (after[0], after[1], limit),
    ).fetchall()


# ---------------------------------------------------------------- my videos


def list_owned_videos(
    conn: Conn, *, user_id: UUID | None, anonymous_id: UUID | None, limit: int = 100
) -> list[VideoRow]:
    """自分の投稿。ログイン中はアカウントの投稿 + この端末の未紐づけ匿名投稿を返す。"""
    if user_id is None and anonymous_id is None:
        return []
    return conn.execute(
        """
        select * from discotq.videos
        where source = 'user'
          and status <> 'deleted'
          and (
            (%(user_id)s::uuid is not null and uploader_user_id = %(user_id)s)
            or (%(anon)s::uuid is not null and anonymous_id = %(anon)s and uploader_user_id is null)
          )
        order by created_at desc
        limit %(limit)s
        """,
        {"user_id": user_id, "anon": anonymous_id, "limit": limit},
    ).fetchall()


def count_claimable(conn: Conn, anonymous_id: UUID) -> int:
    row = conn.execute(
        """
        select count(*) as n from discotq.videos
        where source = 'user' and anonymous_id = %s and uploader_user_id is null
          and status <> 'deleted'
        """,
        (anonymous_id,),
    ).fetchone()
    assert row is not None
    return int(row["n"])


def claim_anonymous_videos(conn: Conn, *, anonymous_id: UUID, user_id: UUID) -> list[UUID]:
    rows = conn.execute(
        """
        update discotq.videos set uploader_user_id = %s
        where source = 'user' and anonymous_id = %s and uploader_user_id is null
          and status <> 'deleted'
        returning id
        """,
        (user_id, anonymous_id),
    ).fetchall()
    return [r["id"] for r in rows]


# ---------------------------------------------------------------- admin


def list_admin_videos(
    conn: Conn,
    *,
    status: str | None,
    source: str | None,
    limit: int,
    offset: int,
) -> list[VideoRow]:
    # 審査キュー（in_review）は古い順、それ以外は更新が新しい順
    order = "v.created_at asc, v.id asc" if status == "in_review" else "v.updated_at desc, v.id desc"
    return conn.execute(
        f"""
        select v.*, u.email as uploader_email, ab.email as approved_by_email
        from discotq.videos v
        left join discotq.users u on u.id = v.uploader_user_id
        left join discotq.users ab on ab.id = v.approved_by
        where (%(status)s::text is null or v.status = %(status)s)
          and (%(source)s::text is null or v.source = %(source)s)
        order by {order}
        limit %(limit)s offset %(offset)s
        """,  # noqa: S608
        {"status": status, "source": source, "limit": limit, "offset": offset},
    ).fetchall()


def status_counts(conn: Conn) -> dict[str, int]:
    rows = conn.execute(
        "select status, count(*) as n from discotq.videos group by status"
    ).fetchall()
    return {r["status"]: int(r["n"]) for r in rows}


def oldest_in_review_at(conn: Conn) -> datetime | None:
    row = conn.execute(
        "select min(created_at) as t from discotq.videos where status = 'in_review'"
    ).fetchone()
    return row["t"] if row else None


def insert_review(
    conn: Conn, *, video_id: UUID, reviewer_id: UUID | None, action: str, reason: str | None
) -> None:
    conn.execute(
        """
        insert into discotq.video_reviews (video_id, reviewer_id, action, reason)
        values (%s, %s, %s, %s)
        """,
        (video_id, reviewer_id, action, reason),
    )


def list_reviews(conn: Conn, video_id: UUID) -> list[VideoRow]:
    return conn.execute(
        """
        select r.*, u.email as reviewer_email
        from discotq.video_reviews r
        left join discotq.users u on u.id = r.reviewer_id
        where r.video_id = %s
        order by r.created_at
        """,
        (video_id,),
    ).fetchall()


def get_admin_video(conn: Conn, video_id: UUID) -> VideoRow | None:
    return conn.execute(
        """
        select v.*, u.email as uploader_email, ab.email as approved_by_email
        from discotq.videos v
        left join discotq.users u on u.id = v.uploader_user_id
        left join discotq.users ab on ab.id = v.approved_by
        where v.id = %s
        """,
        (video_id,),
    ).fetchone()
