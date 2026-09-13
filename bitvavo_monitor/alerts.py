"""Pure threshold-checking logic, decoupled from storage/network for easy testing."""
from __future__ import annotations

from dataclasses import dataclass

from bitvavo_monitor.config import PriceAlertConfig


@dataclass
class Alert:
    subject: str
    message: str


def check_price_alert(config: PriceAlertConfig, current_price: float,
                       previous_price: float | None) -> Alert | None:
    """Returns an Alert if `current_price` crosses one of the configured thresholds."""
    if config.above is not None and current_price >= config.above:
        if previous_price is None or previous_price < config.above:
            return Alert(
                subject=f"{config.market} above {config.above}",
                message=f"{config.market} is now {current_price} (>= {config.above})",
            )

    if config.below is not None and current_price <= config.below:
        if previous_price is None or previous_price > config.below:
            return Alert(
                subject=f"{config.market} below {config.below}",
                message=f"{config.market} is now {current_price} (<= {config.below})",
            )

    if config.pct_change is not None and previous_price:
        change_pct = (current_price - previous_price) / previous_price * 100
        if abs(change_pct) >= config.pct_change:
            direction = "up" if change_pct > 0 else "down"
            return Alert(
                subject=f"{config.market} moved {direction} {abs(change_pct):.2f}%",
                message=(
                    f"{config.market} moved {direction} {abs(change_pct):.2f}% "
                    f"({previous_price} -> {current_price})"
                ),
            )

    return None


def check_portfolio_alert(current_value: float, previous_value: float | None,
                           pct_change_threshold: float | None,
                           valuation_asset: str) -> Alert | None:
    """Returns an Alert if the portfolio value moved more than `pct_change_threshold`%."""
    if pct_change_threshold is None or not previous_value:
        return None

    change_pct = (current_value - previous_value) / previous_value * 100
    if abs(change_pct) < pct_change_threshold:
        return None

    direction = "up" if change_pct > 0 else "down"
    return Alert(
        subject=f"Portfolio {direction} {abs(change_pct):.2f}%",
        message=(
            f"Portfolio value moved {direction} {abs(change_pct):.2f}% "
            f"({previous_value:.2f} -> {current_value:.2f} {valuation_asset})"
        ),
    )
