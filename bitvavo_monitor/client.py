"""Minimal Bitvavo REST API client (public market data + private account data)."""
from __future__ import annotations

import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from typing import Any

import requests

BASE_URL = "https://api.bitvavo.com/v2"


class BitvavoAPIError(RuntimeError):
    """Raised when the Bitvavo API returns an error response."""


@dataclass
class BitvavoCredentials:
    api_key: str
    api_secret: str
    access_window_ms: int = 10_000


class BitvavoClient:
    """Thin wrapper around the Bitvavo v2 REST API.

    Public endpoints (ticker prices, markets) work without credentials.
    Private endpoints (balance, orders) require a `BitvavoCredentials`.
    """

    def __init__(self, credentials: BitvavoCredentials | None = None, base_url: str = BASE_URL,
                 session: requests.Session | None = None, timeout: float = 10.0):
        self._credentials = credentials
        self._base_url = base_url.rstrip("/")
        self._session = session or requests.Session()
        self._timeout = timeout

    def _sign(self, timestamp: int, method: str, path: str, body: dict | None) -> str:
        assert self._credentials is not None
        payload = "" if not body else json.dumps(body, separators=(",", ":"))
        message = f"{timestamp}{method}{path}{payload}"
        return hmac.new(
            self._credentials.api_secret.encode("utf-8"),
            message.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

    def _headers(self, method: str, path: str, body: dict | None) -> dict:
        if self._credentials is None:
            return {}
        timestamp = int(time.time() * 1000)
        signature = self._sign(timestamp, method, path, body)
        return {
            "Bitvavo-Access-Key": self._credentials.api_key,
            "Bitvavo-Access-Signature": signature,
            "Bitvavo-Access-Timestamp": str(timestamp),
            "Bitvavo-Access-Window": str(self._credentials.access_window_ms),
        }

    def _request(self, method: str, path: str, params: dict | None = None,
                 body: dict | None = None, private: bool = False) -> Any:
        if private and self._credentials is None:
            raise BitvavoAPIError(f"{path} requires API credentials but none were configured")

        url = f"{self._base_url}{path}"
        headers = self._headers(method, path, body) if private else {}
        response = self._session.request(
            method, url, params=params, json=body, headers=headers, timeout=self._timeout
        )
        try:
            data = response.json()
        except ValueError:
            response.raise_for_status()
            raise BitvavoAPIError(f"Non-JSON response from {path}: {response.text[:200]}")

        if response.status_code >= 400 or (isinstance(data, dict) and "errorCode" in data):
            message = data.get("error", data) if isinstance(data, dict) else data
            raise BitvavoAPIError(f"Bitvavo API error on {path}: {message}")
        return data

    # ---- Public endpoints -------------------------------------------------

    def get_markets(self) -> list[dict]:
        return self._request("GET", "/markets")

    def get_price(self, market: str) -> float:
        data = self._request("GET", "/ticker/price", params={"market": market})
        return float(data["price"])

    def get_prices(self) -> dict[str, float]:
        data = self._request("GET", "/ticker/price")
        return {item["market"]: float(item["price"]) for item in data}

    # ---- Private endpoints --------------------------------------------------

    def get_balance(self) -> list[dict]:
        """Returns [{"symbol": "BTC", "available": "0.5", "inOrder": "0.0"}, ...]."""
        return self._request("GET", "/balance", private=True)

    def get_open_orders(self, market: str | None = None) -> list[dict]:
        params = {"market": market} if market else None
        return self._request("GET", "/orders/open", params=params, private=True)
