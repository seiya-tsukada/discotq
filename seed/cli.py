"""seed 動画のメンテナンス CLI。リポジトリ直下で実行する。

    .venv/bin/python -m seed apply   [slug ...] [--dry-run]   未登録の seed を登録して公開
    .venv/bin/python -m seed list                              登録状況の一覧
    .venv/bin/python -m seed verify                            DB と R2 の不整合を検出（あれば終了コード 1）
    .venv/bin/python -m seed replace [slug ...] [--dry-run]   ファイル・タイトル・説明の変更を反映
    .venv/bin/python -m seed remove  [slug ...] [--dry-run] [--yes]
                                                               seed を削除（slug 省略時は全件）

接続先は .env / .env.local（または環境変数）の DATABASE_URL と R2_* を使う。
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from urllib.parse import urlsplit

from backend.app.config import get_settings
from backend.app.db import connect
from backend.app.deps import get_storage
from backend.app.observability import describe_db_target
from seed import operations as ops
from seed.manifest import DEFAULT_FILES_DIR, DEFAULT_MANIFEST, ManifestError, load_manifest

LABELS = {
    "created": "作成",
    "updated": "更新",
    "removed": "削除",
    "skipped": "スキップ",
    "unchanged": "変更なし",
    "error": "エラー",
    "planned": "予定",
}


def _print_results(results: list[ops.Result]) -> int:
    for r in results:
        print(f"[{LABELS[r.outcome]}] {r.slug}: {r.detail}")
    counts: dict[str, int] = {}
    for r in results:
        counts[r.outcome] = counts.get(r.outcome, 0) + 1
    print("合計: " + (", ".join(f"{LABELS[k]} {v}" for k, v in counts.items()) or "対象なし"))
    return 1 if counts.get("error") else 0


def _mark(value: bool | None) -> str:
    return "-" if value is None else ("○" if value else "×")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m seed", description="seed 動画のメンテナンス")
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST, help="マニフェストのパス")
    parser.add_argument("--files-dir", type=Path, default=DEFAULT_FILES_DIR, help="動画ファイルの置き場所")
    sub = parser.add_subparsers(dest="command", required=True)
    for name, help_text in (
        ("apply", "未登録の seed を登録して公開する"),
        ("replace", "登録済み seed のファイル・タイトル・説明を更新する"),
    ):
        p = sub.add_parser(name, help=help_text)
        p.add_argument("slugs", nargs="*", help="対象の slug（省略時はマニフェストの全件）")
        p.add_argument("--dry-run", action="store_true", help="変更せずに予定だけ表示する")
    sub.add_parser("list", help="登録状況を一覧表示する")
    sub.add_parser("verify", help="DB と R2 の不整合を検出する")
    p = sub.add_parser("remove", help="seed を削除する（R2 と DB の両方）")
    p.add_argument("slugs", nargs="*", help="対象の slug（省略時は全件）")
    p.add_argument("--dry-run", action="store_true", help="変更せずに予定だけ表示する")
    p.add_argument("--yes", action="store_true", help="確認を省略する")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        entries = load_manifest(args.manifest, args.files_dir)
    except ManifestError as e:
        print(f"マニフェストのエラー: {e}", file=sys.stderr)
        return 2

    settings = get_settings()
    storage = get_storage()
    database_url = settings.database_url.get_secret_value()
    print(
        f"接続先: DB={describe_db_target(database_url)} R2={urlsplit(settings.r2_endpoint).hostname} "
        f"buckets={settings.r2_bucket_private},{settings.r2_bucket_public}"
    )

    with connect(database_url) as conn:
        try:
            if args.command == "apply":
                return _print_results(
                    ops.apply(conn, storage, settings, entries, slugs=args.slugs, dry_run=args.dry_run)
                )
            if args.command == "replace":
                return _print_results(
                    ops.replace(conn, storage, settings, entries, slugs=args.slugs, dry_run=args.dry_run)
                )
            if args.command == "list":
                rows = ops.list_status(conn, storage, entries)
                print("slug\tstatus\tprivate\tthumb\tpublic\tpublic_url")
                for row in rows:
                    slug = row.slug + ("" if row.in_manifest else " (マニフェスト外)")
                    print(
                        f"{slug}\t{row.status or '未登録'}\t{_mark(row.private_video if row.status else None)}"
                        f"\t{_mark(row.private_thumb)}\t{_mark(row.public_video if row.status else None)}"
                        f"\t{row.public_url or '-'}"
                    )
                print(f"合計: {len(rows)} 件（○=あり ×=なし -=対象外）")
                return 0
            if args.command == "verify":
                issues = ops.verify(conn, storage, entries)
                for issue in issues:
                    print(f"[不整合] {issue.slug}: {issue.message}")
                print("不整合はありません" if not issues else f"合計: {len(issues)} 件")
                return 1 if issues else 0
            if args.command == "remove":
                targets = ops.resolve_targets(conn, entries, args.slugs)
                if not targets:
                    print("削除対象がありません")
                    return 0
                if not args.dry_run and not args.yes:
                    print("次の seed を R2 と DB から削除します（元に戻せません）:")
                    for slug, video_id in targets:
                        print(f"  - {slug} ({video_id})")
                    if input("実行するには yes と入力してください: ").strip() != "yes":
                        print("中止しました")
                        return 1
                return _print_results(ops.remove(conn, storage, targets, dry_run=args.dry_run))
        except ops.SeedError as e:
            print(f"エラー: {e}", file=sys.stderr)
            return 2
    return 0
