"""視聴リワード。

* 視聴開始 → 受取: ``POST /videos/{id}/views`` で開始を記録し、``POST /views/{id}/claim`` で受け取る。
  最低視聴時間はサーバーの時計で確かめる（services/rewards.py）
* 未ログインは X-Anonymous-Id に貯まり、ログイン後の ``POST /me/rewards/activate`` でアカウントに引き継ぐ
* ギフト交換はメール確認済みのログインユーザーだけ
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query, Request

from backend.app.auth import ConnDep, PrincipalDep, UserDep, VerifiedUserDep
from backend.app.pagination import decode_cursor, encode_cursor
from backend.app.repositories import rewards as rewards_repo
from backend.app.repositories.engagement import Owner
from backend.app.routers.engagement import owner_of
from backend.app.schemas.rewards import (
    ActivateRewardsResponse,
    ClaimRewardResponse,
    ExchangeRequest,
    ExchangeResponse,
    GiftsResponse,
    LedgerEntry,
    MyRewardsResponse,
    RewardHistoryResponse,
    StartViewResponse,
)
from backend.app.services import rewards as reward_service

router = APIRouter(tags=["rewards"])


@router.post("/videos/{video_id}/views", response_model=StartViewResponse, status_code=201)
def start_view(
    video_id: UUID, request: Request, conn: ConnDep, principal: PrincipalDep
) -> StartViewResponse:
    return reward_service.start_view(
        conn, principal, video_id, user_agent=request.headers.get("user-agent")
    )


@router.post("/views/{view_session_id}/claim", response_model=ClaimRewardResponse)
def claim(view_session_id: UUID, conn: ConnDep, principal: PrincipalDep) -> ClaimRewardResponse:
    return reward_service.claim(conn, principal, view_session_id)


@router.get("/me/rewards", response_model=MyRewardsResponse)
def my_rewards(conn: ConnDep, principal: PrincipalDep) -> MyRewardsResponse:
    """残高と受取済みの動画。本人が特定できなければ 0 を返す。"""
    if principal.user is None and principal.anonymous_id is None:
        return MyRewardsResponse(
            owner="anonymous", balance=0, total_earned=0, level="ブロンズ", claimed_video_ids=[]
        )
    owner = owner_of(principal)
    summary = reward_service.summary_for(conn, owner)
    return MyRewardsResponse(
        **summary.model_dump(), claimed_video_ids=rewards_repo.claimed_video_ids(conn, owner)
    )


@router.get("/me/rewards/history", response_model=RewardHistoryResponse)
def my_reward_history(
    conn: ConnDep,
    principal: PrincipalDep,
    cursor: str | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> RewardHistoryResponse:
    owner: Owner = owner_of(principal)
    after = decode_cursor(cursor) if cursor else None
    rows = rewards_repo.list_history(conn, owner, limit=limit + 1, after=after)
    has_more = len(rows) > limit
    rows = rows[:limit]
    return RewardHistoryResponse(
        items=[LedgerEntry(**r) for r in rows],
        next_cursor=encode_cursor(rows[-1]["created_at"], rows[-1]["id"]) if has_more and rows else None,
    )


@router.post("/me/rewards/activate", response_model=ActivateRewardsResponse)
def activate(conn: ConnDep, user: UserDep, principal: PrincipalDep) -> ActivateRewardsResponse:
    return reward_service.activate(conn, user, principal.anonymous_id)


@router.get("/rewards/gifts", response_model=GiftsResponse)
def gifts() -> GiftsResponse:
    return GiftsResponse(items=reward_service.GIFTS)


@router.post("/me/rewards/exchange", response_model=ExchangeResponse)
def exchange(
    req: ExchangeRequest, conn: ConnDep, user: VerifiedUserDep, principal: PrincipalDep
) -> ExchangeResponse:
    return reward_service.exchange(
        conn,
        user,
        gift_id=req.gift_id,
        idempotency_key=req.idempotency_key,
        ip_hash=principal.ip_hash,
    )
