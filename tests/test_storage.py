import tempfile
from pathlib import Path

from bitvavo_monitor.storage import Storage


def test_record_and_read_last_price():
    with tempfile.TemporaryDirectory() as tmp:
        db_path = Path(tmp) / "history.db"
        with Storage(db_path) as storage:
            assert storage.last_price("BTC-EUR") is None

            storage.record_prices({"BTC-EUR": 100.0}, ts=1000)
            storage.record_prices({"BTC-EUR": 110.0}, ts=2000)

            assert storage.last_price("BTC-EUR") == 110.0
            assert storage.last_price("BTC-EUR", before_ts=2000) == 100.0


def test_record_and_read_portfolio_value():
    with tempfile.TemporaryDirectory() as tmp:
        db_path = Path(tmp) / "history.db"
        with Storage(db_path) as storage:
            assert storage.last_portfolio_value() is None
            storage.record_portfolio_value(1000.0, "EUR", ts=1000)
            storage.record_portfolio_value(1100.0, "EUR", ts=2000)
            assert storage.last_portfolio_value() == 1100.0


def test_alert_state_roundtrip():
    with tempfile.TemporaryDirectory() as tmp:
        db_path = Path(tmp) / "history.db"
        with Storage(db_path) as storage:
            assert storage.get_alert_state("BTC-EUR:above") == (None, None)
            storage.set_alert_state("BTC-EUR:above", 100.0, ts=5000)
            value, ts = storage.get_alert_state("BTC-EUR:above")
            assert value == 100.0
            assert ts == 5000
