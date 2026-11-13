"""ログ出力（Vercel の Function ログで障害の原因を追えるようにする）。

方針:
* 1 リクエスト 1 行のアクセスログ（メソッド・パス・ステータス・所要時間・リクエストID）
* リクエストID は Vercel が付ける ``x-vercel-id`` を使い、レスポンスの ``X-Request-Id`` と
  エラー応答の ``request_id`` に載せる（画面に出た ID でログを検索できる）
* 想定外の例外はスタックトレース付きでログに出し、利用者には JSON の 500 を返す
* 秘密情報（パスワード・トークン・DATABASE_URL の値）、メールアドレス、生の IP はログに出さない
"""

from __future__ import annotations

import logging
import os
import time
import uuid
from urllib.parse import urlsplit

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

logger = logging.getLogger("discotq")
access_logger = logging.getLogger("discotq.access")

REQUEST_ID_HEADER = "X-Request-Id"
SUPABASE_TRANSACTION_POOLER_PORT = 6543


def configure_logging() -> None:
    """ログレベルと書式を設定する（LOG_LEVEL で変更可、既定 INFO）。

    Vercel は標準出力・標準エラーを Function ログとして収集し、時刻も付与する。
    """
    level = os.environ.get("LOG_LEVEL", "INFO").upper()
    root = logging.getLogger()
    if not root.handlers:
        logging.basicConfig(format="%(levelname)s [%(name)s] %(message)s")
    root.setLevel(level)
    logging.getLogger("discotq").setLevel(level)


def get_request_id(request: Request) -> str | None:
    rid = getattr(request.state, "request_id", None)
    return rid if isinstance(rid, str) else None


# ---------------------------------------------------------------- 起動時


def describe_settings_error(error: ValidationError) -> str:
    """設定エラーを「環境変数名: 理由」の一覧にする（値は出さない）。"""
    problems = []
    for e in error.errors(include_input=False, include_url=False):
        loc = e.get("loc") or ()
        name = str(loc[0]).upper() if loc else "(設定全体)"
        msg = e.get("msg", "")
        if e.get("type") == "missing":
            msg = "未設定"
        problems.append(f"{name}: {msg}")
    return "; ".join(problems)


def describe_db_target(database_url: str) -> str:
    """接続先をパスワード抜きで表す（例: postgres.abc@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres）。"""
    try:
        u = urlsplit(database_url)
        user = u.username or "?"
        host = u.hostname or "?"
        port = u.port or 5432
        db = (u.path or "/").lstrip("/") or "?"
        return f"{user}@{host}:{port}/{db}"
    except ValueError:
        return "(DATABASE_URL を解析できません)"


def db_url_warnings(database_url: str) -> list[str]:
    """Vercel から Supabase に接続する際によくある設定ミスを検出する。"""
    warnings: list[str] = []
    try:
        u = urlsplit(database_url)
        host = u.hostname or ""
        port = u.port
    except ValueError:
        return ["DATABASE_URL の形式が正しくありません"]
    if u.scheme not in ("postgres", "postgresql"):
        warnings.append(f"DATABASE_URL のスキームが postgresql ではありません（{u.scheme or '空'}）")
    if host.startswith("db.") and host.endswith(".supabase.co"):
        warnings.append(
            "DATABASE_URL が Supabase の直接接続（db.<ref>.supabase.co）です。"
            "直接接続は IPv6 のみのため Vercel から接続できないことがあります。"
            "Transaction pooler（*.pooler.supabase.com:6543）の接続文字列を使ってください"
        )
    elif "pooler.supabase.com" in host and port != SUPABASE_TRANSACTION_POOLER_PORT:
        warnings.append(
            f"DATABASE_URL のポートが {port} です。サーバーレスでは Transaction pooler（6543）を使ってください"
        )
    if "pooler.supabase.com" in host and "." not in (u.username or ""):
        warnings.append(
            "Supabase の pooler では、ユーザー名を <ユーザー名>.<project-ref>（例: postgres.abcdefgh）にする必要があります"
        )
    return warnings


# ---------------------------------------------------------------- リクエスト


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = request.headers.get("x-vercel-id") or uuid.uuid4().hex[:16]
        request.state.request_id = request_id
        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            elapsed = (time.perf_counter() - started) * 1000
            logger.exception(
                "unhandled_error method=%s path=%s request_id=%s elapsed_ms=%.0f",
                request.method,
                request.url.path,
                request_id,
                elapsed,
            )
            response = JSONResponse(
                status_code=500,
                content={
                    "error": {
                        "code": "internal_error",
                        "message": "サーバーでエラーが発生しました",
                        "request_id": request_id,
                    }
                },
            )
        elapsed = (time.perf_counter() - started) * 1000
        status = response.status_code
        level = logging.ERROR if status >= 500 else logging.WARNING if status >= 400 else logging.INFO
        access_logger.log(
            level,
            "%s %s -> %d (%.0fms) request_id=%s",
            request.method,
            request.url.path,
            status,
            elapsed,
            request_id,
        )
        response.headers[REQUEST_ID_HEADER] = request_id
        return response
