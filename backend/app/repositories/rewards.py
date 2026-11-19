"""視聴リワード（view_sessions / point_ledger）。

point_ledger は追記専用で、残高は ``sum(points)`` で求める。行の更新・削除はしない。
本人は engagement と同じ ``Owner``（user_id か anonymous_id のどちらか一方）で表す。
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from backend.app.db import Conn
from backend.app.repositories.engagement import Owner

Row = dict[str, Any]

# 受取済みの動画 ID として返す上限（新しい順）
CLAIMED_VIDEO_IDS_LIMIT = 1000


def lock_owner(conn: Conn, owner: Owner) -> None:
    """同じ本人の受取・引き継ぎ・交換をトランザクション終了まで直列化する。"""
    conn.execute(
        "select pg_advisory_xact_lock(hashtext(%s))",
        (f"discotq:rewards:{owner.column}:{owner.value}",),
    )


# ---------------------------------------------------------------- view_sessions


def create_view_session(
    conn: Conn,
    *,
    video_id: UUID,
    owner: Owner,
    min_watch_seconds: int,
    ip_hash: str | None,
    user_agent: str | None,
) -> Row:
    row = conn.execute(
        f"""
        insert into discotq.view_sessions
          (video_id, {owner.column}, min_watch_seconds, ip_hash, user_agent)
        values (%s, %s, %s, %s, %s)
        returning *
        """,
        (video_id, owner.value, min_watch_seconds, ip_hash, (user_agent or "")[:500] or None),
    ).fetchone()
    assert row is not None
    return row


def get_view_session_for_update(conn: Conn, session_id: UUID) -> Row | None:
    """セッションと、サーバーの時計で測った開始からの経過秒数（elapsed_sec）を返す。"""
    return conn.execute(
        """
        select s.*, extract(epoch from now() - s.started_at)::float as elapsed_sec
        from discotq.view_sessions s
        where s.id = %s
        for update
        """,
        (session_id,),
    ).fetchone()


def mark_view_session_claimed(conn: Conn, session_id: UUID) -> None:
    conn.execute(
        "update discotq.view_sessions set claimed_at = now() where id = %s and claimed_at is null",
        (session_id,),
    )


def count_recent_view_sessions(
    conn: Conn, *, owner: Owner | None = None, ip_hash: str | None = None, minutes: int
) -> int:
    value: Any
    if owner is not None:
        where, value = f"{owner.column} = %s", owner.value
    elif ip_hash is not None:
        where, value = "ip_hash = %s", ip_hash
    else:
        raise ValueError("owner か ip_hash を指定する")
    row = conn.execute(
        f"""
        select count(*) as n from discotq.view_sessions
        where {where} and started_at > now() - make_interval(mins => %s)
        """,
        (value, minutes),
    ).fetchone()
    assert row is not None
    return int(row["n"])


def count_recent_claims(
    conn: Conn, *, owner: Owner | None = None, ip_hash: str | None = None, minutes: int
) -> int:
    """直近の受取件数。IP は匿名での受取に使った view_sessions の ip_hash で数える。"""
    if owner is not None:
        sql = f"""
            select count(*) as n from discotq.point_ledger
            where {owner.column} = %s and kind = 'watch'
              and transferred_from_anonymous_id is null
              and created_at > now() - make_interval(mins => %s)
        """
        params: tuple[Any, ...] = (owner.value, minutes)
    elif ip_hash is not None:
        sql = """
            select count(*) as n from discotq.view_sessions
            where ip_hash = %s and anonymous_id is not null
              and claimed_at > now() - make_interval(mins => %s)
        """
        params = (ip_hash, minutes)
    else:
        raise ValueError("owner か ip_hash を指定する")
    row = conn.execute(sql, params).fetchone()
    assert row is not None
    return int(row["n"])


# ---------------------------------------------------------------- point_ledger


def insert_watch_reward(
    conn: Conn,
    *,
    owner: Owner,
    video_id: UUID,
    view_session_id: UUID,
    points: int,
    title: str,
) -> bool:
    """視聴リワードを追加する。この動画で受取済みなら何もせず False を返す。"""
    col = owner.column
    row = conn.execute(
        f"""
        insert into discotq.point_ledger
          ({col}, kind, points, title, video_id, view_session_id, created_at)
        values (%s, 'watch', %s, %s, %s, %s, clock_timestamp())
        on conflict ({col}, video_id) where kind = 'watch' and {col} is not null do nothing
        returning id
        """,
        (owner.value, points, title, video_id, view_session_id),
    ).fetchone()
    return row is not None


def transfer_guest_watch_rewards(conn: Conn, *, user_id: UUID, anonymous_id: UUID) -> int:
    """匿名 ID の視聴リワードのうち、前回の引き継ぎより後のものを動画ごとにユーザーの watch 行として写す。

    ユーザーが受取済みの動画は写さない。匿名側には残高と同じ額の guest_transfer_out（マイナス）を入れて
    0 にする（写せなかった分は二重にならないよう捨てる）。写した合計を返す。
    呼び出し側で匿名側の ``lock_owner`` を取っておくこと。
    """
    anon = Owner(user_id=None, anonymous_id=anonymous_id)
    pooled = balance_of(conn, anon)
    if pooled <= 0:
        return 0
    rows = conn.execute(
        """
        with last_out as (
          select max(created_at) as at from discotq.point_ledger
          where anonymous_id = %(anon)s and kind = 'guest_transfer_out'
        )
        insert into discotq.point_ledger
          (user_id, kind, points, title, video_id, transferred_from_anonymous_id)
        select %(user)s, 'watch', a.points, a.title, a.video_id, a.anonymous_id
        from discotq.point_ledger a, last_out
        where a.anonymous_id = %(anon)s and a.kind = 'watch' and a.video_id is not null
          and (last_out.at is null or a.created_at > last_out.at)
        order by a.created_at, a.id
        on conflict (user_id, video_id) where kind = 'watch' and user_id is not null do nothing
        returning points
        """,
        {"anon": anonymous_id, "user": user_id},
    ).fetchall()
    conn.execute(
        """
        insert into discotq.point_ledger (anonymous_id, kind, points, title, created_at)
        values (%s, 'guest_transfer_out', %s, 'アカウントへ引き継ぎ', clock_timestamp())
        """,
        (anonymous_id, -pooled),
    )
    return sum(int(r["points"]) for r in rows)


def insert_welcome_bonus(conn: Conn, *, user_id: UUID, points: int, title: str) -> bool:
    row = conn.execute(
        """
        insert into discotq.point_ledger (user_id, kind, points, title)
        values (%s, 'welcome', %s, %s)
        on conflict (user_id) where kind = 'welcome' do nothing
        returning id
        """,
        (user_id, points, title),
    ).fetchone()
    return row is not None


def has_any_entry(conn: Conn, user_id: UUID) -> bool:
    row = conn.execute(
        "select 1 from discotq.point_ledger where user_id = %s limit 1", (user_id,)
    ).fetchone()
    return row is not None


def find_exchange(conn: Conn, *, user_id: UUID, idempotency_key: UUID) -> Row | None:
    return conn.execute(
        """
        select * from discotq.point_ledger
        where user_id = %s and kind = 'exchange' and idempotency_key = %s
        """,
        (user_id, idempotency_key),
    ).fetchone()


def insert_exchange(
    conn: Conn,
    *,
    user_id: UUID,
    points: int,
    title: str,
    gift_id: str,
    gift_code: str,
    idempotency_key: UUID,
) -> Row:
    row = conn.execute(
        """
        insert into discotq.point_ledger
          (user_id, kind, points, title, gift_id, gift_code, idempotency_key)
        values (%s, 'exchange', %s, %s, %s, %s, %s)
        returning *
        """,
        (user_id, -points, title, gift_id, gift_code, idempotency_key),
    ).fetchone()
    assert row is not None
    return row


def count_recent_exchanges(conn: Conn, user_id: UUID, *, minutes: int) -> int:
    row = conn.execute(
        """
        select count(*) as n from discotq.point_ledger
        where user_id = %s and kind = 'exchange' and created_at > now() - make_interval(mins => %s)
        """,
        (user_id, minutes),
    ).fetchone()
    assert row is not None
    return int(row["n"])


def balance_of(conn: Conn, owner: Owner) -> int:
    row = conn.execute(
        f"select coalesce(sum(points), 0) as n from discotq.point_ledger where {owner.column} = %s",
        (owner.value,),
    ).fetchone()
    assert row is not None
    return int(row["n"])


def summary_of(conn: Conn, owner: Owner) -> tuple[int, int]:
    """(残高, 累計獲得)。累計獲得は watch / welcome / プラスの adjustment の合計。"""
    row = conn.execute(
        f"""
        select coalesce(sum(points), 0) as balance,
               coalesce(sum(points) filter (
                 where kind in ('watch', 'welcome') or (kind = 'adjustment' and points > 0)
               ), 0) as total_earned
        from discotq.point_ledger where {owner.column} = %s
        """,
        (owner.value,),
    ).fetchone()
    assert row is not None
    return int(row["balance"]), int(row["total_earned"])


def claimed_video_ids(conn: Conn, owner: Owner) -> list[UUID]:
    rows = conn.execute(
        f"""
        select video_id from discotq.point_ledger
        where {owner.column} = %s and kind = 'watch' and video_id is not null
        order by created_at desc, id desc
        limit %s
        """,
        (owner.value, CLAIMED_VIDEO_IDS_LIMIT),
    ).fetchall()
    return [r["video_id"] for r in rows]


def list_history(
    conn: Conn, owner: Owner, *, limit: int, after: tuple[datetime, UUID] | None
) -> list[Row]:
    params: list[Any] = [owner.value]
    cursor_sql = ""
    if after is not None:
        cursor_sql = "and (created_at, id) < (%s, %s)"
        params += [after[0], after[1]]
    params.append(limit)
    return conn.execute(
        f"""
        select id, kind, points, title, video_id, gift_id, gift_code, created_at
        from discotq.point_ledger
        where {owner.column} = %s {cursor_sql}
        order by created_at desc, id desc
        limit %s
        """,
        params,
    ).fetchall()
