"""init.sql を既存 DB に流し直しても壊れず、データも残ることを確かめる。"""

from __future__ import annotations

from backend.app.db import Conn
from backend.tests.conftest import ROOT, requires_db

pytestmark = requires_db

SQL = (ROOT / "supabase/migration/init.sql").read_text()


def test_init_sql_can_be_applied_again(db: Conn) -> None:
    db.execute(
        "insert into discotq.users (email, password_hash) values ('keep@example.com', 'x')"
    )
    db.execute(SQL)
    db.execute(SQL)
    row = db.execute("select count(*) as n from discotq.users").fetchone()
    assert row is not None and row["n"] == 1


def test_comment_constraints_are_not_duplicated(db: Conn) -> None:
    db.execute(SQL)
    rows = db.execute(
        """
        select conname from pg_constraint
        where conrelid = 'discotq.video_comments'::regclass and contype = 'c'
        order by conname
        """
    ).fetchall()
    assert [r["conname"] for r in rows] == ["video_comments_body_len", "video_comments_deleted_chk"]


def test_comment_constraints_are_added_to_an_older_table(db: Conn) -> None:
    """制約の無い形で先にテーブルがあっても、流し直せば制約が付く。"""
    db.execute("alter table discotq.video_comments drop constraint video_comments_body_len")
    db.execute(SQL)
    row = db.execute(
        """
        select count(*) as n from pg_constraint
        where conrelid = 'discotq.video_comments'::regclass and conname = 'video_comments_body_len'
        """
    ).fetchone()
    assert row is not None and row["n"] == 1
