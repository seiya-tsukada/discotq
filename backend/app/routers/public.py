from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response

from backend.app.auth import ConnDep, PrincipalDep
from backend.app.repositories.videos import VideoRow
from backend.app.schemas.videos import FeedItem, FeedResponse
from backend.app.services.feed import FeedStrategy, get_feed_strategy

router = APIRouter(tags=["public"])

FeedStrategyDep = Annotated[FeedStrategy, Depends(get_feed_strategy)]


def to_feed_item(r: VideoRow) -> FeedItem:
    return FeedItem(
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


@router.get("/videos/feed", response_model=FeedResponse)
def feed(
    conn: ConnDep,
    response: Response,
    principal: PrincipalDep,
    strategy: FeedStrategyDep,
    cursor: str | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
) -> FeedResponse:
    """承認済み動画をフィード戦略（services/feed.py）の順で返す（カーソルページング）。"""
    page = strategy.fetch_page(conn, viewer=principal, cursor=cursor, limit=limit)
    if strategy.personalized:
        # 閲覧者ごとに違う結果を、CDN で他の人に配らない
        response.headers["Cache-Control"] = "private, no-store"
    else:
        # ブラウザには毎回再検証させ（stale-while-revalidate はブラウザにも効き、承認直後に古い一覧が出るため）、
        # 短時間のキャッシュは Vercel の CDN（CDN-Cache-Control を解釈する）にだけ持たせる
        response.headers["Cache-Control"] = "public, max-age=0, must-revalidate"
        response.headers["CDN-Cache-Control"] = "public, max-age=30, stale-while-revalidate=60"
    return FeedResponse(items=[to_feed_item(r) for r in page.rows], next_cursor=page.next_cursor)
