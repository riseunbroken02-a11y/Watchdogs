"""Orchestrates one monitoring cycle: fetch data, log it, check alerts, notify."""
from __future__ import annotations

import argparse
import logging
import time

from bitvavo_monitor.alerts import Alert, check_portfolio_alert, check_price_alert
from bitvavo_monitor.client import BitvavoClient, BitvavoCredentials
from bitvavo_monitor.config import Settings, load_settings
from bitvavo_monitor.notifier import EmailNotifier
from bitvavo_monitor.storage import Storage

logger = logging.getLogger("bitvavo_monitor")


def _markets_to_fetch(settings: Settings) -> set[str]:
    markets = set(settings.monitor.watch_markets)
    markets.update(alert.market for alert in settings.monitor.price_alerts)
    return markets


def _portfolio_value(balance: list[dict], prices: dict[str, float], valuation_asset: str) -> float:
    total = 0.0
    for entry in balance:
        symbol = entry["symbol"]
        quantity = float(entry.get("available", 0)) + float(entry.get("inOrder", 0))
        if quantity == 0:
            continue
        if symbol == valuation_asset:
            total += quantity
            continue
        market = f"{symbol}-{valuation_asset}"
        price = prices.get(market)
        if price is None:
            logger.warning("No price for %s, skipping in portfolio valuation", market)
            continue
        total += quantity * price
    return total


def run_once(settings: Settings, client: BitvavoClient, storage: Storage) -> list[Alert]:
    triggered: list[Alert] = []
    now = int(time.time())

    wanted_markets = _markets_to_fetch(settings)
    all_prices = client.get_prices()
    prices = {m: all_prices[m] for m in wanted_markets if m in all_prices}

    for alert_config in settings.monitor.price_alerts:
        current = prices.get(alert_config.market)
        if current is None:
            logger.warning("No price for %s, skipping alert check", alert_config.market)
            continue
        previous = storage.last_price(alert_config.market)
        alert = check_price_alert(alert_config, current, previous)
        if alert:
            triggered.append(alert)

    storage.record_prices(prices, ts=now)

    if settings.api_key and settings.api_secret:
        balance = client.get_balance()
        valuation_asset = settings.monitor.portfolio_valuation_asset
        total_value = _portfolio_value(balance, all_prices, valuation_asset)
        previous_value = storage.last_portfolio_value()

        portfolio_alert = check_portfolio_alert(
            total_value, previous_value,
            settings.monitor.portfolio_pct_change_alert, valuation_asset,
        )
        if portfolio_alert:
            triggered.append(portfolio_alert)

        storage.record_portfolio_value(total_value, valuation_asset, ts=now)
        logger.info("Portfolio value: %.2f %s", total_value, valuation_asset)
    else:
        logger.info("No API credentials configured, skipping balance/portfolio checks")

    return triggered


def dispatch_alerts(settings: Settings, alerts: list[Alert]) -> None:
    if not alerts:
        return
    for alert in alerts:
        logger.warning("ALERT: %s", alert.message)

    if settings.email and settings.monitor.alert_email_to:
        notifier = EmailNotifier(settings.email, settings.monitor.alert_email_to)
        body = "\n".join(alert.message for alert in alerts)
        subject = alerts[0].subject if len(alerts) == 1 else f"{len(alerts)} new alerts"
        notifier.send(subject, body)
    elif alerts:
        logger.warning("Email not configured, alerts were only logged")


def main() -> None:
    parser = argparse.ArgumentParser(description="Bitvavo price and portfolio monitor")
    parser.add_argument("--config", default="config.yaml", help="Path to config.yaml")
    parser.add_argument("--once", action="store_true", help="Run a single check and exit")
    parser.add_argument("--interval", type=int, help="Override check_interval_seconds")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    settings = load_settings(args.config)
    interval = args.interval or settings.monitor.check_interval_seconds

    credentials = None
    if settings.api_key and settings.api_secret:
        credentials = BitvavoCredentials(settings.api_key, settings.api_secret)
    client = BitvavoClient(credentials)
    storage = Storage(settings.monitor.db_path)

    try:
        while True:
            try:
                alerts = run_once(settings, client, storage)
                dispatch_alerts(settings, alerts)
            except Exception:
                logger.exception("Monitoring cycle failed")

            if args.once:
                break
            time.sleep(interval)
    finally:
        storage.close()


if __name__ == "__main__":
    main()
