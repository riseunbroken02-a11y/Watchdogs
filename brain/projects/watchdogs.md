---
source: claude-session
last_updated: 2026-10-19
confidence: high
needs_review: false
next_action: lokale agents configureren zodat ze /flick gebruiken bij het syncen
---

# Watchdogs — AIVM Brain Hub

## Status
- Scaffold staat: `brain/knowledge`, `brain/projects`, `brain/daily` met README's
- `PRIVACY.md` en `SYNC-INSTRUCTIONS.md` vastgelegd als harde regels
- Nieuw: `/flick` skill in `.claude/skills/flick/` — snelle capture van een
  losse notitie naar de juiste brain-map, met frontmatter en privacy-check
- Repo is nog **publiek**; persoonlijke content gaat daarom via de Notion-pagina
  "AIVM Brain Sync Inbox", niet hierheen

## Hoe /flick werkt
1. Leest `PRIVACY.md` + `SYNC-INSTRUCTIONS.md` als bron van waarheid
2. Kiest map: knowledge (kennis), projects (status), daily (log)
3. Scant de concepttekst met `scripts/privacy_scan.py` vóór het schrijven —
   vindt key-patronen, IBAN's, geldbedragen, e-mails, IP's en lokale paden
4. Schrijft frontmatter + korte body (max ~50 regels), werkt bestaande notities
   bij in plaats van duplicaten aan te maken
5. Commit met een `brain(<map>): ...` bericht

## Geleerde les
Placeholder-onderdrukking in de scanner moet per match gebeuren, niet per regel.
Eén woord als "example" op een regel verborg anders alle echte vondsten daarnaast.

## Volgende stappen
- [ ] Repo privé maken of een privé-sync-repo aanmaken
- [ ] Lokale agents (Claude / OpenClaw) koppelen aan deze workflow
