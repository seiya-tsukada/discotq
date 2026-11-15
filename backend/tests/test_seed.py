"""seed（/seed）の MP4 解析・マニフェスト・各コマンド。"""

from __future__ import annotations

import json
import struct
from pathlib import Path
from typing import Any

import pytest

from backend.app.config import get_settings
from backend.app.db import Conn
from backend.app.storage.r2 import R2Storage
from backend.tests.conftest import PRIVATE, PUBLIC, object_exists, requires_db
from seed import cli
from seed import operations as ops
from seed.manifest import ManifestError, load_manifest, seed_video_id
from seed.mp4 import Mp4Error, parse_mp4

JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 60 + b"\xff\xd9"


# ---------------------------------------------------------------- MP4 を組み立てるヘルパー


def _box(box_type: bytes, payload: bytes) -> bytes:
    return struct.pack(">I4s", 8 + len(payload), box_type) + payload


def _mvhd(duration_ms: int) -> bytes:
    payload = struct.pack(">IIIII", 0, 0, 0, 1000, duration_ms) + b"\x00" * 80
    return _box(b"mvhd", payload)


def _tkhd(width: int, height: int, rotated: bool = False) -> bytes:
    head = struct.pack(">IIIIII", 0, 0, 0, 1, 0, 0) + b"\x00" * 16
    if rotated:
        matrix = struct.pack(">iiiiiiiii", 0, 0x10000, 0, -0x10000, 0, 0, 0, 0, 0x40000000)
    else:
        matrix = struct.pack(">iiiiiiiii", 0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000)
    return _box(b"tkhd", head + matrix + struct.pack(">II", width << 16, height << 16))


def build_mp4(
    *,
    duration_ms: int = 5000,
    width: int = 1080,
    height: int = 1920,
    faststart: bool = True,
    rotated: bool = False,
    payload: bytes = b"video-data",
) -> bytes:
    ftyp = _box(b"ftyp", b"isom" + b"\x00\x00\x02\x00" + b"isommp42")
    audio = _box(b"trak", _tkhd(0, 0))
    video = _box(b"trak", _tkhd(width, height, rotated))
    moov = _box(b"moov", _mvhd(duration_ms) + audio + video)
    mdat = _box(b"mdat", payload)
    return ftyp + (moov + mdat if faststart else mdat + moov)


# ---------------------------------------------------------------- MP4 解析


def test_parse_mp4_reads_duration_resolution_and_faststart() -> None:
    info = parse_mp4(build_mp4(duration_ms=12340, width=1080, height=1920))
    assert info.duration_sec == pytest.approx(12.34)
    assert (info.width, info.height) == (1080, 1920)
    assert info.faststart is True


def test_parse_mp4_swaps_size_for_rotated_portrait_video() -> None:
    # スマホの縦撮りは 1920x1080 で保存され、回転行列で 90 度回す
    info = parse_mp4(build_mp4(width=1920, height=1080, rotated=True))
    assert (info.width, info.height) == (1080, 1920)


def test_parse_mp4_detects_non_faststart() -> None:
    assert parse_mp4(build_mp4(faststart=False)).faststart is False


def test_parse_mp4_rejects_non_mp4() -> None:
    with pytest.raises(Mp4Error):
        parse_mp4(b"not a video at all")


# ---------------------------------------------------------------- マニフェスト


def _write_manifest(tmp_path: Path, items: list[dict[str, Any]]) -> Path:
    path = tmp_path / "videos.json"
    path.write_text(json.dumps(items, ensure_ascii=False), encoding="utf-8")
    return path


def test_manifest_validation(tmp_path: Path) -> None:
    cases: list[tuple[list[dict[str, Any]], str]] = [
        ([{"slug": "Bad Slug", "file": "a.mp4"}], "slug"),
        ([{"slug": "a", "file": "a.mp4"}, {"slug": "a", "file": "b.mp4"}], "重複"),
        ([{"slug": "a", "file": "a.webm"}], ".mp4"),
        ([{"slug": "a", "file": "a.mp4", "thumbnail": "a.png"}], ".jpg"),
        ([{"slug": "a", "file": "a.mp4", "tittle": "typo"}], "不明な項目"),
    ]
    for items, expected in cases:
        with pytest.raises(ManifestError, match=expected):
            load_manifest(_write_manifest(tmp_path, items), tmp_path)


def test_video_id_is_derived_from_slug(tmp_path: Path) -> None:
    entries = load_manifest(_write_manifest(tmp_path, [{"slug": "intro", "file": "intro.mp4"}]), tmp_path)
    assert entries[0].video_id == seed_video_id("intro")
    assert seed_video_id("intro") != seed_video_id("intro-2")


# ---------------------------------------------------------------- コマンド（DB + moto）


@pytest.fixture
def seed_dir(tmp_path: Path) -> Path:
    (tmp_path / "files").mkdir()
    return tmp_path


def _setup(seed_dir: Path, items: list[dict[str, Any]], files: dict[str, bytes]) -> list[Any]:
    for name, data in files.items():
        (seed_dir / "files" / name).write_bytes(data)
    return load_manifest(_write_manifest(seed_dir, items), seed_dir / "files")


ITEMS = [
    {"slug": "first", "file": "first.mp4", "title": "最初の動画", "thumbnail": "first.jpg"},
    {"slug": "second", "file": "second.mp4", "title": "二本目"},
]


def _files() -> dict[str, bytes]:
    return {
        "first.mp4": build_mp4(payload=b"a" * 100),
        "first.jpg": JPEG,
        "second.mp4": build_mp4(payload=b"b" * 200, duration_ms=8000),
    }


@requires_db
def test_apply_creates_published_videos_and_is_idempotent(
    db: Conn, storage: R2Storage, seed_dir: Path, make_client: Any
) -> None:
    entries = _setup(seed_dir, ITEMS, _files())
    settings = get_settings()

    planned = ops.apply(db, storage, settings, entries, dry_run=True)
    assert [r.outcome for r in planned] == ["planned", "planned"]
    assert db.execute("select count(*) as n from discotq.videos").fetchone() == {"n": 0}

    results = ops.apply(db, storage, settings, entries)
    assert [r.outcome for r in results] == ["created", "created"], results

    first_id = seed_video_id("first")
    row = db.execute("select * from discotq.videos where id = %s", (first_id,)).fetchone()
    assert row is not None
    assert row["source"] == "platform" and row["status"] == "approved"
    assert row["object_key"] == f"videos/{first_id}/original.mp4"
    assert row["public_url"] == f"https://media.example.test/videos/{first_id}/original.mp4"
    assert row["thumb_url"] == f"https://media.example.test/videos/{first_id}/thumb.jpg"
    assert (row["width"], row["height"], float(row["duration_sec"])) == (1080, 1920, 5.0)
    assert object_exists(storage, PRIVATE, row["object_key"])
    assert object_exists(storage, PUBLIC, row["object_key"])
    assert db.execute(
        "select action from discotq.video_reviews where video_id = %s", (first_id,)
    ).fetchone() == {"action": "auto_approve"}

    # フィードはマニフェストの順（先頭が一番上）
    feed = make_client().get("/api/videos/feed").json()["items"]
    assert [i["title"] for i in feed] == ["最初の動画", "二本目"]

    # 2 回目は何もしない
    again = ops.apply(db, storage, settings, entries)
    assert [r.outcome for r in again] == ["skipped", "skipped"]
    assert db.execute("select count(*) as n from discotq.videos").fetchone() == {"n": 2}
    assert ops.verify(db, storage, entries) == []


@requires_db
def test_apply_rejects_invalid_files_without_side_effects(
    db: Conn, storage: R2Storage, seed_dir: Path
) -> None:
    entries = _setup(
        seed_dir,
        [
            {"slug": "slow", "file": "slow.mp4"},
            {"slug": "long", "file": "long.mp4"},
            {"slug": "missing", "file": "missing.mp4"},
            {"slug": "badthumb", "file": "ok.mp4", "thumbnail": "bad.jpg"},
        ],
        {
            "slow.mp4": build_mp4(faststart=False),
            "long.mp4": build_mp4(duration_ms=181_000),
            "ok.mp4": build_mp4(),
            "bad.jpg": b"PNG?",
        },
    )
    results = ops.apply(db, storage, get_settings(), entries)
    assert [r.outcome for r in results] == ["error"] * 4
    assert "faststart" in results[0].detail and "ffmpeg" in results[0].detail
    assert "長すぎます" in results[1].detail
    assert "ありません" in results[2].detail
    assert "JPEG" in results[3].detail
    assert db.execute("select count(*) as n from discotq.videos").fetchone() == {"n": 0}
    assert storage.list_keys("videos/", public=False) == []


@requires_db
def test_list_and_verify_detect_inconsistencies(db: Conn, storage: R2Storage, seed_dir: Path) -> None:
    entries = _setup(seed_dir, ITEMS, _files())
    ops.apply(db, storage, get_settings(), entries)

    rows = {r.slug: r for r in ops.list_status(db, storage, entries)}
    assert rows["first"].status == "approved"
    assert (rows["first"].private_video, rows["first"].private_thumb, rows["first"].public_video) == (True, True, True)
    assert rows["second"].private_thumb is None

    # public の動画が消えた / マニフェストから消えた seed
    first_key = f"videos/{seed_video_id('first')}/original.mp4"
    storage.unpublish(first_key)
    issues = ops.verify(db, storage, entries[:1])
    messages = [f"{i.slug}: {i.message}" for i in issues]
    assert any("first: 公開中なのに R2(public) に動画がありません" in m for m in messages), messages
    assert any(m.startswith("second: マニフェストに無い seed") for m in messages), messages
    listed = {r.slug: r for r in ops.list_status(db, storage, entries[:1])}
    assert listed["second"].in_manifest is False


@requires_db
def test_replace_updates_file_thumbnail_and_metadata(
    db: Conn, storage: R2Storage, seed_dir: Path
) -> None:
    entries = _setup(seed_dir, ITEMS, _files())
    settings = get_settings()
    ops.apply(db, storage, settings, entries)
    assert [r.outcome for r in ops.replace(db, storage, settings, entries)] == ["unchanged", "unchanged"]

    # 動画ファイル・タイトル変更、second にサムネ追加
    (seed_dir / "files" / "first.mp4").write_bytes(build_mp4(payload=b"c" * 300, duration_ms=9000))
    (seed_dir / "files" / "second.jpg").write_bytes(JPEG)
    items = [dict(ITEMS[0], title="改題"), dict(ITEMS[1], thumbnail="second.jpg")]
    entries = _setup(seed_dir, items, {})

    planned = ops.replace(db, storage, settings, entries, dry_run=True)
    assert planned[0].outcome == "planned" and "動画ファイル" in planned[0].detail and "タイトル" in planned[0].detail
    results = ops.replace(db, storage, settings, entries)
    assert [r.outcome for r in results] == ["updated", "updated"], results

    first = db.execute("select * from discotq.videos where id = %s", (seed_video_id("first"),)).fetchone()
    assert first is not None
    assert first["title"] == "改題" and float(first["duration_sec"]) == 9.0
    assert storage.head_public(first["object_key"]) is not None
    assert storage.head_public(first["object_key"]).size_bytes == first["size_bytes"]  # type: ignore[union-attr]
    second = db.execute("select * from discotq.videos where id = %s", (seed_video_id("second"),)).fetchone()
    assert second is not None and second["thumb_url"] is not None
    assert ops.verify(db, storage, entries) == []

    # サムネをマニフェストから外すと削除される
    entries = _setup(seed_dir, [ITEMS[0] | {"title": "改題"}, ITEMS[1]], {})
    assert [r.outcome for r in ops.replace(db, storage, settings, entries, slugs=["second"])] == ["updated"]
    second = db.execute("select thumb_key, thumb_url from discotq.videos where id = %s", (seed_video_id("second"),)).fetchone()
    assert second == {"thumb_key": None, "thumb_url": None}
    assert ops.verify(db, storage, entries) == []


@requires_db
def test_remove_deletes_objects_and_rows(
    db: Conn, storage: R2Storage, seed_dir: Path, make_client: Any
) -> None:
    entries = _setup(seed_dir, ITEMS, _files())
    ops.apply(db, storage, get_settings(), entries)

    targets = ops.resolve_targets(db, entries, ["first"])
    assert [r.outcome for r in ops.remove(db, storage, targets, dry_run=True)] == ["planned"]
    results = ops.remove(db, storage, targets)
    assert [r.outcome for r in results] == ["removed"]
    first_id = seed_video_id("first")
    assert db.execute("select 1 from discotq.videos where id = %s", (first_id,)).fetchone() is None
    assert storage.list_keys(f"videos/{first_id}/", public=False) == []
    assert storage.list_keys(f"videos/{first_id}/", public=True) == []
    assert db.execute("select 1 from discotq.audit_logs where action = 'seed.remove'").fetchone()
    assert [i["title"] for i in make_client().get("/api/videos/feed").json()["items"]] == ["二本目"]

    # マニフェストから消えた seed も slug 指定なしの remove で消える
    rest = ops.resolve_targets(db, entries[:1], None)
    assert ("second", seed_video_id("second")) in rest
    ops.remove(db, storage, rest)
    assert db.execute("select count(*) as n from discotq.videos").fetchone() == {"n": 0}


@requires_db
def test_remove_refuses_user_videos(db: Conn, storage: R2Storage, anon_client: Any) -> None:
    from backend.tests.conftest import upload_video

    video_id = upload_video(anon_client, storage)["video_id"]
    results = ops.remove(db, storage, [("someone", video_id)])
    assert results[0].outcome == "error"
    assert db.execute("select 1 from discotq.videos where id = %s", (video_id,)).fetchone()


@requires_db
def test_cli_end_to_end(
    db: Conn, storage: R2Storage, seed_dir: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    _setup(seed_dir, ITEMS, _files())
    monkeypatch.setattr(cli, "get_storage", lambda: storage)
    base = ["--manifest", str(seed_dir / "videos.json"), "--files-dir", str(seed_dir / "files")]

    assert cli.main([*base, "apply"]) == 0
    out = capsys.readouterr().out
    assert "[作成] first" in out and "[作成] second" in out and "合計: 作成 2" in out

    assert cli.main([*base, "list"]) == 0
    assert "first\tapproved\t○\t○\t○\thttps://media.example.test/" in capsys.readouterr().out

    assert cli.main([*base, "verify"]) == 0
    assert "不整合はありません" in capsys.readouterr().out

    assert cli.main([*base, "remove", "--yes"]) == 0
    assert "合計: 削除 2" in capsys.readouterr().out
    assert cli.main([*base, "verify"]) == 1  # 未登録になった
