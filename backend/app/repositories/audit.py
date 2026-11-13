from __future__ import annotations

from typing import Any, Literal

from psycopg.types.json import Jsonb

from backend.app.db import Conn

ActorType = Literal["user", "anonymous", "admin", "system"]


def write_audit_log(
    conn: Conn,
    *,
    actor_type: ActorType,
    actor_id: str | None,
    action: str,
    target_type: str,
    target_id: str | None,
    payload: dict[str, Any] | None = None,
) -> None:
    conn.execute(
        """
        insert into discotq.audit_logs (actor_id, actor_type, action, target_type, target_id, payload)
        values (%s, %s, %s, %s, %s, %s)
        """,
        (actor_id, actor_type, action, target_type, target_id, Jsonb(payload or {})),
    )
