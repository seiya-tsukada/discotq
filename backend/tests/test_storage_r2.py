from __future__ import annotations

from backend.app.storage.base import VideoStorage
from backend.app.storage.r2 import R2Storage
from backend.tests.conftest import PRIVATE, PUBLIC


def test_r2_storage_satisfies_protocol(storage: R2Storage) -> None:
    assert isinstance(storage, VideoStorage)
    assert storage.provider == "r2"
    assert storage.private_location == PRIVATE


def test_presigned_put_signs_type_and_length(storage: R2Storage) -> None:
    p = storage.presign_private_upload(
        "videos/x/original.mp4", content_type="video/mp4", content_length=123, expires_in=900
    )
    assert p.method == "PUT"
    assert p.headers == {"Content-Type": "video/mp4"}
    assert "content-length%3Bcontent-type%3Bhost" in p.url


def test_head_publish_unpublish(storage: R2Storage) -> None:
    key = "videos/abc/original.mp4"
    assert storage.head_private(key) is None
    storage.client.put_object(Bucket=PRIVATE, Key=key, Body=b"1234", ContentType="video/mp4")
    info = storage.head_private(key)
    assert info is not None and info.size_bytes == 4 and info.content_type == "video/mp4"

    url = storage.publish(key)
    assert url == "https://media.example.test/videos/abc/original.mp4"
    assert storage.client.head_object(Bucket=PUBLIC, Key=key)["ContentLength"] == 4
    storage.unpublish(key)
    assert storage.head_private(key) is not None  # 原本は残る
    storage.delete_private(key)
    assert storage.head_private(key) is None
