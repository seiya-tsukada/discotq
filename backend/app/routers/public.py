from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query, Response

from backend.app.auth import ConnDep
from backend.app.pagination import decode_cursor, encode_cursor
from backend.app.repositories import videos as videos_repo
from backend.app.schemas.videos import FeedItem, FeedResponse

router = APIRouter(tags=["public"])


@router.get("/videos/feed", response_model=FeedResponse)
def feed(
    conn: ConnDep,
    response: Response,
    cursor: str | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
) -> FeedResponse:
    """承認済み動画を新しい順に返す（カーソルページング）。"""
    after = decode_cursor(cursor) if cursor else None
    rows = videos_repo.list_feed(conn, limit=limit + 1, after=after)
    has_more = len(rows) > limit
    rows = rows[:limit]
    items = [
        FeedItem(
            id=r["id"],
            source=r["source"],
            is_pickup=r["picked_up_at"] is not None,
            uploader_name=r["uploader_name"],
            title=r["title"],
            description=r["description"],
            video_url=r["public_url"],
            thumb_url=r["thumb_url"],
            mime_type=r["mime_type"],
            duration_sec=float(r["duration_sec"]) if r["duration_sec"] is not None else None,
            width=r["width"],
            height=r["height"],
            approved_at=r["approved_at"],
            like_count=r["like_count"],
            comment_count=r["comment_count"],
        )
        for r in rows
    ]
    next_cursor = encode_cursor(rows[-1]["approved_at"], rows[-1]["id"]) if has_more and rows else None
    # ブラウザには毎回再検証させ（stale-while-revalidate はブラウザにも効き、承認直後に古い一覧が出るため）、
    # 短時間のキャッシュは Vercel の CDN（CDN-Cache-Control を解釈する）にだけ持たせる
    response.headers["Cache-Control"] = "public, max-age=0, must-revalidate"
    response.headers["CDN-Cache-Control"] = "public, max-age=30, stale-while-revalidate=60"
    return FeedResponse(items=items, next_cursor=next_cursor)
