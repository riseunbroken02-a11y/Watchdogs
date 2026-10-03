# Sync-instructies voor lokale AIVM agents (Claude / OpenClaw)

Doel: de lokale AIVM brain (Obsidian vault) delen met Perplexity Computer via de cloud.

## Wat te syncen (alleen samenvattingen, nooit raw dumps)
- Projectstatussen en volgende stappen
- Nieuwe kennisnotities (Python, cybersecurity, AI, crypto, marketing)
- Korte dagelijkse logs
- Beslissingen en geleerde lessen

## Formaat per bestand (frontmatter)
---
source: obsidian-vault
last_updated: YYYY-MM-DD
confidence: high | medium | low
needs_review: true | false
next_action: korte tekst
---

## Waarheen syncen
1. **Notion "AIVM Brain Sync Inbox"** (veiligste route voor persoonlijke content — controleer wel eerst de Notion-deelrechten van de pagina) — via de Notion MCP-connector in Claude Desktop
2. **Deze repo** — alléén algemene, niet-gevoelige samenvattingen (de repo is publiek, zie PRIVACY.md)

## Workflow per agent-sessie
1. Maak of ververs samenvattingen van wat er in de vault is veranderd
2. Push naar het gekozen doel met een duidelijke commit/message
3. Houd het klein: één onderwerp per bestand, maximaal ~50 regels

## Harde regels
- Geen credentials, geen financiële details, geen raw dumps
- Bij twijfel: niet syncen en `needs_review: true` zetten
