#!/usr/bin/env python
"""管理者アカウントの作成・登録・パスワード再設定を行う CLI。

使い方（リポジトリ直下で、DATABASE_URL などの環境変数を設定して実行）:

    # 新規ユーザーを作成して管理者にする（パスワードは対話入力。メール確認済みとして作成）
    .venv/bin/python scripts/create_admin.py create admin@example.com

    # 既存ユーザーを管理者にする / 外す
    .venv/bin/python scripts/create_admin.py grant user@example.com --note "審査担当"
    .venv/bin/python scripts/create_admin.py revoke user@example.com

    # パスワードを再設定する（全セッションを失効させる）
    .venv/bin/python scripts/create_admin.py reset-password admin@example.com

    # 管理者一覧
    .venv/bin/python scripts/create_admin.py list

DATABASE_URL 以外の設定は不要（このスクリプトは Settings を読み込まない）。
"""

from __future__ import annotations

import argparse
import getpass
import os
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from email_validator import EmailNotValidError, validate_email  # noqa: E402

from backend.app.db import Conn, connect  # noqa: E402
from backend.app.repositories import users as users_repo  # noqa: E402
from backend.app.repositories.audit import write_audit_log  # noqa: E402
from backend.app.security import PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, hash_password  # noqa: E402


def _prompt_password() -> str:
    env = os.environ.get("ADMIN_PASSWORD")
    if env:
        password = env
    else:
        password = getpass.getpass("パスワード: ")
        if password != getpass.getpass("パスワード（確認）: "):
            sys.exit("パスワードが一致しません")
    if not PASSWORD_MIN_LENGTH <= len(password) <= PASSWORD_MAX_LENGTH:
        sys.exit(f"パスワードは {PASSWORD_MIN_LENGTH}〜{PASSWORD_MAX_LENGTH} 文字にしてください")
    return password


def _require_user(conn: Conn, email: str) -> dict[str, Any]:
    row = users_repo.find_user_by_email(conn, email)
    if row is None:
        sys.exit(f"ユーザーが見つかりません: {email}")
    return row


def _audit(conn: Conn, action: str, user_id: object, payload: dict[str, object] | None = None) -> None:
    write_audit_log(
        conn,
        actor_type="system",
        actor_id=f"cli:{getpass.getuser()}",
        action=action,
        target_type="user",
        target_id=str(user_id),
        payload=payload,
    )


def _validate_email(email: str) -> str:
    # API（EmailStr）と同じ検証をかけ、ログインできないアドレスで作成しないようにする
    try:
        return validate_email(email, check_deliverability=False).normalized
    except EmailNotValidError as e:
        sys.exit(f"メールアドレスが不正です: {e}")


def cmd_create(conn: Conn, args: argparse.Namespace) -> None:
    args.email = _validate_email(args.email)
    if users_repo.find_user_by_email(conn, args.email):
        sys.exit("既に登録済みのメールアドレスです。grant を使ってください")
    row = users_repo.create_user(
        conn, email=args.email, password_hash=hash_password(_prompt_password()), display_name=args.name
    )
    users_repo.mark_email_verified(conn, row["id"])
    conn.execute(
        "insert into discotq.admins (user_id, note) values (%s, %s)", (row["id"], args.note)
    )
    _audit(conn, "admin.create", row["id"])
    print(f"管理者を作成しました: {args.email} ({row['id']})")


def cmd_grant(conn: Conn, args: argparse.Namespace) -> None:
    row = _require_user(conn, args.email)
    conn.execute(
        """
        insert into discotq.admins (user_id, note) values (%s, %s)
        on conflict (user_id) do update set note = coalesce(excluded.note, discotq.admins.note)
        """,
        (row["id"], args.note),
    )
    _audit(conn, "admin.grant", row["id"])
    verified = row["email_verified_at"] is not None
    print(f"管理者に登録しました: {args.email}" + ("" if verified else "（※メール未確認のため確認後に利用可能）"))


def cmd_revoke(conn: Conn, args: argparse.Namespace) -> None:
    row = _require_user(conn, args.email)
    conn.execute("delete from discotq.admins where user_id = %s", (row["id"],))
    _audit(conn, "admin.revoke", row["id"])
    print(f"管理者から外しました: {args.email}")


def cmd_reset_password(conn: Conn, args: argparse.Namespace) -> None:
    row = _require_user(conn, args.email)
    users_repo.update_password(conn, row["id"], hash_password(_prompt_password()))
    users_repo.delete_user_sessions(conn, row["id"])
    _audit(conn, "user.password_reset_by_cli", row["id"])
    print(f"パスワードを再設定し、全セッションを失効させました: {args.email}")


def cmd_list(conn: Conn, _: argparse.Namespace) -> None:
    rows = conn.execute(
        """
        select u.email, u.email_verified_at is not null as verified, a.note, a.created_at
        from discotq.admins a join discotq.users u on u.id = a.user_id
        order by a.created_at
        """
    ).fetchall()
    for r in rows:
        print(f"{r['email']}\tverified={r['verified']}\t{r['note'] or ''}\t{r['created_at']:%Y-%m-%d}")
    if not rows:
        print("（管理者はいません）")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("create", help="ユーザーを作成して管理者にする")
    p.add_argument("email")
    p.add_argument("--name", default=None, help="表示名")
    p.add_argument("--note", default=None, help="メモ（担当など）")
    p = sub.add_parser("grant", help="既存ユーザーを管理者にする")
    p.add_argument("email")
    p.add_argument("--note", default=None)
    p = sub.add_parser("revoke", help="管理者から外す")
    p.add_argument("email")
    p = sub.add_parser("reset-password", help="パスワードを再設定する")
    p.add_argument("email")
    sub.add_parser("list", help="管理者一覧")
    args = parser.parse_args()

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        sys.exit("DATABASE_URL を設定してください")
    handlers = {
        "create": cmd_create,
        "grant": cmd_grant,
        "revoke": cmd_revoke,
        "reset-password": cmd_reset_password,
        "list": cmd_list,
    }
    with connect(database_url) as conn:
        handlers[args.command](conn, args)


if __name__ == "__main__":
    main()
