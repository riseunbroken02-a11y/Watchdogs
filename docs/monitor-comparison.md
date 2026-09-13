# Bitvavo monitor A/B vergelijking

Doel: twee onafhankelijke Bitvavo-monitors een tijd naast elkaar laten
draaien en daarna, op basis van de criteria hieronder, kiezen welke
overblijft.

## Monitor A — bestaand, lokaal

- Bestanden: `balance_monitor.py` + `aivm_brain_reporter.py`, draaien
  lokaal bij de gebruiker (niet in deze repo, en ook niet gevonden in de
  geschiedenis van `auto-editor`).
- Polling: `get_balance` + `get_price` elke 5 minuten, strikt read-only
  (geen trading/transfer/deposit/withdrawal-rechten).
- Rapportage: schrijft alleen bij een echte saldowijziging een update naar
  de AIVM Brain, topic `bitvavo-balance-monitor`.
- Beperking: niet zichtbaar of bewerkbaar vanuit deze repo/sessie — alleen
  te volgen via wat er in de Brain terechtkomt of wat de gebruiker zelf
  rapporteert.

## Monitor B — deze repo

- Package `bitvavo_monitor/`, draait als GitHub Actions cron
  (`.github/workflows/bitvavo-monitor.yml`, elke 15 min) of lokaal via
  `python -m bitvavo_monitor.monitor`.
- Features: prijsalerts (boven/onder/%-verandering), portefeuillewaarde-
  tracking, e-mailmeldingen (SMTP), geschiedenis in lokale SQLite
  (`data/history.db`).
- Vereist eigen GitHub repository secrets (`BITVAVO_API_KEY`/`SECRET`,
  `SMTP_*`, `ALERT_EMAIL_TO`) — apart van wat Monitor A gebruikt, niet
  automatisch overgenomen uit de Brain of de lokale opstelling.

## Vergelijkingscriteria

1. **Betrouwbaarheid** — draait consistent volgens schema, zonder
   crashes of gemiste checks.
2. **Nauwkeurigheid** — mist geen echte saldo/prijsveranderingen (false
   negatives) en spamt niet met valse meldingen (false positives).
3. **Snelheid** — tijd tussen een echte verandering en de melding.
4. **Onderhoud** — hoeveel handmatig ingrijpen nodig is om te blijven
   draaien.
5. **Kosten/complexiteit** — GitHub Actions-minuten + e-mail vs. lokale
   rekenkracht/opslag.
6. **Zichtbaarheid van geschiedenis** — hoe makkelijk je achteraf kunt
   zien wat er gebeurd is (Brain-log vs. SQLite-db).

## Status

Plan bevestigd op 2026-09-13: beide monitors draaien een tijd naast
elkaar; daarna wordt op basis van bovenstaande criteria gekozen welke
overblijft. Nog geen vaste einddatum voor de testperiode afgesproken.
