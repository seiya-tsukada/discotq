"""Vercel の Python サーバーレス関数のエントリポイント。

vercel.json の rewrites で /api/* をこの関数に集約し、FastAPI 側でルーティングする。
"""

from backend.app.main import app

__all__ = ["app"]
