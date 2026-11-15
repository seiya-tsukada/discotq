"""seed 動画の作成・一覧・不整合検出・削除・差し替え。

seed 動画は運営投稿（source=platform）として登録し、審査を省略して公開（approved）する。
* 動画 ID は slug から UUID v5 で決めるため、何度実行しても同じ動画は 1 件にしかならない
* R2 のキーは通常の投稿と同じ videos/{id}/original.{ext} / videos/{id}/thumb.jpg
* 操作は audit_logs に actor_type=system / action=seed.* で記録する
"""

from __future__ import annotations

import hashlib
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Literal
from uuid import UUID

from backend.app.config import Settings
from backend.app.db import Conn
from backend.app.repositories import videos as videos_repo
from backend.app.repositories.audit import write_audit_log
from backend.app.services.videos import thumb_key, video_key
from backend.app.storage.base import VideoStorage
from seed.manifest import SeedEntry, seed_video_id
from seed.mp4 import Mp4Error, parse_mp4

ACTOR_ID = "seed-script"
THUMBNAIL_MIME = "image/jpeg"

Outcome = Literal["created", "updated", "removed", "skipped", "unchanged", "error", "planned"]


class SeedError(ValueError):
    pass


@dataclass
class Result:
    slug: str
    outcome: Outcome
    detail: str = ""


@dataclass(frozen=True)
class LocalVideo:
    data: bytes
    md5: str
    duration_sec: float
    width: int | None
    height: int | None
    thumb: bytes | None
    thumb_md5: str | None


# ---------------------------------------------------------------- 共通


def _md5(data: bytes) -> str:
    return hashlib.md5(data, usedforsecurity=False).hexdigest()


def load_local(entry: SeedEntry, settings: Settings) -> LocalVideo:
    """ローカルの動画・サムネイルを読み、アップロードできる状態か検証する。"""
    if not entry.file.is_file():
        raise SeedError(f"動画ファイルがありません: {entry.file}")
    data = entry.file.read_bytes()
    if not data:
        raise SeedError(f"動画ファイルが空です: {entry.file.name}")
    if len(data) > settings.max_upload_bytes:
        raise SeedError(
            f"ファイルサイズが上限（{settings.max_upload_bytes // (1024 * 1024)}MB）を超えています: "
            f"{len(data) / 1024 / 1024:.1f}MB"
        )
    try:
        info = parse_mp4(data)
    except Mp4Error as e:
        raise SeedError(f"MP4 / MOV として読めません: {e}") from e
    if not info.faststart:
        raise SeedError(
            "faststart になっていません（moov が mdat より後ろ）。次のコマンドで変換してください: "
            f"ffmpeg -i {entry.file.name} -c copy -movflags +faststart out.mp4"
        )
    if info.duration_sec > settings.max_video_duration_sec:
        raise SeedError(
            f"動画が長すぎます（{info.duration_sec:.1f} 秒 / 上限 {settings.max_video_duration_sec} 秒）"
        )

    thumb: bytes | None = None
    if entry.thumbnail is not None:
        if not entry.thumbnail.is_file():
            raise SeedError(f"サムネイルがありません: {entry.thumbnail}")
        thumb = entry.thumbnail.read_bytes()
        if not thumb.startswith(b"\xff\xd8"):
            raise SeedError(f"サムネイルが JPEG ではありません: {entry.thumbnail.name}")
        if len(thumb) > settings.max_thumbnail_bytes:
            raise SeedError(f"サムネイルが大きすぎます: {entry.thumbnail.name}")
    return LocalVideo(
        data=data,
        md5=_md5(data),
        duration_sec=round(info.duration_sec, 2),
        width=info.width,
        height=info.height,
        thumb=thumb,
        thumb_md5=_md5(thumb) if thumb else None,
    )


def _audit(conn: Conn, action: str, video_id: UUID, payload: dict[str, Any]) -> None:
    write_audit_log(
        conn,
        actor_type="system",
        actor_id=ACTOR_ID,
        action=action,
        target_type="video",
        target_id=str(video_id),
        payload=payload,
    )


def _select(entries: list[SeedEntry], slugs: Iterable[str] | None) -> list[SeedEntry]:
    if not slugs:
        return entries
    wanted = list(slugs)
    by_slug = {e.slug: e for e in entries}
    missing = [s for s in wanted if s not in by_slug]
    if missing:
        raise SeedError(f"マニフェストに無い slug: {', '.join(missing)}")
    return [by_slug[s] for s in wanted]


def seeded_in_db(conn: Conn) -> dict[UUID, str]:
    """seed で作成され、まだ DB に残っている動画（id → slug）。マニフェストから消えたものも含む。"""
    rows = conn.execute(
        """
        select distinct on (a.target_id) a.target_id, a.payload->>'slug' as slug
        from discotq.audit_logs a
        join discotq.videos v on v.id::text = a.target_id
        where a.action = 'seed.create'
        order by a.target_id, a.created_at desc
        """
    ).fetchall()
    return {UUID(r["target_id"]): r["slug"] for r in rows}


# ---------------------------------------------------------------- apply（作成）


def apply(
    conn: Conn,
    storage: VideoStorage,
    settings: Settings,
    entries: list[SeedEntry],
    *,
    slugs: Iterable[str] | None = None,
    dry_run: bool = False,
) -> list[Result]:
    """未登録の seed を登録して公開する。登録済みはスキップする。

    フィードは承認日時の新しい順に並ぶため、マニフェストの先頭が一番上に来るよう末尾から登録する。
    """
    targets = _select(entries, slugs)
    results: dict[str, Result] = {}
    for entry in reversed(targets):
        results[entry.slug] = _apply_one(conn, storage, settings, entry, dry_run=dry_run)
    return [results[e.slug] for e in targets]


def _apply_one(
    conn: Conn, storage: VideoStorage, settings: Settings, entry: SeedEntry, *, dry_run: bool
) -> Result:
    video_id = entry.video_id
    existing = videos_repo.get_video(conn, video_id)
    if existing is not None:
        hint = "（内容の更新は replace）" if existing["status"] != "deleted" else "（作り直すには remove 後に apply）"
        return Result(entry.slug, "skipped", f"登録済み status={existing['status']}{hint}")
    try:
        local = load_local(entry, settings)
    except SeedError as e:
        return Result(entry.slug, "error", str(e))

    summary = _describe(local)
    if dry_run:
        return Result(entry.slug, "planned", f"作成して公開します: {summary}")

    key = video_key(video_id, entry.mime_type)
    t_key = thumb_key(video_id) if local.thumb else None
    try:
        storage.put_private(key, local.data, content_type=entry.mime_type)
        if t_key and local.thumb:
            storage.put_private(t_key, local.thumb, content_type=THUMBNAIL_MIME)
        videos_repo.create_video(
            conn,
            video_id=video_id,
            source="platform",
            uploader_user_id=None,
            anonymous_id=None,
            uploader_ip_hash=None,
            title=entry.title,
            description=entry.description,
            storage_provider=storage.provider,
            bucket=storage.private_location,
            object_key=key,
            thumb_key=t_key,
            mime_type=entry.mime_type,
            size_bytes=len(local.data),
            duration_sec=local.duration_sec,
            width=local.width,
            height=local.height,
            auto_approve=True,
        )
        public_url = storage.publish(key)
        thumb_url = storage.publish(t_key) if t_key else None
        videos_repo.update_video(
            conn,
            video_id,
            status="approved",
            public_url=public_url,
            thumb_url=thumb_url,
            approved_at=datetime.now(UTC),
            approved_by=None,
        )
        videos_repo.insert_review(
            conn, video_id=video_id, reviewer_id=None, action="auto_approve", reason="seed"
        )
        _audit(conn, "seed.create", video_id, {"slug": entry.slug, "file": entry.file.name, "md5": local.md5})
        conn.commit()
    except Exception as e:  # noqa: BLE001 - 途中まで作ったものを片付けて次の動画に進む
        conn.rollback()
        _cleanup_objects(storage, video_id)
        return Result(entry.slug, "error", f"登録に失敗しました: {type(e).__name__}: {e}")
    return Result(entry.slug, "created", f"{summary} → {public_url}")


def _describe(local: LocalVideo) -> str:
    size = f"{len(local.data) / 1024 / 1024:.1f}MB"
    res = f"{local.width}x{local.height}" if local.width and local.height else "解像度不明"
    thumb = "サムネあり" if local.thumb else "サムネなし"
    return f"{size}, {local.duration_sec:.1f}秒, {res}, {thumb}"


def _cleanup_objects(storage: VideoStorage, video_id: UUID) -> None:
    prefix = f"videos/{video_id}/"
    for key in storage.list_keys(prefix, public=True):
        storage.unpublish(key)
    for key in storage.list_keys(prefix, public=False):
        storage.delete_private(key)


# ---------------------------------------------------------------- list（状況一覧）


@dataclass
class StatusRow:
    slug: str
    video_id: UUID
    in_manifest: bool
    status: str | None
    private_video: bool
    private_thumb: bool | None
    public_video: bool
    public_url: str | None


def list_status(conn: Conn, storage: VideoStorage, entries: list[SeedEntry]) -> list[StatusRow]:
    rows: list[StatusRow] = []
    targets: list[tuple[str, UUID, bool]] = [(e.slug, e.video_id, True) for e in entries]
    manifest_ids = {e.video_id for e in entries}
    targets += [(slug, vid, False) for vid, slug in seeded_in_db(conn).items() if vid not in manifest_ids]
    for slug, video_id, in_manifest in targets:
        video = videos_repo.get_video(conn, video_id)
        if video is None:
            rows.append(StatusRow(slug, video_id, in_manifest, None, False, None, False, None))
            continue
        rows.append(
            StatusRow(
                slug=slug,
                video_id=video_id,
                in_manifest=in_manifest,
                status=video["status"],
                private_video=storage.head_private(video["object_key"]) is not None,
                private_thumb=(storage.head_private(video["thumb_key"]) is not None)
                if video["thumb_key"]
                else None,
                public_video=storage.head_public(video["object_key"]) is not None,
                public_url=video["public_url"],
            )
        )
    return rows


# ---------------------------------------------------------------- verify（不整合の検出）


@dataclass
class Issue:
    slug: str
    message: str


def verify(conn: Conn, storage: VideoStorage, entries: list[SeedEntry]) -> list[Issue]:
    issues: list[Issue] = []
    manifest_ids = {e.video_id for e in entries}

    for entry in entries:
        if not entry.file.is_file():
            issues.append(Issue(entry.slug, f"ローカルに動画ファイルがありません（{entry.file.name}）"))
        if entry.thumbnail is not None and not entry.thumbnail.is_file():
            issues.append(Issue(entry.slug, f"ローカルにサムネイルがありません（{entry.thumbnail.name}）"))
        video = videos_repo.get_video(conn, entry.video_id)
        prefix = f"videos/{entry.video_id}/"
        if video is None:
            leftovers = storage.list_keys(prefix, public=False) + storage.list_keys(prefix, public=True)
            if leftovers:
                issues.append(Issue(entry.slug, f"DB に行が無いのに R2 にオブジェクトがあります: {leftovers}"))
            else:
                issues.append(Issue(entry.slug, "未登録です（apply で登録できます）"))
            continue
        issues += [Issue(entry.slug, m) for m in _check_video(storage, video)]

    # マニフェストから消えたが DB に残っている seed
    for video_id, slug in seeded_in_db(conn).items():
        if video_id not in manifest_ids:
            issues.append(Issue(slug or str(video_id), "マニフェストに無い seed 動画が DB に残っています（remove で削除できます）"))
    return issues


def _check_video(storage: VideoStorage, video: dict[str, Any]) -> list[str]:
    problems: list[str] = []
    key, t_key = video["object_key"], video["thumb_key"]
    private = storage.head_private(key)
    if private is None:
        problems.append(f"R2(private) に動画がありません: {key}")
    elif private.size_bytes != video["size_bytes"]:
        problems.append(f"R2(private) の動画サイズが DB と違います: R2={private.size_bytes} DB={video['size_bytes']}")
    if t_key and storage.head_private(t_key) is None:
        problems.append(f"R2(private) にサムネイルがありません: {t_key}")

    public = storage.head_public(key)
    if video["status"] == "approved":
        if public is None:
            problems.append(f"公開中なのに R2(public) に動画がありません: {key}")
        if video["public_url"] != storage.public_url(key):
            problems.append(f"public_url が想定と違います: DB={video['public_url']} 想定={storage.public_url(key)}")
        if t_key and storage.head_public(t_key) is None:
            problems.append(f"公開中なのに R2(public) にサムネイルがありません: {t_key}")
        if t_key and video["thumb_url"] != storage.public_url(t_key):
            problems.append("thumb_url が想定と違います")
    else:
        if public is not None:
            problems.append(f"非公開（status={video['status']}）なのに R2(public) に動画が残っています")
        if video["public_url"]:
            problems.append(f"非公開（status={video['status']}）なのに public_url が残っています")

    expected = {k for k in (key, t_key) if k}
    prefix = f"videos/{video['id']}/"
    extra = [k for k in storage.list_keys(prefix, public=False) if k not in expected]
    extra += [f"(public) {k}" for k in storage.list_keys(prefix, public=True) if k not in expected]
    if extra:
        problems.append(f"不要なオブジェクトが残っています: {extra}")
    return problems


# ---------------------------------------------------------------- remove（削除）


def resolve_targets(conn: Conn, entries: list[SeedEntry], slugs: Iterable[str] | None) -> list[tuple[str, UUID]]:
    """削除対象。slug 未指定ならマニフェストの全件と、マニフェストに無い DB 上の seed。"""
    known: dict[str, UUID] = {e.slug: e.video_id for e in entries}
    for video_id, slug in seeded_in_db(conn).items():
        if slug:
            known.setdefault(slug, video_id)
    if not slugs:
        return list(known.items())
    targets = []
    for slug in slugs:
        targets.append((slug, known.get(slug) or seed_video_id(slug)))
    return targets


def remove(
    conn: Conn, storage: VideoStorage, targets: list[tuple[str, UUID]], *, dry_run: bool = False
) -> list[Result]:
    results = []
    for slug, video_id in targets:
        prefix = f"videos/{video_id}/"
        public_keys = storage.list_keys(prefix, public=True)
        private_keys = storage.list_keys(prefix, public=False)
        video = videos_repo.get_video(conn, video_id)
        if video is None and not public_keys and not private_keys:
            results.append(Result(slug, "skipped", "登録されていません"))
            continue
        if video is not None and video["source"] != "platform":
            results.append(Result(slug, "error", "seed 以外の動画（source=user）は削除しません"))
            continue
        detail = f"DB の行={'あり' if video else 'なし'}, R2(private)={len(private_keys)}件, R2(public)={len(public_keys)}件"
        if dry_run:
            results.append(Result(slug, "planned", f"削除します: {detail}"))
            continue
        try:
            for key in public_keys:
                storage.unpublish(key)
            for key in private_keys:
                storage.delete_private(key)
            if video is not None:
                videos_repo.delete_video(conn, video_id)
            _audit(conn, "seed.remove", video_id, {"slug": slug, "objects": private_keys + public_keys})
            conn.commit()
        except Exception as e:  # noqa: BLE001
            conn.rollback()
            results.append(Result(slug, "error", f"削除に失敗しました: {type(e).__name__}: {e}"))
            continue
        results.append(Result(slug, "removed", detail))
    return results


# ---------------------------------------------------------------- replace（差し替え）


@dataclass
class _Plan:
    changes: list[str] = field(default_factory=list)
    video: bool = False
    thumb: Literal["keep", "upload", "delete"] = "keep"
    fields: dict[str, Any] = field(default_factory=dict)


def replace(
    conn: Conn,
    storage: VideoStorage,
    settings: Settings,
    entries: list[SeedEntry],
    *,
    slugs: Iterable[str] | None = None,
    dry_run: bool = False,
) -> list[Result]:
    """登録済み seed のファイル・タイトル・説明をマニフェストとローカルファイルに合わせる。"""
    return [_replace_one(conn, storage, settings, e, dry_run=dry_run) for e in _select(entries, slugs)]


def _replace_one(
    conn: Conn, storage: VideoStorage, settings: Settings, entry: SeedEntry, *, dry_run: bool
) -> Result:
    video_id = entry.video_id
    video = videos_repo.get_video(conn, video_id)
    if video is None:
        return Result(entry.slug, "skipped", "未登録です（apply で登録してください）")
    if video["status"] == "deleted":
        return Result(entry.slug, "skipped", "削除済みです（remove 後に apply で作り直してください）")
    try:
        local = load_local(entry, settings)
    except SeedError as e:
        return Result(entry.slug, "error", str(e))

    plan = _plan_replace(storage, entry, video, local)
    if not plan.changes:
        return Result(entry.slug, "unchanged", "変更はありません")
    if dry_run:
        return Result(entry.slug, "planned", "差し替えます: " + ", ".join(plan.changes))

    new_key = video_key(video_id, entry.mime_type)
    old_key = video["object_key"]
    t_key = thumb_key(video_id)
    published = video["status"] == "approved"
    try:
        if plan.video:
            storage.put_private(new_key, local.data, content_type=entry.mime_type)
            if old_key != new_key:
                storage.unpublish(old_key)
                storage.delete_private(old_key)
            if published:
                plan.fields["public_url"] = storage.publish(new_key)
        if plan.thumb == "upload" and local.thumb:
            storage.put_private(t_key, local.thumb, content_type=THUMBNAIL_MIME)
            plan.fields["thumb_key"] = t_key
            if published:
                plan.fields["thumb_url"] = storage.publish(t_key)
        elif plan.thumb == "delete" and video["thumb_key"]:
            storage.unpublish(video["thumb_key"])
            storage.delete_private(video["thumb_key"])
            plan.fields.update(thumb_key=None, thumb_url=None)
        if plan.fields:
            videos_repo.update_video(conn, video_id, **plan.fields)
        _audit(conn, "seed.replace", video_id, {"slug": entry.slug, "changes": plan.changes, "md5": local.md5})
        conn.commit()
    except Exception as e:  # noqa: BLE001
        conn.rollback()
        return Result(entry.slug, "error", f"差し替えに失敗しました: {type(e).__name__}: {e}")
    note = "（公開 URL は同じです。CDN キャッシュが残る場合があります）" if plan.video and published else ""
    return Result(entry.slug, "updated", ", ".join(plan.changes) + note)


def _plan_replace(
    storage: VideoStorage, entry: SeedEntry, video: dict[str, Any], local: LocalVideo
) -> _Plan:
    plan = _Plan()
    new_key = video_key(entry.video_id, entry.mime_type)
    current = storage.head_private(video["object_key"])
    if current is None or current.etag != local.md5 or new_key != video["object_key"]:
        plan.video = True
        plan.changes.append("動画ファイル")
        plan.fields.update(
            object_key=new_key,
            mime_type=entry.mime_type,
            size_bytes=len(local.data),
            duration_sec=local.duration_sec,
            width=local.width,
            height=local.height,
        )

    if local.thumb is not None:
        current_thumb = storage.head_private(video["thumb_key"]) if video["thumb_key"] else None
        if current_thumb is None or current_thumb.etag != local.thumb_md5:
            plan.thumb = "upload"
            plan.changes.append("サムネイル")
    elif video["thumb_key"]:
        plan.thumb = "delete"
        plan.changes.append("サムネイル削除")

    if video["title"] != entry.title:
        plan.fields["title"] = entry.title
        plan.changes.append("タイトル")
    if video["description"] != entry.description:
        plan.fields["description"] = entry.description
        plan.changes.append("説明")
    return plan
