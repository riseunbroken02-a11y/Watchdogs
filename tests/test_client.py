import hashlib
import hmac
import json

from bitvavo_monitor.client import BitvavoClient, BitvavoCredentials


def test_signature_matches_documented_scheme():
    creds = BitvavoCredentials(api_key="key123", api_secret="secret456")
    client = BitvavoClient(creds)

    timestamp = 1_700_000_000_000
    body = {"market": "BTC-EUR"}
    signature = client._sign(timestamp, "GET", "/balance", body)

    payload = json.dumps(body, separators=(",", ":"))
    expected_message = f"{timestamp}GET/balance{payload}"
    expected = hmac.new(b"secret456", expected_message.encode(), hashlib.sha256).hexdigest()

    assert signature == expected


def test_signature_with_no_body():
    creds = BitvavoCredentials(api_key="key123", api_secret="secret456")
    client = BitvavoClient(creds)

    timestamp = 1_700_000_000_000
    signature = client._sign(timestamp, "GET", "/balance", None)

    expected_message = f"{timestamp}GET/balance"
    expected = hmac.new(b"secret456", expected_message.encode(), hashlib.sha256).hexdigest()

    assert signature == expected


def test_headers_empty_without_credentials():
    client = BitvavoClient(credentials=None)
    assert client._headers("GET", "/balance", None) == {}


def test_get_price_parses_float(monkeypatch):
    client = BitvavoClient()
    monkeypatch.setattr(client, "_request", lambda *a, **k: {"market": "BTC-EUR", "price": "12345.67"})
    assert client.get_price("BTC-EUR") == 12345.67


def test_get_prices_builds_market_dict(monkeypatch):
    client = BitvavoClient()
    monkeypatch.setattr(
        client, "_request",
        lambda *a, **k: [{"market": "BTC-EUR", "price": "100"}, {"market": "ETH-EUR", "price": "50"}],
    )
    assert client.get_prices() == {"BTC-EUR": 100.0, "ETH-EUR": 50.0}
