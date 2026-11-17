"""scripts/create_admin.py の接続先の組み立て・パスワード入力・各コマンド。"""

from __future__ import annotations

import importlib.util
from pathlib import Path
from types import ModuleType
from uuid import uuid4

import pytest
from psycopg.conninfo import conninfo_to_dict

from backend.tests.conftest import TEST_DATABASE_URL, requires_db


def _load_script() -> ModuleType:
    path = Path(__file__).resolve().parents[2] / "scripts" / "create_admin.py"
    spec = importlib.util.spec_from_file_location("create_admin_script", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


ca = _load_script()


@pytest.fixture(autouse=True)
def _clear_pg_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in ("PGHOST", "PGPORT", "PGUSER", "PGDATABASE", "PGPASSWORD", "ADMIN_PASSWORD"):
        monkeypatch.delenv(name, raising=False)


def _params(**kwargs: str | None) -> dict[str, str]:
    base: dict[str, str | None] = {"db_url": None, "host": None, "port": None, "user": None, "dbname": None}
    base.update(kwargs)
    result: dict[str, str] = ca.build_conn_params(**base)
    return result


# ---------------------------------------------------------------- 接続先の組み立て


def test_defaults_to_port_5432_and_requires_ssl() -> None:
    params = _params(host="db.example.test", user="postgres.ref")
    assert params == {
        "host": "db.example.test",
        "user": "postgres.ref",
        "port": "5432",
        "dbname": "postgres",
        "sslmode": "require",
    }
    assert "password" not in params


def test_reads_pg_env_vars(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PGHOST", "env-host")
    monkeypatch.setenv("PGUSER", "env-user")
    params = _params()
    assert (params["host"], params["user"]) == ("env-host", "env-user")


def test_priority_args_over_url_over_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PGHOST", "env-host")
    monkeypatch.setenv("PGUSER", "env-user")
    params = _params(db_url="postgresql://url-user@url-host:5432/postgres", user="arg-user")
    assert (params["host"], params["user"]) == ("url-host", "arg-user")


def test_rejects_password_in_url() -> None:
    with pytest.raises(SystemExit) as e:
        _params(db_url="postgresql://postgres.ref:secret@db.example.test:5432/postgres")
    assert "パスワードを含めない" in str(e.value)
    assert "secret" not in str(e.value)


def test_rejects_transaction_pooler_port() -> None:
    with pytest.raises(SystemExit) as e:
        _params(db_url="postgresql://postgres.ref@pooler.example.test:6543/postgres")
    assert "6543" in str(e.value)


@pytest.mark.parametrize("kwargs", [{"user": "u"}, {"host": "h"}])
def test_requires_host_and_user(kwargs: dict[str, str]) -> None:
    with pytest.raises(SystemExit):
        _params(**kwargs)


def test_connection_options_can_follow_subcommand() -> None:
    args = ca.build_parser().parse_args(["create", "a@example.com", "--host", "h", "--user", "u"])
    assert (args.command, args.email, args.host, args.user) == ("create", "a@example.com", "h", "u")
    args = ca.build_parser().parse_args(["list", "--db-url", "postgresql://u@h/postgres"])
    assert args.db_url == "postgresql://u@h/postgres"


# ---------------------------------------------------------------- 実 DB への接続（パスワード入力）


def _test_db_params_without_password() -> tuple[dict[str, str], str]:
    assert TEST_DATABASE_URL
    info = {k: str(v) for k, v in conninfo_to_dict(TEST_DATABASE_URL).items() if v is not None}
    password = info.pop("password")
    info["sslmode"] = "disable"  # テスト用の Postgres は SSL を使わない
    return info, password


@requires_db
def test_prompts_db_password_when_required(monkeypatch: pytest.MonkeyPatch) -> None:
    params, password = _test_db_params_without_password()
    prompts: list[str] = []

    def fake_getpass(prompt: str = "") -> str:
        prompts.append(prompt)
        return password

    monkeypatch.setattr(ca.getpass, "getpass", fake_getpass)
    with ca.connect_with_prompt(params) as conn:
        assert conn.execute("select 1 as one").fetchone() == {"one": 1}
    assert len(prompts) == 1 and prompts[0].startswith("DB パスワード")


@requires_db
def test_uses_pgpassword_without_prompt(monkeypatch: pytest.MonkeyPatch) -> None:
    params, password = _test_db_params_without_password()
    monkeypatch.setenv("PGPASSWORD", password)
    monkeypatch.setattr(ca.getpass, "getpass", lambda prompt="": pytest.fail("入力を求めないこと"))
    with ca.connect_with_prompt(params) as conn:
        assert conn.execute("select 1 as one").fetchone() == {"one": 1}


@requires_db
def test_wrong_db_password_exits_without_traceback(monkeypatch: pytest.MonkeyPatch) -> None:
    params, _ = _test_db_params_without_password()
    monkeypatch.setattr(ca.getpass, "getpass", lambda prompt="": "wrong-password")
    with pytest.raises(SystemExit) as e:
        ca.connect_with_prompt(params)
    assert "DB に接続できません" in str(e.value)
    assert "wrong-password" not in str(e.value)


@requires_db
def test_main_create_and_list(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    params, password = _test_db_params_without_password()
    url = f"postgresql://{params['user']}@{params['host']}:{params['port']}/{params['dbname']}?sslmode=disable"
    email = f"admin-{uuid4().hex[:8]}@example.com"
    answers = iter([password, "admin-password-1", "admin-password-1", password])
    monkeypatch.setattr(ca.getpass, "getpass", lambda prompt="": next(answers))

    ca.main(["create", email, "--db-url", url, "--note", "テスト"])
    ca.main(["list", "--db-url", url])

    out = capsys.readouterr().out
    assert f"管理者を作成しました: {email}" in out
    assert f"{email}\tverified=True\tテスト" in out

