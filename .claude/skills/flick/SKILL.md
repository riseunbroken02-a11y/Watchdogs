---
name: flick
description: Quick-capture a note into this repo's brain/ hub — privacy-screen it, route it to brain/knowledge, brain/projects or brain/daily, write the frontmatter SYNC-INSTRUCTIONS.md requires, and commit. Use this whenever the user wants something remembered, logged, synced or filed into the brain — "/flick", "flick this in", "zet dit in het brein", "log dit", "note this", "capture this", "add this to the brain", a project status update, a daily log line, or a knowledge note on Python, cybersecurity, AI, crypto or marketing. Also use it when the user pastes a chunk of text and just says to save or sync it, even without naming the brain or a folder.
---

# Flick — capture a note into the brain hub

This repo is the sync point between a local AIVM brain (Obsidian vault) and the
cloud. `/flick` is the fast path for one note: the user hands you a thought, you
land it in the right place, correctly formatted, without them thinking about
folders, frontmatter, or what is safe to publish.

Two facts shape everything below:

1. **The repo is public** (`PRIVACY.md`). A leaked key or a personal financial
   figure is permanent in git history. So the privacy gate runs before the write,
   not after, and when it trips you stop rather than sanitize silently.
2. **Notes are summaries, not dumps** (`SYNC-INSTRUCTIONS.md`): one topic per
   file, roughly 50 lines maximum. A note that needs more than that is really two
   notes.

## Workflow

### 1. Read the house rules if you have not already

Read `PRIVACY.md` and `SYNC-INSTRUCTIONS.md` from the repo root. They are short,
they are the actual authority here, and they change — do not work from memory of
this file. If they disagree with anything below, they win.

### 2. Pick the destination

| Content | Folder | Filename |
|---|---|---|
| A reusable fact, technique or concept (Python, cybersecurity, AI, crypto, marketing) | `brain/knowledge/` | `<domain>-<topic-slug>.md` |
| Where a project stands and what happens next | `brain/projects/` | `<project-slug>.md` |
| What happened today; a short running log | `brain/daily/` | `YYYY-MM-DD.md` |

Slugs are lowercase kebab-case, no dates in the name except for daily logs.

If an existing file already covers the topic, **update it instead of creating a
sibling**. Duplicates are the main way a synced brain rots: two files on the same
subject drift apart and the reader cannot tell which is current. Check with
`ls` and a quick grep before you write. When updating, bump `last_updated` and
revise the body so it reads as one coherent note — do not just append a dated
fragment to the bottom.

Daily logs are the exception: appending a bullet to today's file is correct.

### 3. Run the privacy gate

Draft the note body to a scratch file first, then scan it:

```bash
python3 -I .claude/skills/flick/scripts/privacy_scan.py <scratch-file>
```

It exits 0 when clean and 1 with a per-line explanation when not. It is
deliberately noisy — it flags IPs, emails, money amounts and personal machine
paths as well as obvious key shapes — because a false alarm costs one sentence of
your judgement while a miss is unrecoverable.

A finding is not automatically a veto. Read each one and decide:

- **Genuinely sensitive** (a real key, a personal financial figure, a home path,
  a vault dump) → do not write it into this repo. Tell the user plainly which
  line tripped and why, and point them at the private route
  `SYNC-INSTRUCTIONS.md` names: the Notion page "AIVM Brain Sync Inbox". Offer
  to flick a sanitized version — the general lesson without the specifics —
  since that is usually the part worth keeping anyway.
- **A placeholder or a documentation example** (`API_KEY=<your-key>`,
  `192.0.2.1`, `example.com`) → fine, say so in one line and continue.

Never route around the gate by rewording text until the scan passes without
telling the user. The point is their informed decision, not a green checkmark.

When you cannot judge a line confidently, write the note with
`needs_review: true` and say why. `SYNC-INSTRUCTIONS.md` is explicit about this:
when in doubt, flag rather than publish.

### 4. Write the note

Every file opens with this frontmatter — the sync tooling and the human reader
both depend on it:

```markdown
---
source: obsidian-vault
last_updated: YYYY-MM-DD
confidence: high | medium | low
needs_review: true | false
next_action: korte tekst
---
```

Fill the judgement fields honestly rather than defaulting everything to
`high` / `false`, because a brain where every note claims high confidence
carries no information:

- `source` — `obsidian-vault` when it came from the vault; otherwise name the
  real origin (`chat`, `claude-session`, a URL).
- `confidence` — `high` if verified or first-hand, `medium` if it is a working
  belief, `low` if half-remembered or unverified.
- `needs_review` — `true` whenever the privacy call was borderline, the content
  is unverified, or you had to guess at what the user meant.
- `next_action` — the concrete next step, or `geen` if there genuinely isn't one.

Then the body: an `#` H1 title, and short prose or bullets under it. Write in the
language the user wrote in; default to Dutch, since the repo and its docs are
Dutch. Keep the whole file at or under ~50 lines. If the material does not fit,
split it into two notes and say that you did.

Re-run the scan on the final file after writing — the body you committed should
be the body you screened.

### 5. Commit

Stage only the files this flick touched and commit with a message naming the
destination, so the log reads as a usable history of what entered the brain:

```
brain(knowledge): rate limiting in FastAPI met slowapi
brain(daily): log 2026-10-19
brain(projects): Watchdogs sync-status bijgewerkt
```

Push only if the user asked for it or the repo's session instructions require it.
A flick is cheap and frequent; surprising the user with a public push is not.

### 6. Report back

Keep it to a few lines: the path you wrote, whether it was new or an update, the
privacy verdict, and anything you flagged for review. The user flicked a note to
avoid ceremony — do not hand them a ceremony in return.

## Examples

**Clean knowledge note**

> User: /flick slowapi met redis werkt goed voor rate limiting in fastapi, 100 req/min

Scan clean → `brain/knowledge/python-rate-limiting-fastapi.md`, `confidence: high`,
`next_action: geen`, committed. Report: one line.

**Privacy trip**

> User: /flick deploy werkt, token is ghp_xxxxreal, vault staat in C:\Users\Rick\AIVM

Scan flags the token and the local path. Nothing is written. Tell the user both
findings, point at the Notion inbox for the private parts, and offer the
sanitized note: "deploy pipeline werkt; token en vault-pad staan lokaal."

**Update, not duplicate**

> User: /flick watchdogs project: brain scaffold staat, agents nog niet gekoppeld

`brain/projects/watchdogs.md` already exists → rewrite it as one current note,
bump `last_updated`, set `next_action: lokale agents configureren`.
