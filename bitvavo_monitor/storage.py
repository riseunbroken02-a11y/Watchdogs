"""SQLite-backed history for prices/portfolio snapshots and alert dedupe state."""
from __future__ import annotations

import sqlite3
import time
from pathlib import Path


class Storage:
    def __init__(self, db_path: str | Path):
        self._path = Path(db_path)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(self._path)
        self._init_schema()

    def _init_schema(self) -> None:
        self._conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS price_history (
                ts INTEGER NOT NULL,
                market TEXT NOT NULL,
                price REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS portfolio_history (
                ts INTEGER NOT NULL,
                total_value REAL NOT NULL,
                valuation_asset TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS alert_state (
                key TEXT PRIMARY KEY,
                last_value REAL,
                last_triggered_ts INTEGER
            );
            CREATE INDEX IF NOT EXISTS idx_price_history_market_ts
                ON price_history(market, ts);
            """
        )
        self._conn.commit()

    def record_prices(self, prices: dict[str, float], ts: int | None = None) -> None:
        ts = ts if ts is not None else int(time.time())
        self._conn.executemany(
            "INSERT INTO price_history (ts, market, price) VALUES (?, ?, ?)",
            [(ts, market, price) for market, price in prices.items()],
        )
        self._conn.commit()

    def record_portfolio_value(self, total_value: float, valuation_asset: str,
                                ts: int | None = None) -> None:
        ts = ts if ts is not None else int(time.time())
        self._conn.execute(
            "INSERT INTO portfolio_history (ts, total_value, valuation_asset) VALUES (?, ?, ?)",
            (ts, total_value, valuation_asset),
        )
        self._conn.commit()

    def last_price(self, market: str, before_ts: int | None = None) -> float | None:
        query = "SELECT price FROM price_history WHERE market = ?"
        params: list = [market]
        if before_ts is not None:
            query += " AND ts < ?"
            params.append(before_ts)
        query += " ORDER BY ts DESC LIMIT 1"
        row = self._conn.execute(query, params).fetchone()
        return row[0] if row else None

    def last_portfolio_value(self) -> float | None:
        row = self._conn.execute(
            "SELECT total_value FROM portfolio_history ORDER BY ts DESC LIMIT 1"
        ).fetchone()
        return row[0] if row else None

    def get_alert_state(self, key: str) -> tuple[float | None, int | None]:
        row = self._conn.execute(
            "SELECT last_value, last_triggered_ts FROM alert_state WHERE key = ?", (key,)
        ).fetchone()
        return (row[0], row[1]) if row else (None, None)

    def set_alert_state(self, key: str, value: float | None, ts: int | None = None) -> None:
        ts = ts if ts is not None else int(time.time())
        self._conn.execute(
            """
            INSERT INTO alert_state (key, last_value, last_triggered_ts) VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET last_value = excluded.last_value,
                                            last_triggered_ts = excluded.last_triggered_ts
            """,
            (key, value, ts),
        )
        self._conn.commit()

    def close(self) -> None:
        self._conn.close()

    def __enter__(self) -> "Storage":
        return self

    def __exit__(self, *exc_info) -> None:
        self.close()
