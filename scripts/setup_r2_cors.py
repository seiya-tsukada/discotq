#!/usr/bin/env python
"""R2 バケットに CORS 設定を投入する。

ブラウザから署名付き URL へ直接 PUT（private）し、承認済み動画を GET/HEAD（public）するために必要。

使い方（リポジトリ直下で、R2_* の環境変数を設定して実行）:

    .venv/bin/python scripts/setup_r2_cors.py \\
        --origin https://discotq.example.com \\
        --origin http://localhost:3000 \\
        --vercel-preview-project discotq --vercel-team your-team

    # 投入せずに内容だけ確認
    .venv/bin/python scripts/setup_r2_cors.py --origin https://discotq.example.com --dry-run

--origin を省略すると CORS_ALLOWED_ORIGINS（カンマ区切り）を使う。
注意: R2 の CORS の AllowedOrigins はワイルドカードを 1 つまで含められる（例: https://discotq-*-team.vercel.app）。
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any

import boto3
from botocore.config import Config

MAX_AGE_SECONDS = 3600


def build_rules(origins: list[str]) -> dict[str, list[dict[str, Any]]]:
    return {
        "CORSRules": [
            {
                "AllowedOrigins": origins,
                "AllowedMethods": ["PUT", "GET", "HEAD"],
                # 署名付き PUT では Content-Type を送る
                "AllowedHeaders": ["Content-Type", "Content-Length"],
                "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
                "MaxAgeSeconds": MAX_AGE_SECONDS,
            }
        ]
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--origin", action="append", default=[], help="許可するオリジン（複数指定可）")
    parser.add_argument("--vercel-preview-project", help="Vercel のプロジェクト名（プレビュー URL を許可する）")
    parser.add_argument("--vercel-team", help="Vercel のチーム（スコープ）名")
    parser.add_argument("--bucket", action="append", help="対象バケット（既定: R2_BUCKET_PRIVATE と R2_BUCKET_PUBLIC）")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    origins = list(args.origin)
    if not origins:
        origins = [o.strip() for o in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",") if o.strip()]
    if args.vercel_preview_project:
        if not args.vercel_team:
            sys.exit("--vercel-preview-project には --vercel-team も指定してください")
        # 例: https://discotq-git-feature-x-team.vercel.app / https://discotq-abc123-team.vercel.app
        origins.append(f"https://{args.vercel_preview_project}-*-{args.vercel_team}.vercel.app")
    if not origins:
        sys.exit("--origin か CORS_ALLOWED_ORIGINS で許可するオリジンを指定してください")

    buckets = args.bucket or [os.environ.get("R2_BUCKET_PRIVATE"), os.environ.get("R2_BUCKET_PUBLIC")]
    buckets = [b for b in buckets if b]
    if not buckets:
        sys.exit("対象バケットがありません（--bucket か R2_BUCKET_PRIVATE / R2_BUCKET_PUBLIC）")

    rules = build_rules(origins)
    print(json.dumps({"buckets": buckets, **rules}, indent=2, ensure_ascii=False))
    if args.dry_run:
        return

    endpoint = os.environ.get("R2_ENDPOINT_URL") or f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com"
    client = boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name="auto",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        config=Config(signature_version="s3v4"),
    )
    for bucket in buckets:
        client.put_bucket_cors(Bucket=bucket, CORSConfiguration=rules)  # type: ignore[arg-type]
        current = client.get_bucket_cors(Bucket=bucket)["CORSRules"]
        print(f"✔ {bucket}: {len(current)} rule(s) applied")


if __name__ == "__main__":
    main()
