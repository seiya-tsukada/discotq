"""動画ストレージの抽象インターフェース。

アプリケーションは「非公開領域（審査前の原本）」と「公開領域（承認済み）」という
2 つの概念だけを扱い、バケット名や配信方式は実装側に閉じ込める。
将来 Cloudflare Stream に移行する場合は、このプロトコルを満たす実装を追加して
``backend.app.deps.get_storage`` を差し替える。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Protocol, runtime_checkable


@dataclass(frozen=True)
class PresignedUpload:
    url: str
    method: str
    # ブラウザが PUT 時に必ず付けるべきヘッダー（署名に含まれている）
    headers: dict[str, str] = field(default_factory=dict)
    expires_at: datetime | None = None


@dataclass(frozen=True)
class ObjectInfo:
    size_bytes: int
    content_type: str | None


@runtime_checkable
class VideoStorage(Protocol):
    @property
    def provider(self) -> str:
        """videos.storage_provider に保存する識別子（例: 'r2'）。"""
        ...

    @property
    def private_location(self) -> str:
        """videos.bucket に保存する非公開領域の名前。"""
        ...

    def presign_private_upload(
        self, key: str, *, content_type: str, content_length: int, expires_in: int
    ) -> PresignedUpload:
        """非公開領域への直接アップロード用 URL を発行する。"""
        ...

    def presign_private_download(self, key: str, *, expires_in: int) -> str:
        """審査プレビュー用の一時 URL を発行する。"""
        ...

    def head_private(self, key: str) -> ObjectInfo | None:
        """非公開領域のオブジェクト情報。存在しなければ None。"""
        ...

    def delete_private(self, key: str) -> None: ...

    def publish(self, key: str) -> str:
        """非公開領域のオブジェクトを公開領域へコピーし、公開 URL を返す。"""
        ...

    def unpublish(self, key: str) -> None:
        """公開領域からオブジェクトを削除する（非公開領域の原本は残す）。"""
        ...

    def public_url(self, key: str) -> str: ...
