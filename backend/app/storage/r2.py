"""Cloudflare R2（S3 互換 API）実装。"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any
from urllib.parse import quote

import boto3
import httpx
from botocore.config import Config
from botocore.exceptions import (
    BotoCoreError,
    ClientError,
    ConnectTimeoutError,
    EndpointConnectionError,
    NoCredentialsError,
    ReadTimeoutError,
)

from backend.app.storage.base import ObjectInfo, PresignedUpload

if TYPE_CHECKING:
    from mypy_boto3_s3 import S3Client


PUBLIC_CACHE_CONTROL = "public, max-age=3600"

logger = logging.getLogger("discotq.storage")


class R2Storage:
    def __init__(
        self,
        *,
        endpoint_url: str,
        access_key_id: str,
        secret_access_key: str,
        private_bucket: str,
        public_bucket: str,
        public_base_url: str,
        client: S3Client | None = None,
    ) -> None:
        self._private_bucket = private_bucket
        self._public_bucket = public_bucket
        self._public_base_url = public_base_url.rstrip("/")
        self._endpoint_url = endpoint_url
        self._access_key_id = access_key_id
        self._secret_access_key = secret_access_key
        self._injected_client = client
        self._client: S3Client = client or boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            region_name="auto",
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            config=Config(signature_version="s3v4", retries={"max_attempts": 3, "mode": "standard"}),
        )

    @property
    def provider(self) -> str:
        return "r2"

    @property
    def private_location(self) -> str:
        return self._private_bucket

    @property
    def client(self) -> S3Client:
        return self._client

    def presign_private_upload(
        self, key: str, *, content_type: str, content_length: int, expires_in: int
    ) -> PresignedUpload:
        # ContentType / ContentLength を Params に含めると SignedHeaders に入り、
        # 宣言と異なるサイズ・MIME で PUT すると R2 側で署名エラーになる
        url = self._client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": self._private_bucket,
                "Key": key,
                "ContentType": content_type,
                "ContentLength": content_length,
            },
            ExpiresIn=expires_in,
            HttpMethod="PUT",
        )
        return PresignedUpload(
            url=url,
            method="PUT",
            headers={"Content-Type": content_type},
            expires_at=datetime.now(UTC) + timedelta(seconds=expires_in),
        )

    def presign_private_download(self, key: str, *, expires_in: int) -> str:
        return self._client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self._private_bucket, "Key": key},
            ExpiresIn=expires_in,
        )

    def head_private(self, key: str) -> ObjectInfo | None:
        try:
            res: Any = self._client.head_object(Bucket=self._private_bucket, Key=key)
        except ClientError as e:
            if e.response.get("Error", {}).get("Code") in ("404", "NoSuchKey", "NotFound"):
                return None
            raise
        return ObjectInfo(size_bytes=int(res["ContentLength"]), content_type=res.get("ContentType"))

    def delete_private(self, key: str) -> None:
        self._client.delete_object(Bucket=self._private_bucket, Key=key)

    def publish(self, key: str) -> str:
        head: Any = self._client.head_object(Bucket=self._private_bucket, Key=key)
        self._client.copy_object(
            Bucket=self._public_bucket,
            Key=key,
            CopySource={"Bucket": self._private_bucket, "Key": key},
            MetadataDirective="REPLACE",
            ContentType=head.get("ContentType") or "application/octet-stream",
            # 非公開化後に CDN キャッシュが長く残らないよう 1 時間に抑える
            CacheControl=PUBLIC_CACHE_CONTROL,
        )
        return self.public_url(key)

    def unpublish(self, key: str) -> None:
        self._client.delete_object(Bucket=self._public_bucket, Key=key)

    def public_url(self, key: str) -> str:
        return f"{self._public_base_url}/{quote(key)}"

    # ---------------------------------------------------------------- 接続確認

    def check(self, *, timeout_s: int = 3) -> dict[str, str]:
        """両バケットへの読み取り（ListObjectsV2, MaxKeys=1）と公開ドメインへの到達を確認する。"""
        client = self._check_client(timeout_s)
        return {
            "private": self._check_bucket(client, "private", self._private_bucket),
            "public": self._check_bucket(client, "public", self._public_bucket),
            "public_url": self._check_public_url(timeout_s),
        }

    def _check_client(self, timeout_s: int) -> S3Client:
        # 通常のクライアントはリトライ 3 回・長めのタイムアウトなので、確認用は短くした別クライアントを使う
        if self._injected_client is not None:
            return self._injected_client
        return boto3.client(
            "s3",
            endpoint_url=self._endpoint_url,
            region_name="auto",
            aws_access_key_id=self._access_key_id,
            aws_secret_access_key=self._secret_access_key,
            config=Config(
                signature_version="s3v4",
                connect_timeout=timeout_s,
                read_timeout=timeout_s,
                retries={"max_attempts": 1, "mode": "standard"},
            ),
        )

    def _check_bucket(self, client: S3Client, label: str, bucket: str) -> str:
        try:
            client.list_objects_v2(Bucket=bucket, MaxKeys=1)
            return "ok"
        except ClientError as e:
            err: Any = e.response.get("Error", {})
            code = str(err.get("Code") or "client_error")
            detail = err.get("Message")
        except EndpointConnectionError as e:
            code, detail = "endpoint_unreachable", str(e)
        except (ConnectTimeoutError, ReadTimeoutError) as e:
            code, detail = "timeout", str(e)
        except NoCredentialsError as e:
            code, detail = "no_credentials", str(e)
        except BotoCoreError as e:
            code, detail = type(e).__name__, str(e)
        logger.warning(
            "storage_check_failed target=%s bucket=%s endpoint=%s code=%s detail=%s",
            label,
            bucket,
            self._endpoint_url,
            code,
            detail,
        )
        return code

    def _check_public_url(self, timeout_s: int) -> str:
        """公開ドメインに HTTP で到達できるか。ルートは 404 などになり得るので 5xx 以外を到達とみなす。"""
        url = f"{self._public_base_url}/"
        try:
            res = httpx.head(url, timeout=timeout_s, follow_redirects=False)
        except httpx.TimeoutException as e:
            code, detail = "timeout", str(e)
        except httpx.HTTPError as e:
            code, detail = "unreachable", f"{type(e).__name__}: {e}"
        else:
            if res.status_code < 500:
                return "ok"
            code, detail = f"http_{res.status_code}", res.reason_phrase
        logger.warning("storage_check_failed target=public_url url=%s code=%s detail=%s", url, code, detail)
        return code
