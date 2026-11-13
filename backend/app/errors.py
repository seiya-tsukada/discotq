"""API のエラー表現。レスポンスは ``{"error": {"code": ..., "message": ..., "request_id": ...}}`` に統一する。

外部サービスの障害は種類ごとにコードを分け、原因をログに残す。
* DB に接続できない          → 503 db_unavailable
* DB のエラー（テーブル無し等）→ 500 db_error
* R2（ストレージ）のエラー     → 502 storage_error
* メール送信（Resend）のエラー → 502 email_error
* それ以外の想定外の例外       → 500 internal_error（observability.RequestLoggingMiddleware）
"""

from __future__ import annotations

import logging
from typing import Any

import httpx
import psycopg
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from backend.app.observability import get_request_id

logger = logging.getLogger("discotq.errors")

# init.sql が未適用のときに出る SQLSTATE（スキーマ・テーブル・関数が無い）
MISSING_SCHEMA_SQLSTATES = {"3F000", "42P01", "42883"}


class ApiError(Exception):
    def __init__(self, status_code: int, code: str, message: str, **extra: Any) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.extra = extra


def bad_request(code: str, message: str, **extra: Any) -> ApiError:
    return ApiError(400, code, message, **extra)


def not_found(message: str = "見つかりません") -> ApiError:
    return ApiError(404, "not_found", message)


def conflict(code: str, message: str) -> ApiError:
    return ApiError(409, code, message)


def error_response(
    request: Request, status_code: int, code: str, message: str, **extra: Any
) -> JSONResponse:
    body: dict[str, Any] = {"code": code, "message": message, **extra}
    request_id = get_request_id(request)
    if request_id:
        body["request_id"] = request_id
    return JSONResponse(status_code=status_code, content={"error": body})


def _ctx(request: Request) -> str:
    return f"method={request.method} path={request.url.path} request_id={get_request_id(request)}"


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(request: Request, exc: ApiError) -> JSONResponse:
        # 想定内のエラー（入力不正・権限なし・レート制限など）。原因コードだけ残す
        logger.info("api_error code=%s status=%d %s", exc.code, exc.status_code, _ctx(request))
        return error_response(request, exc.status_code, exc.code, exc.message, **exc.extra)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        details = [
            {"loc": list(e.get("loc", [])), "msg": e.get("msg", "")} for e in exc.errors()
        ]
        logger.info(
            "validation_error fields=%s %s",
            ",".join(".".join(str(p) for p in d["loc"]) for d in details),
            _ctx(request),
        )
        return error_response(
            request, 422, "validation_error", "入力内容に誤りがあります", details=details
        )

    @app.exception_handler(psycopg.OperationalError)
    async def _db_unavailable(request: Request, exc: psycopg.OperationalError) -> JSONResponse:
        # 接続できない・タイムアウト・接続が切れた（libpq のメッセージにパスワードは含まれない）
        logger.error("db_unavailable error=%s %s", _one_line(exc), _ctx(request))
        return error_response(
            request,
            503,
            "db_unavailable",
            "データベースに接続できません。時間をおいて再度お試しください",
        )

    @app.exception_handler(psycopg.Error)
    async def _db_error(request: Request, exc: psycopg.Error) -> JSONResponse:
        sqlstate = exc.sqlstate or "-"
        hint = ""
        if sqlstate in MISSING_SCHEMA_SQLSTATES:
            hint = " hint=discotq スキーマのテーブルがありません。supabase/migration/init.sql を適用してください"
        elif sqlstate == "42501":
            hint = " hint=権限がありません。DB ユーザーの権限（optional_app_role.sql）を確認してください"
        logger.error(
            "db_error sqlstate=%s type=%s error=%s%s %s",
            sqlstate,
            type(exc).__name__,
            _one_line(exc),
            hint,
            _ctx(request),
            exc_info=exc,
        )
        return error_response(request, 500, "db_error", "データベースでエラーが発生しました")

    @app.exception_handler(ClientError)
    async def _storage_client_error(request: Request, exc: ClientError) -> JSONResponse:
        err = exc.response.get("Error", {})
        logger.error(
            "storage_error operation=%s code=%s message=%s %s",
            exc.operation_name,
            err.get("Code"),
            err.get("Message"),
            _ctx(request),
            exc_info=exc,
        )
        return error_response(request, 502, "storage_error", "ストレージとの通信に失敗しました")

    @app.exception_handler(BotoCoreError)
    async def _storage_error(request: Request, exc: BotoCoreError) -> JSONResponse:
        # 接続できない（エンドポイント誤り・ネットワーク）、認証情報が無い など
        logger.error(
            "storage_error type=%s error=%s %s",
            type(exc).__name__,
            _one_line(exc),
            _ctx(request),
            exc_info=exc,
        )
        return error_response(request, 502, "storage_error", "ストレージとの通信に失敗しました")

    @app.exception_handler(httpx.HTTPError)
    async def _email_error(request: Request, exc: httpx.HTTPError) -> JSONResponse:
        # 外部 HTTP 呼び出しはメール送信（Resend）のみ。詳細は email.py でも出力している
        logger.error(
            "email_error type=%s error=%s %s", type(exc).__name__, _one_line(exc), _ctx(request)
        )
        return error_response(request, 502, "email_error", "メールの送信に失敗しました")


def _one_line(exc: BaseException) -> str:
    return " ".join(str(exc).split())[:500]
