from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

UserLevel = Literal["ブロンズ", "シルバー", "ゴールド", "VIP"]
LedgerKind = Literal["watch", "welcome", "guest_transfer_out", "exchange", "adjustment"]


class RewardSummary(BaseModel):
    # user: ログイン中のアカウント / anonymous: 端末の匿名 ID に貯まっている受取待ちの分
    owner: Literal["user", "anonymous"]
    balance: int
    total_earned: int
    level: UserLevel


class MyRewardsResponse(RewardSummary):
    # 受取済みの動画 ID（新しい順）
    claimed_video_ids: list[UUID]


class StartViewResponse(BaseModel):
    view_session_id: UUID
    min_watch_seconds: int
    reward_points: int
    already_claimed: bool
    # 自分が投稿した動画など、受け取れない動画なら false
    reward_eligible: bool


class ClaimRewardResponse(BaseModel):
    earned: bool
    points: int
    video_id: UUID
    summary: RewardSummary


class LedgerEntry(BaseModel):
    id: UUID
    kind: LedgerKind
    points: int
    title: str
    video_id: UUID | None
    gift_id: str | None
    gift_code: str | None
    created_at: datetime


class RewardHistoryResponse(BaseModel):
    items: list[LedgerEntry]
    next_cursor: str | None


class ActivateRewardsResponse(BaseModel):
    transferred_points: int
    welcome_points: int
    summary: RewardSummary


class Gift(BaseModel):
    id: str
    name: str
    brand: str
    points_cost: int
    icon_url: str
    category: str
    stock: int
    popular: bool
    value_description: str


class GiftsResponse(BaseModel):
    items: list[Gift]


class ExchangeRequest(BaseModel):
    gift_id: str
    # 再送で二重に引き落とさないためのキー（クライアントが交換ボタンを押すたびに作る）
    idempotency_key: UUID


class ExchangeResponse(BaseModel):
    gift: Gift
    code: str
    summary: RewardSummary
