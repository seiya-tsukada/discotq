from __future__ import annotations

import pytest

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


# ---------------------------------------------------------------- 接続確認


def _head_returns(status: int) -> object:
    import httpx

    return lambda url, **_: httpx.Response(status, request=httpx.Request("HEAD", url))


def test_check_ok(storage: R2Storage, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("httpx.head", _head_returns(404))
    assert storage.check(timeout_s=1) == {"private": "ok", "public": "ok", "public_url": "ok"}


def test_check_reports_access_denied(storage: R2Storage, monkeypatch: pytest.MonkeyPatch) -> None:
    from botocore.exceptions import ClientError

    monkeypatch.setattr("httpx.head", _head_returns(200))

    def denied(**kwargs: object) -> None:
        raise ClientError({"Error": {"Code": "AccessDenied", "Message": "Access Denied"}}, "ListObjectsV2")

    monkeypatch.setattr(storage.client, "list_objects_v2", denied)
    assert storage.check(timeout_s=1) == {"private": "AccessDenied", "public": "AccessDenied", "public_url": "ok"}


def test_check_reports_unreachable_endpoint_and_public_url(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    import httpx

    def refused(url: str, **_: object) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    monkeypatch.setattr("httpx.head", refused)
    unreachable = R2Storage(
        endpoint_url="http://127.0.0.1:1",
        access_key_id="k",
        secret_access_key="s",
        private_bucket="p",
        public_bucket="q",
        public_base_url="https://media.example.test",
    )
    assert unreachable.check(timeout_s=1) == {
        "private": "endpoint_unreachable",
        "public": "endpoint_unreachable",
        "public_url": "unreachable",
    }
    assert "endpoint=http://127.0.0.1:1" in caplog.text


def test_check_public_url_server_error(storage: R2Storage, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("httpx.head", _head_returns(522))
    assert storage.check(timeout_s=1)["public_url"] == "http_522"
