"""Configuration loading: non-secret settings from YAML, secrets from environment."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

import yaml


@dataclass
class PriceAlertConfig:
    market: str
    above: float | None = None
    below: float | None = None
    pct_change: float | None = None  # alert if price moves +/- this % since last check


@dataclass
class MonitorConfig:
    watch_markets: list[str] = field(default_factory=lambda: ["BTC-EUR"])
    price_alerts: list[PriceAlertConfig] = field(default_factory=list)
    portfolio_pct_change_alert: float | None = None
    portfolio_valuation_asset: str = "EUR"
    check_interval_seconds: int = 300
    alert_email_to: str | None = None
    db_path: str = "data/history.db"


@dataclass
class EmailSettings:
    smtp_host: str
    smtp_port: int
    smtp_user: str
    smtp_password: str
    from_address: str
    use_tls: bool = True


@dataclass
class Settings:
    monitor: MonitorConfig
    api_key: str | None
    api_secret: str | None
    email: EmailSettings | None


def _load_yaml(path: Path) -> dict:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def load_settings(config_path: str | Path = "config.yaml") -> Settings:
    raw = _load_yaml(Path(config_path))

    price_alerts = [
        PriceAlertConfig(
            market=item["market"],
            above=item.get("above"),
            below=item.get("below"),
            pct_change=item.get("pct_change"),
        )
        for item in raw.get("price_alerts", [])
    ]

    monitor = MonitorConfig(
        watch_markets=raw.get("watch_markets", ["BTC-EUR"]),
        price_alerts=price_alerts,
        portfolio_pct_change_alert=raw.get("portfolio_pct_change_alert"),
        portfolio_valuation_asset=raw.get("portfolio_valuation_asset", "EUR"),
        check_interval_seconds=raw.get("check_interval_seconds", 300),
        alert_email_to=raw.get("alert_email_to") or os.environ.get("ALERT_EMAIL_TO"),
        db_path=raw.get("db_path", "data/history.db"),
    )

    api_key = os.environ.get("BITVAVO_API_KEY")
    api_secret = os.environ.get("BITVAVO_API_SECRET")

    email = None
    smtp_host = os.environ.get("SMTP_HOST")
    if smtp_host:
        email = EmailSettings(
            smtp_host=smtp_host,
            smtp_port=int(os.environ.get("SMTP_PORT", "587")),
            smtp_user=os.environ.get("SMTP_USER", ""),
            smtp_password=os.environ.get("SMTP_PASSWORD", ""),
            from_address=os.environ.get("SMTP_FROM", os.environ.get("SMTP_USER", "")),
            use_tls=os.environ.get("SMTP_USE_TLS", "true").lower() != "false",
        )

    return Settings(monitor=monitor, api_key=api_key, api_secret=api_secret, email=email)
