"""視聴リワードの付与・ゲスト分の引き継ぎ・ギフト交換。

* 受取の検証はサーバーの時計で行う。視聴開始（view_sessions）から min_watch_seconds 以上経っていれば
  受け取れる。クライアントから受け取るのは「開始した」「終わった」の 2 回の申告だけで、
  経過時間・付与ポイント・動画の長さはすべてサーバーの値を使う
* 二重付与は point_ledger の一意制約で防ぐ（ユーザー×動画 / 匿名ID×動画）
* 未ログインの分は匿名 ID に貯まり、ログイン時に動画ごとにアカウントへ写す
* 同じ本人の受取・引き継ぎ・交換は advisory lock で直列化し、残高がマイナスにならないようにする
"""

from __future__ import annotations

import math
import secrets
from typing import Any
from uuid import UUID

from backend.app.auth import CurrentUser, Principal
from backend.app.db import Conn
from backend.app.errors import ApiError, not_found
from backend.app.repositories import rewards as rewards_repo
from backend.app.repositories import videos as videos_repo
from backend.app.repositories.audit import write_audit_log
from backend.app.repositories.engagement import Owner
from backend.app.routers.engagement import owner_of
from backend.app.schemas.rewards import (
    ActivateRewardsResponse,
    ClaimRewardResponse,
    ExchangeResponse,
    Gift,
    RewardSummary,
    StartViewResponse,
    UserLevel,
)

# 動画 1 本の視聴リワード（動画ごとの設定は持たないため一律）
WATCH_REWARD_POINTS = 10
WELCOME_BONUS_POINTS = 30
# 受取に必要な最低視聴秒数（動画がこれより短い場合は動画の長さ。最低 1 秒）
DEFAULT_MIN_WATCH_SECONDS = 5
# 視聴開始からこれ以上経ったセッションでは受け取れない
VIEW_SESSION_TTL_SEC = 30 * 60

# レート制限
VIEW_START_HOURLY_LIMIT = 300  # 本人ごと
VIEW_START_HOURLY_LIMIT_PER_IP = 600
USER_CLAIM_HOURLY_LIMIT = 60
USER_CLAIM_DAILY_LIMIT = 300
ANON_CLAIM_DAILY_LIMIT = 100  # 匿名 ID ごと
ANON_CLAIM_DAILY_LIMIT_PER_IP = 300  # 匿名 ID を作り直しての荒稼ぎ対策
EXCHANGE_DAILY_LIMIT = 10

# 累計獲得ポイントによるレベル（上から順に評価）
LEVEL_THRESHOLDS: list[tuple[int, UserLevel]] = [(2000, "VIP"), (800, "ゴールド"), (300, "シルバー")]

GIFT_CODE_PREFIX = "DISCOTQ"
_GIFT_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # 見間違えやすい 0/O/1/I は使わない

# ポイント交換所に並べるギフト（デモ用の固定データ。在庫は表示用で減らさない）
GIFTS: list[Gift] = [
    Gift(
        id="gift-1",
        name="Amazon ギフトカード 500円分",
        brand="Amazon",
        points_cost=500,
        icon_url="https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=200&auto=format&fit=crop&q=80",
        category="ギフトカード",
        stock=999,
        popular=True,
        value_description="お買い物にすぐ使える公式デジタルコード",
    ),
    Gift(
        id="gift-2",
        name="PayPayマネーライト 500円分",
        brand="PayPay",
        points_cost=500,
        icon_url="https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=200&auto=format&fit=crop&q=80",
        category="電子マネー",
        stock=999,
        popular=True,
        value_description="全国のコンビニ・飲食店で利用可能",
    ),
    Gift(
        id="gift-3",
        name="Starbucks eGift 500円分",
        brand="Starbucks",
        points_cost=500,
        icon_url="https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=200&auto=format&fit=crop&q=80",
        category="カフェ・ドリンク",
        stock=450,
        popular=True,
        value_description="お好きなドリンク1杯と交換できるデジタルチケット",
    ),
    Gift(
        id="gift-4",
        name="Apple Gift Card 1,000円分",
        brand="Apple",
        points_cost=1000,
        icon_url="https://images.unsplash.com/photo-1616469829941-c7200edec809?w=200&auto=format&fit=crop&q=80",
        category="ギフトカード",
        stock=300,
        popular=False,
        value_description="App Storeや各種サービス利用に",
    ),
    Gift(
        id="gift-5",
        name="QUOカードPay 300円分",
        brand="QUOカードPay",
        points_cost=300,
        icon_url="https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=200&auto=format&fit=crop&q=80",
        category="電子マネー",
        stock=1200,
        popular=True,
        value_description="アプリ不要でバーコードですぐ使えるデジタルギフト",
    ),
    Gift(
        id="gift-6",
        name="楽天ポイント 1,000pt",
        brand="楽天",
        points_cost=1000,
        icon_url="https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=200&auto=format&fit=crop&q=80",
        category="ポイント",
        stock=800,
        popular=False,
        value_description="楽天市場や提携実店舗で使える共通ポイント",
    ),
]
_GIFTS_BY_ID = {g.id: g for g in GIFTS}


def level_for(total_earned: int) -> UserLevel:
    return next((lv for th, lv in LEVEL_THRESHOLDS if total_earned >= th), "ブロンズ")


def min_watch_seconds_for(duration_sec: Any) -> int:
    if duration_sec is None or float(duration_sec) <= 0:
        return DEFAULT_MIN_WATCH_SECONDS
    return min(DEFAULT_MIN_WATCH_SECONDS, max(1, math.floor(float(duration_sec))))


def _code_block() -> str:
    return "".join(secrets.choice(_GIFT_CODE_ALPHABET) for _ in range(4))


def generate_gift_code() -> str:
    return f"{GIFT_CODE_PREFIX}-{_code_block()}-{_code_block()}-{_code_block()}"


def summary_for(conn: Conn, owner: Owner) -> RewardSummary:
    balance, total = rewards_repo.summary_of(conn, owner)
    return RewardSummary(
        owner="user" if owner.user_id is not None else "anonymous",
        balance=balance,
        total_earned=total,
        level=level_for(total),
    )


def _rate_limited(message: str, **extra: Any) -> ApiError:
    return ApiError(429, "rate_limited", message, **extra)


def _is_own_video(video: dict[str, Any], owner: Owner) -> bool:
    if owner.user_id is not None:
        return bool(video["uploader_user_id"] == owner.user_id)
    return bool(video["anonymous_id"] is not None and video["anonymous_id"] == owner.anonymous_id)


def _require_approved_video(conn: Conn, video_id: UUID) -> dict[str, Any]:
    video = videos_repo.get_video(conn, video_id)
    if video is None or video["status"] != "approved":
        raise not_found("動画が見つかりません")
    return video


# ---------------------------------------------------------------- 視聴開始・受取


def start_view(
    conn: Conn, principal: Principal, video_id: UUID, *, user_agent: str | None
) -> StartViewResponse:
    owner = owner_of(principal)
    video = _require_approved_video(conn, video_id)
    if rewards_repo.count_recent_view_sessions(conn, owner=owner, minutes=60) >= VIEW_START_HOURLY_LIMIT:
        raise _rate_limited("短時間に多くの動画を開いています。時間をおいて再度お試しください")
    if (
        principal.ip_hash
        and rewards_repo.count_recent_view_sessions(conn, ip_hash=principal.ip_hash, minutes=60)
        >= VIEW_START_HOURLY_LIMIT_PER_IP
    ):
        raise _rate_limited("短時間に多くの動画を開いています。時間をおいて再度お試しください")
    session = rewards_repo.create_view_session(
        conn,
        video_id=video_id,
        owner=owner,
        min_watch_seconds=min_watch_seconds_for(video["duration_sec"]),
        ip_hash=principal.ip_hash,
        user_agent=user_agent,
    )
    return StartViewResponse(
        view_session_id=session["id"],
        min_watch_seconds=session["min_watch_seconds"],
        reward_points=WATCH_REWARD_POINTS,
        already_claimed=video_id in rewards_repo.claimed_video_ids(conn, owner),
        reward_eligible=not _is_own_video(video, owner),
    )


def _enforce_claim_rate_limit(conn: Conn, principal: Principal, owner: Owner) -> None:
    if owner.user_id is not None:
        if rewards_repo.count_recent_claims(conn, owner=owner, minutes=60) >= USER_CLAIM_HOURLY_LIMIT:
            raise _rate_limited(
                f"1 時間に受け取れるリワードは {USER_CLAIM_HOURLY_LIMIT} 本までです。時間をおいて再度お試しください",
                limit=USER_CLAIM_HOURLY_LIMIT,
            )
        if rewards_repo.count_recent_claims(conn, owner=owner, minutes=24 * 60) >= USER_CLAIM_DAILY_LIMIT:
            raise _rate_limited(
                f"1 日に受け取れるリワードは {USER_CLAIM_DAILY_LIMIT} 本までです。明日また受け取れます",
                limit=USER_CLAIM_DAILY_LIMIT,
            )
        return
    if rewards_repo.count_recent_claims(conn, owner=owner, minutes=24 * 60) >= ANON_CLAIM_DAILY_LIMIT:
        raise _rate_limited(
            f"ログインせずに貯められるリワードは 1 日 {ANON_CLAIM_DAILY_LIMIT} 本までです。ログインすると続けて受け取れます",
            limit=ANON_CLAIM_DAILY_LIMIT,
        )
    if (
        principal.ip_hash
        and rewards_repo.count_recent_claims(conn, ip_hash=principal.ip_hash, minutes=24 * 60)
        >= ANON_CLAIM_DAILY_LIMIT_PER_IP
    ):
        raise _rate_limited(
            "このネットワークからの未ログインでの受取が上限に達しました。ログインすると続けて受け取れます",
            limit=ANON_CLAIM_DAILY_LIMIT_PER_IP,
        )


def claim(conn: Conn, principal: Principal, session_id: UUID) -> ClaimRewardResponse:
    owner = owner_of(principal)
    rewards_repo.lock_owner(conn, owner)
    session = rewards_repo.get_view_session_for_update(conn, session_id)
    if session is None or session[owner.column] != owner.value:
        # 他人のセッションは存在しないものとして扱う（ログイン状態が変わった場合も含む）
        raise not_found("視聴の記録が見つかりません")
    video_id: UUID = session["video_id"]

    def result(earned: bool) -> ClaimRewardResponse:
        return ClaimRewardResponse(
            earned=earned,
            points=WATCH_REWARD_POINTS if earned else 0,
            video_id=video_id,
            summary=summary_for(conn, owner),
        )

    if session["claimed_at"] is not None:
        return result(False)
    video = _require_approved_video(conn, video_id)
    if _is_own_video(video, owner):
        raise ApiError(403, "own_video", "自分が投稿した動画ではリワードを受け取れません")
    elapsed = float(session["elapsed_sec"])
    if elapsed > VIEW_SESSION_TTL_SEC:
        raise ApiError(410, "view_session_expired", "視聴の記録の有効期限が切れました。もう一度再生してください")
    if elapsed < session["min_watch_seconds"]:
        wait = max(1, math.ceil(session["min_watch_seconds"] - elapsed))
        raise ApiError(
            425,
            "too_early",
            f"視聴時間が足りません。あと {wait} 秒視聴してください",
            retry_after_sec=wait,
        )
    _enforce_claim_rate_limit(conn, principal, owner)
    earned = rewards_repo.insert_watch_reward(
        conn,
        owner=owner,
        video_id=video_id,
        view_session_id=session_id,
        points=WATCH_REWARD_POINTS,
        title=f"視聴リワード: {video['title'] or '動画'}"[:200],
    )
    rewards_repo.mark_view_session_claimed(conn, session_id)
    return result(earned)


# ---------------------------------------------------------------- ログイン時の引き継ぎ


def activate(conn: Conn, user: CurrentUser, anonymous_id: UUID | None) -> ActivateRewardsResponse:
    """ゲスト中に貯めた分を引き継ぎ、初回で引き継ぐ分が無ければウェルカムボーナスを付ける。何度呼んでもよい。"""
    user_owner = Owner(user_id=user.id, anonymous_id=None)
    rewards_repo.lock_owner(conn, user_owner)
    if anonymous_id is not None:
        rewards_repo.lock_owner(conn, Owner(user_id=None, anonymous_id=anonymous_id))
    is_first = not rewards_repo.has_any_entry(conn, user.id)

    transferred = 0
    if anonymous_id is not None:
        transferred = rewards_repo.transfer_guest_watch_rewards(
            conn, user_id=user.id, anonymous_id=anonymous_id
        )
        if transferred > 0:
            write_audit_log(
                conn,
                actor_type="user",
                actor_id=str(user.id),
                action="reward.guest_transfer",
                target_type="anonymous",
                target_id=str(anonymous_id),
                payload={"points": transferred},
            )

    welcome = 0
    if is_first and transferred == 0:
        if rewards_repo.insert_welcome_bonus(
            conn,
            user_id=user.id,
            points=WELCOME_BONUS_POINTS,
            title=f"アカウント開設ウェルカムポイント (+{WELCOME_BONUS_POINTS}pt)",
        ):
            welcome = WELCOME_BONUS_POINTS
    return ActivateRewardsResponse(
        transferred_points=transferred,
        welcome_points=welcome,
        summary=summary_for(conn, user_owner),
    )


# ---------------------------------------------------------------- ギフト交換


def exchange(
    conn: Conn, user: CurrentUser, *, gift_id: str, idempotency_key: UUID, ip_hash: str | None
) -> ExchangeResponse:
    owner = Owner(user_id=user.id, anonymous_id=None)
    gift = _GIFTS_BY_ID.get(gift_id)
    if gift is None:
        raise not_found("ギフトが見つかりませんでした")
    rewards_repo.lock_owner(conn, owner)

    # 同じキーでの再送には、前回の結果をそのまま返す
    done = rewards_repo.find_exchange(conn, user_id=user.id, idempotency_key=idempotency_key)
    if done is not None:
        if done["gift_id"] != gift_id:
            raise ApiError(409, "idempotency_conflict", "別の交換で使われたキーです")
        return ExchangeResponse(gift=gift, code=done["gift_code"], summary=summary_for(conn, owner))

    if rewards_repo.count_recent_exchanges(conn, user.id, minutes=24 * 60) >= EXCHANGE_DAILY_LIMIT:
        raise _rate_limited(
            f"1 日に交換できるのは {EXCHANGE_DAILY_LIMIT} 回までです。明日また交換できます",
            limit=EXCHANGE_DAILY_LIMIT,
        )
    balance = rewards_repo.balance_of(conn, owner)
    if balance < gift.points_cost:
        raise ApiError(
            409,
            "insufficient_points",
            f"保有ポイントが不足しています（必要: {gift.points_cost}pt / 現在: {balance}pt）",
            required=gift.points_cost,
            balance=balance,
        )
    code = generate_gift_code()
    row = rewards_repo.insert_exchange(
        conn,
        user_id=user.id,
        points=gift.points_cost,
        title=f"リワード交換: {gift.name}",
        gift_id=gift.id,
        gift_code=code,
        idempotency_key=idempotency_key,
    )
    write_audit_log(
        conn,
        actor_type="user",
        actor_id=str(user.id),
        action="reward.exchange",
        target_type="point_ledger",
        target_id=str(row["id"]),
        payload={"gift_id": gift.id, "points": gift.points_cost, "ip_hash": ip_hash},
    )
    return ExchangeResponse(gift=gift, code=code, summary=summary_for(conn, owner))
