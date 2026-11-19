"""一覧の「(日時, ID) より前」カーソル。中身は不透明な文字列としてクライアントに渡す。"""

from __future__ import annotations

import base64
import binascii
from datetime import datetime
from uuid import UUID

from backend.app.errors import bad_request


def encode_cursor(at: datetime, row_id: UUID) -> str:
    raw = f"{at.isoformat()}|{row_id}".encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def decode_cursor(cursor: str) -> tuple[datetime, UUID]:
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        ts, rid = base64.urlsafe_b64decode(padded).decode().split("|", 1)
        return datetime.fromisoformat(ts), UUID(rid)
    except (ValueError, binascii.Error, UnicodeDecodeError) as e:
        raise bad_request("invalid_cursor", "cursor が不正です") from e
