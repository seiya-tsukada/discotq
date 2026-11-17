#!/usr/bin/env python
"""管理者アカウントの作成・登録・パスワード再設定を行う CLI。

Vercel 用の DATABASE_URL（transaction pooler・6543・パスワード入り）は使わない。
ポート 5432（Supabase の直接接続か session pooler）に接続し、DB のパスワードは
psql と同じく実行時に入力する（画面に表示せず、シェルの履歴にも残らない）。

使い方（リポジトリ直下で実行。接続先は --host / --user か、PGHOST / PGUSER で指定）:

    # 新規ユーザーを作成して管理者にする（メール確認済みとして作成）
    .venv/bin/python scripts/create_admin.py create admin@example.com \\
        --host aws-0-ap-northeast-1.pooler.supabase.com --user postgres.<project-ref>

    # 接続先は環境変数でも指定できる（psql と同じ PGHOST / PGPORT / PGUSER / PGDATABASE）
    export PGHOST=aws-0-ap-northeast-1.pooler.supabase.com PGUSER=postgres.<project-ref>
    .venv/bin/python scripts/create_admin.py list

    # 既存ユーザーを管理者にする / 外す
    .venv/bin/python scripts/create_admin.py grant user@example.com --note "審査担当"
    .venv/bin/python scripts/create_admin.py revoke user@example.com

    # パスワードを再設定する（全セッションを失効させる）
    .venv/bin/python scripts/create_admin.py reset-password admin@example.com

接続文字列で指定する場合は --db-url を使う。パスワードは含めないこと
（例: postgresql://postgres.<project-ref>@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres）。

DB のパスワードの入力を省くには、psql と同じく ~/.pgpass か PGPASSWORD を使える。
"""

from __future__ import annotations

import argparse
import getpass
import os
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import psycopg  # noqa: E402
from email_validator import EmailNotValidError, validate_email  # noqa: E402
from psycopg.conninfo import conninfo_to_dict  # noqa: E402
from psycopg.rows import dict_row  # noqa: E402

from backend.app.db import Conn  # noqa: E402
from backend.app.repositories import users as users_repo  # noqa: E402
from backend.app.repositories.audit import write_audit_log  # noqa: E402
from backend.app.security import PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, hash_password  # noqa: E402

DEFAULT_PORT = "5432"
TRANSACTION_POOLER_PORT = "6543"
CONNECT_TIMEOUT_S = 10


# ---------------------------------------------------------------- DB 接続


def build_conn_params(
    *,
    db_url: str | None,
    host: str | None,
    port: str | None,
    user: str | None,
    dbname: str | None,
) -> dict[str, str]:
    """接続先を組み立てる。パスワードは含めない（実行時に入力させる）。

    優先順位: --host などの個別指定 > --db-url > PGHOST などの環境変数 > 既定値（port=5432, dbname=postgres）。
    """
    params: dict[str, str] = {}
    if db_url:
        try:
            params = {k: str(v) for k, v in conninfo_to_dict(db_url).items() if v is not None}
        except psycopg.ProgrammingError:
            sys.exit("--db-url の形式が正しくありません")
        if params.get("password"):
            sys.exit(
                "--db-url にパスワードを含めないでください（「ユーザー名:パスワード@」の「:パスワード」を消す）。"
                "パスワードは実行時に入力します"
            )
    for key, value in (("host", host), ("port", port), ("user", user), ("dbname", dbname)):
        if value:
            params[key] = value
    for key, env in (("host", "PGHOST"), ("port", "PGPORT"), ("user", "PGUSER"), ("dbname", "PGDATABASE")):
        if not params.get(key) and os.environ.get(env):
            params[key] = os.environ[env]
    params.setdefault("port", DEFAULT_PORT)
    params.setdefault("dbname", "postgres")
    params.setdefault("sslmode", "require")

    if not params.get("host"):
        sys.exit("接続先のホストを --host（または PGHOST / --db-url）で指定してください")
    if not params.get("user"):
        sys.exit("接続ユーザーを --user（または PGUSER / --db-url）で指定してください")
    if params["port"] == TRANSACTION_POOLER_PORT:
        sys.exit(
            "ポート 6543（transaction pooler）は Vercel 用です。"
            "このスクリプトでは 5432（直接接続か session pooler）を使ってください"
        )
    return params


def describe_target(params: dict[str, str]) -> str:
    return f"{params['user']}@{params['host']}:{params['port']}/{params['dbname']}"


def _needs_password(error: psycopg.OperationalError) -> bool:
    # libpq はパスワードが無いと "fe_sendauth: no password supplied" を返す（psql と同じ判定）
    return "no password supplied" in str(error)


def _connect(params: dict[str, str], password: str | None = None) -> Conn:
    kwargs: dict[str, Any] = dict(params)
    if password is not None:
        kwargs["password"] = password
    return psycopg.connect(
        **kwargs, prepare_threshold=None, row_factory=dict_row, connect_timeout=CONNECT_TIMEOUT_S
    )


def connect_with_prompt(params: dict[str, str]) -> Conn:
    """psql と同じく、まずパスワードなしで接続し、要求されたら入力させて接続し直す。

    PGPASSWORD や ~/.pgpass があれば libpq がそれを使うので、入力は求めない。
    """
    target = describe_target(params)
    try:
        return _connect(params)
    except psycopg.OperationalError as e:
        if not _needs_password(e):
            sys.exit(f"DB に接続できません（{target}）: {_one_line(e)}")
    password = getpass.getpass(f"DB パスワード（{target}）: ")
    try:
        return _connect(params, password)
    except psycopg.OperationalError as e:
        sys.exit(f"DB に接続できません（{target}）: {_one_line(e)}")


def _one_line(error: Exception) -> str:
    return " ".join(str(error).split())


# ---------------------------------------------------------------- 管理者の操作


def _prompt_password() -> str:
    env = os.environ.get("ADMIN_PASSWORD")
    if env:
        password = env
    else:
        password = getpass.getpass("管理者アカウントのパスワード: ")
        if password != getpass.getpass("管理者アカウントのパスワード（確認）: "):
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


# ---------------------------------------------------------------- 引数


def build_parser() -> argparse.ArgumentParser:
    # 接続オプションは各サブコマンドに持たせ、サブコマンドの前後どちらにも書けるようにする
    conn_opts = argparse.ArgumentParser(add_help=False)
    g = conn_opts.add_argument_group("DB 接続（ポート 5432。パスワードは実行時に入力）")
    g.add_argument("--db-url", default=None, help="パスワードを含まない接続文字列")
    g.add_argument("--host", default=None, help="ホスト（既定: PGHOST）")
    g.add_argument("--port", default=None, help=f"ポート（既定: PGPORT か {DEFAULT_PORT}）")
    g.add_argument("--user", default=None, help="ユーザー（既定: PGUSER）")
    g.add_argument("--dbname", default=None, help="データベース名（既定: PGDATABASE か postgres）")

    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("create", parents=[conn_opts], help="ユーザーを作成して管理者にする")
    p.add_argument("email")
    p.add_argument("--name", default=None, help="表示名")
    p.add_argument("--note", default=None, help="メモ（担当など）")
    p = sub.add_parser("grant", parents=[conn_opts], help="既存ユーザーを管理者にする")
    p.add_argument("email")
    p.add_argument("--note", default=None)
    p = sub.add_parser("revoke", parents=[conn_opts], help="管理者から外す")
    p.add_argument("email")
    p = sub.add_parser("reset-password", parents=[conn_opts], help="パスワードを再設定する")
    p.add_argument("email")
    sub.add_parser("list", parents=[conn_opts], help="管理者一覧")
    return parser


def main(argv: list[str] | None = None) -> None:
    args = build_parser().parse_args(argv)
    params = build_conn_params(
        db_url=args.db_url, host=args.host, port=args.port, user=args.user, dbname=args.dbname
    )
    handlers = {
        "create": cmd_create,
        "grant": cmd_grant,
        "revoke": cmd_revoke,
        "reset-password": cmd_reset_password,
        "list": cmd_list,
    }
    with connect_with_prompt(params) as conn:
        handlers[args.command](conn, args)


if __name__ == "__main__":
    main()
