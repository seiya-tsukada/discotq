"""Cloudflare R2（S3 互換 API）実装。"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any
from urllib.parse import quote

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from backend.app.storage.base import ObjectInfo, PresignedUpload

if TYPE_CHECKING:
    from mypy_boto3_s3 import S3Client


PUBLIC_CACHE_CONTROL = "public, max-age=3600"


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
