"""DiscoTQ API（FastAPI）。全ルートは /api 配下。"""

from __future__ import annotations

import logging
from urllib.parse import urlsplit

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from backend.app.auth import ANONYMOUS_ID_HEADER, CSRF_HEADER, CsrfHeaderMiddleware
from backend.app.config import Settings, get_settings
from backend.app.errors import install_error_handlers
from backend.app.observability import (
    REQUEST_ID_HEADER,
    RequestLoggingMiddleware,
    configure_logging,
    db_url_warnings,
    describe_db_target,
    describe_settings_error,
)
from backend.app.routers import admin, auth, health, me, public, uploads

configure_logging()
logger = logging.getLogger("discotq.startup")


def load_settings() -> Settings:
    """設定を読み込む。不足・不正があれば原因の環境変数名をログに出して起動を止める。"""
    try:
        settings = get_settings()
    except ValidationError as e:
        logger.critical("config_error 環境変数の設定に問題があるため起動を中止します: %s", describe_settings_error(e))
        raise
    database_url = settings.database_url.get_secret_value()
    logger.info(
        "startup db=%s r2_endpoint=%s r2_buckets=%s,%s email_backend=%s app_base_url=%s",
        describe_db_target(database_url),
        urlsplit(settings.r2_endpoint).hostname,
        settings.r2_bucket_private,
        settings.r2_bucket_public,
        settings.email_backend,
        settings.app_base_url,
    )
    for warning in db_url_warnings(database_url):
        logger.warning("config_warning %s", warning)
    return settings


def create_app() -> FastAPI:
    # 必須の環境変数が無ければここで ValidationError になり、起動に失敗する
    settings = load_settings()

    app = FastAPI(
        title="DiscoTQ API",
        docs_url="/api/docs",
        redoc_url=None,
        openapi_url="/api/openapi.json",
    )
    install_error_handlers(app)

    # ミドルウェアは後に追加したものが外側。
    # CORS（最外）→ リクエストログ → CSRF の順に通る（CSRF で弾いた要求もログに残る）
    app.add_middleware(CsrfHeaderMiddleware)
    app.add_middleware(RequestLoggingMiddleware)
    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_credentials=True,
            allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
            allow_headers=["Content-Type", ANONYMOUS_ID_HEADER, CSRF_HEADER],
            expose_headers=[REQUEST_ID_HEADER],
        )

    api = APIRouter(prefix="/api")
    for r in (health.router, public.router, uploads.router, me.router, admin.router, auth.router):
        api.include_router(r)
    app.include_router(api)
    return app


app = create_app()
