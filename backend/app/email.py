"""メール送信（Resend）。ローカル開発では EMAIL_BACKEND=console で標準出力に出す。"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Protocol

import httpx

logger = logging.getLogger(__name__)

RESEND_ENDPOINT = "https://api.resend.com/emails"


@dataclass(frozen=True)
class EmailMessage:
    to: str
    subject: str
    text: str


class EmailSender(Protocol):
    def send(self, message: EmailMessage) -> None: ...


class ResendEmailSender:
    def __init__(self, api_key: str, sender: str, client: httpx.Client | None = None) -> None:
        self._api_key = api_key
        self._sender = sender
        self._client = client or httpx.Client(timeout=10)

    def send(self, message: EmailMessage) -> None:
        res = self._client.post(
            RESEND_ENDPOINT,
            headers={"Authorization": f"Bearer {self._api_key}"},
            json={
                "from": self._sender,
                "to": [message.to],
                "subject": message.subject,
                "text": message.text,
            },
        )
        if res.status_code >= 400:
            # 宛先などの個人情報はログに出さない
            logger.error("Resend API error: status=%s body=%s", res.status_code, res.text[:500])
            res.raise_for_status()


class ConsoleEmailSender:
    def __init__(self) -> None:
        self.outbox: list[EmailMessage] = []

    def send(self, message: EmailMessage) -> None:
        self.outbox.append(message)
        print(f"[email] to={message.to} subject={message.subject}\n{message.text}\n", flush=True)


def verification_email(to: str, link: str) -> EmailMessage:
    return EmailMessage(
        to=to,
        subject="【DiscoTQ】メールアドレスの確認",
        text=(
            "DiscoTQ へのご登録ありがとうございます。\n"
            "以下のリンクを開いてメールアドレスを確認してください（24時間有効）。\n\n"
            f"{link}\n\n"
            "このメールに心当たりがない場合は破棄してください。"
        ),
    )


def password_reset_email(to: str, link: str) -> EmailMessage:
    return EmailMessage(
        to=to,
        subject="【DiscoTQ】パスワードの再設定",
        text=(
            "パスワード再設定のリクエストを受け付けました。\n"
            "以下のリンクから新しいパスワードを設定してください（1時間有効）。\n\n"
            f"{link}\n\n"
            "このメールに心当たりがない場合は破棄してください。パスワードは変更されません。"
        ),
    )
