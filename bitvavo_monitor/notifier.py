"""Email delivery for alerts."""
from __future__ import annotations

import smtplib
from email.message import EmailMessage

from bitvavo_monitor.config import EmailSettings


class EmailNotifier:
    def __init__(self, settings: EmailSettings, to_address: str):
        self._settings = settings
        self._to_address = to_address

    def send(self, subject: str, body: str) -> None:
        message = EmailMessage()
        message["Subject"] = f"[Bitvavo Monitor] {subject}"
        message["From"] = self._settings.from_address
        message["To"] = self._to_address
        message.set_content(body)

        with smtplib.SMTP(self._settings.smtp_host, self._settings.smtp_port, timeout=10) as smtp:
            if self._settings.use_tls:
                smtp.starttls()
            if self._settings.smtp_user:
                smtp.login(self._settings.smtp_user, self._settings.smtp_password)
            smtp.send_message(message)
