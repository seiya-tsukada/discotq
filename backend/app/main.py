"""DiscoTQ API（FastAPI）。全ルートは /api 配下。"""

from __future__ import annotations

import logging

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.auth import ANONYMOUS_ID_HEADER, CSRF_HEADER, CsrfHeaderMiddleware
from backend.app.config import get_settings
from backend.app.errors import install_error_handlers
from backend.app.routers import admin, auth, health, me, public, uploads

logging.basicConfig(level=logging.INFO)


def create_app() -> FastAPI:
    # 必須の環境変数が無ければここで ValidationError になり、起動に失敗する
    settings = get_settings()

    app = FastAPI(
        title="DiscoTQ API",
        docs_url="/api/docs",
        redoc_url=None,
        openapi_url="/api/openapi.json",
    )
    install_error_handlers(app)

    # ミドルウェアは後に追加したものが外側。CORS を外側にしてプリフライトを先に処理する
    app.add_middleware(CsrfHeaderMiddleware)
    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_credentials=True,
            allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
            allow_headers=["Content-Type", ANONYMOUS_ID_HEADER, CSRF_HEADER],
        )

    api = APIRouter(prefix="/api")
    for r in (health.router, public.router, uploads.router, me.router, admin.router, auth.router):
        api.include_router(r)
    app.include_router(api)
    return app


app = create_app()
