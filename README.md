# Watchdogs
Claude brain

## Bitvavo monitor

A small Python monitor for a [Bitvavo](https://bitvavo.com) account: it
periodically fetches market prices and (optionally) your account balance,
logs snapshots to a local SQLite database, and emails you when a price or
portfolio-value threshold is crossed.

### Setup

```bash
pip install -r requirements.txt
```

Configure non-secret settings in `config.yaml` (already tracked with sane
defaults — edit `watch_markets` / `price_alerts` to taste, see
`config.example.yaml` for the full set of options).

Secrets are read from environment variables, never from `config.yaml`:

| Variable | Required for | Notes |
|---|---|---|
| `BITVAVO_API_KEY` / `BITVAVO_API_SECRET` | balance & portfolio tracking | Create a **read-only** API key in Bitvavo's account settings. Price alerts work without these. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | email alerts | Any SMTP provider (Gmail app password, SendGrid, etc.). `SMTP_PORT` defaults to `587`, `SMTP_USE_TLS` defaults to `true`. |
| `ALERT_EMAIL_TO` | email alerts | Where alerts get sent. |

Without `SMTP_HOST` set, alerts are only logged to stdout/stderr.

### Running

```bash
# One check, then exit (good for cron / GitHub Actions)
python -m bitvavo_monitor.monitor --once

# Long-running loop, checking every `check_interval_seconds`
python -m bitvavo_monitor.monitor
```

History (price snapshots, portfolio value over time, per-threshold state)
is kept in a local SQLite file at `data/history.db` by default.

### Running on a schedule with GitHub Actions

`.github/workflows/bitvavo-monitor.yml` runs the monitor every 15 minutes
using `workflow_dispatch`/`schedule`. Add the variables above as
**repository secrets** (Settings → Secrets and variables → Actions) and it
will run out of the box; the history database is cached between runs via
`actions/cache`.

### Tests

```bash
pip install pytest
pytest
```

Tests cover the Bitvavo request-signing scheme, threshold/alert logic, and
the SQLite storage layer — none of them hit the network.
