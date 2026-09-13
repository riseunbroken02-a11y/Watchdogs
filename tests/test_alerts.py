from bitvavo_monitor.alerts import check_portfolio_alert, check_price_alert
from bitvavo_monitor.config import PriceAlertConfig


def test_above_threshold_triggers_once_on_crossing():
    cfg = PriceAlertConfig(market="BTC-EUR", above=100)
    assert check_price_alert(cfg, current_price=101, previous_price=99) is not None
    assert check_price_alert(cfg, current_price=101, previous_price=100.5) is None


def test_below_threshold_triggers_once_on_crossing():
    cfg = PriceAlertConfig(market="BTC-EUR", below=50)
    assert check_price_alert(cfg, current_price=49, previous_price=51) is not None
    assert check_price_alert(cfg, current_price=49, previous_price=49.5) is None


def test_no_previous_price_still_triggers_threshold():
    cfg = PriceAlertConfig(market="BTC-EUR", above=100)
    assert check_price_alert(cfg, current_price=150, previous_price=None) is not None


def test_pct_change_triggers_above_threshold_either_direction():
    cfg = PriceAlertConfig(market="BTC-EUR", pct_change=5)
    assert check_price_alert(cfg, current_price=110, previous_price=100) is not None
    assert check_price_alert(cfg, current_price=90, previous_price=100) is not None
    assert check_price_alert(cfg, current_price=103, previous_price=100) is None


def test_pct_change_requires_previous_price():
    cfg = PriceAlertConfig(market="BTC-EUR", pct_change=5)
    assert check_price_alert(cfg, current_price=110, previous_price=None) is None


def test_no_thresholds_configured_never_triggers():
    cfg = PriceAlertConfig(market="BTC-EUR")
    assert check_price_alert(cfg, current_price=999999, previous_price=1) is None


def test_portfolio_alert_triggers_above_threshold():
    alert = check_portfolio_alert(current_value=110, previous_value=100,
                                   pct_change_threshold=5, valuation_asset="EUR")
    assert alert is not None
    assert "up" in alert.message


def test_portfolio_alert_no_previous_value():
    alert = check_portfolio_alert(current_value=110, previous_value=None,
                                   pct_change_threshold=5, valuation_asset="EUR")
    assert alert is None


def test_portfolio_alert_below_threshold_does_not_trigger():
    alert = check_portfolio_alert(current_value=102, previous_value=100,
                                   pct_change_threshold=5, valuation_asset="EUR")
    assert alert is None
