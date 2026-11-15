"""seed のマニフェスト（seed/videos.json）の読み込みと検証。"""

from __future__ import annotations

import json
import re
import uuid
from dataclasses import dataclass
from pathlib import Path

SEED_DIR = Path(__file__).resolve().parent
DEFAULT_MANIFEST = SEED_DIR / "videos.json"
DEFAULT_FILES_DIR = SEED_DIR / "files"

# slug から動画 ID を決めるための名前空間（変えると既存の seed と別物扱いになる）
SEED_NAMESPACE = uuid.UUID("6f2d1c9e-3b4a-5d8e-9f10-2a3b4c5d6e7f")
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,62}$")

MIME_BY_EXT = {".mp4": "video/mp4", ".m4v": "video/mp4", ".mov": "video/quicktime"}


class ManifestError(ValueError):
    pass


@dataclass(frozen=True)
class SeedEntry:
    slug: str
    file: Path
    title: str
    description: str
    thumbnail: Path | None

    @property
    def video_id(self) -> uuid.UUID:
        return seed_video_id(self.slug)

    @property
    def mime_type(self) -> str:
        return MIME_BY_EXT[self.file.suffix.lower()]


def seed_video_id(slug: str) -> uuid.UUID:
    return uuid.uuid5(SEED_NAMESPACE, f"discotq-seed:{slug}")


def load_manifest(path: Path = DEFAULT_MANIFEST, files_dir: Path = DEFAULT_FILES_DIR) -> list[SeedEntry]:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as e:
        raise ManifestError(f"マニフェストがありません: {path}") from e
    except json.JSONDecodeError as e:
        raise ManifestError(f"マニフェストの JSON が不正です: {path}: {e}") from e
    if not isinstance(raw, list):
        raise ManifestError("マニフェストは配列（[ {...}, ... ]）で書いてください")

    entries: list[SeedEntry] = []
    seen: set[str] = set()
    for i, item in enumerate(raw):
        where = f"{path.name}[{i}]"
        if not isinstance(item, dict):
            raise ManifestError(f"{where}: オブジェクトで書いてください")
        unknown = set(item) - {"slug", "file", "title", "description", "thumbnail"}
        if unknown:
            raise ManifestError(f"{where}: 不明な項目 {sorted(unknown)}")
        slug = item.get("slug")
        if not isinstance(slug, str) or not SLUG_RE.match(slug):
            raise ManifestError(f"{where}: slug は英小文字・数字・ハイフン（1〜63 文字）で指定してください")
        if slug in seen:
            raise ManifestError(f"{where}: slug '{slug}' が重複しています")
        seen.add(slug)
        file_name = item.get("file")
        if not isinstance(file_name, str) or Path(file_name).suffix.lower() not in MIME_BY_EXT:
            raise ManifestError(f"{where}: file は .mp4 / .m4v / .mov のファイル名を指定してください")
        title = item.get("title", "")
        description = item.get("description", "")
        if not isinstance(title, str) or len(title) > 100:
            raise ManifestError(f"{where}: title は 100 文字以内の文字列にしてください")
        if not isinstance(description, str) or len(description) > 2000:
            raise ManifestError(f"{where}: description は 2000 文字以内の文字列にしてください")
        thumb_name = item.get("thumbnail")
        if thumb_name is not None and (
            not isinstance(thumb_name, str) or Path(thumb_name).suffix.lower() not in (".jpg", ".jpeg")
        ):
            raise ManifestError(f"{where}: thumbnail は .jpg のファイル名を指定してください")
        entries.append(
            SeedEntry(
                slug=slug,
                file=files_dir / file_name,
                title=title.strip(),
                description=description.strip(),
                thumbnail=files_dir / thumb_name if thumb_name else None,
            )
        )
    return entries
