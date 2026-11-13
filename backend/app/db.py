"""Supabase Postgres への接続。

Vercel のサーバーレス関数から接続するため、Supabase の transaction pooler（ポート 6543）を使う。
transaction pooler は prepared statement を扱えないので ``prepare_threshold=None`` で無効化する。
リクエストごとに 1 接続を開き、正常終了で commit、例外で rollback する。
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import psycopg
from psycopg.rows import dict_row

from backend.app.config import get_settings

Conn = psycopg.Connection[dict[str, Any]]


def connect(database_url: str | None = None) -> Conn:
    url = database_url or get_settings().database_url.get_secret_value()
    return psycopg.connect(url, prepare_threshold=None, row_factory=dict_row, connect_timeout=10)


def get_conn() -> Iterator[Conn]:
    """FastAPI 依存関数。例外が伝播した場合は rollback される。"""
    with connect() as conn:
        yield conn
