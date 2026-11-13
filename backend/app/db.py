"""Supabase Postgres への接続。

Vercel のサーバーレス関数から接続するため、Supabase の transaction pooler（ポート 6543）を使う。
transaction pooler は prepared statement を扱えないので ``prepare_threshold=None`` で無効化する。
リクエストごとに 1 接続を開き、正常終了で commit、例外で rollback する。
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from typing import Any

import psycopg
from psycopg.rows import dict_row

from backend.app.config import get_settings
from backend.app.observability import describe_db_target

logger = logging.getLogger("discotq.db")

Conn = psycopg.Connection[dict[str, Any]]


def connect(database_url: str | None = None, *, timeout_s: int = 10) -> Conn:
    url = database_url or get_settings().database_url.get_secret_value()
    try:
        return psycopg.connect(
            url, prepare_threshold=None, row_factory=dict_row, connect_timeout=timeout_s
        )
    except psycopg.OperationalError as e:
        logger.error(
            "db_connect_failed target=%s error=%s",
            describe_db_target(url),
            " ".join(str(e).split())[:500],
        )
        raise


def ping(timeout_s: int = 3) -> None:
    """DB に到達できるかを素早く確認する。到達できなければ例外を送出する。

    短い接続・ステートメントのタイムアウト付きで、READ ONLY トランザクション内で ``select 1``
    を実行する。待ち続けることもデータを変更することもない。
    """
    timeout_s = int(timeout_s)
    with connect(timeout_s=timeout_s) as conn:
        conn.read_only = True
        conn.execute(f"set local statement_timeout = '{timeout_s}s'")
        conn.execute("select 1").fetchone()


def get_conn() -> Iterator[Conn]:
    """FastAPI 依存関数。例外が伝播した場合は rollback される。"""
    with connect() as conn:
        yield conn
