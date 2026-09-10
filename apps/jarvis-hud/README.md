# JARVIS HUD — Phase 5

A fully local, interactive command center for the AIVM-BRAIN / OpenClaw system.

> **Out of the box the backend is still MOCK.**
> Every integration ships disabled with an empty endpoint, so a fresh checkout
> performs no network activity at all, never requests the microphone, and
> reads or changes nothing in your AIVM-BRAIN, OpenClaw, Claude Code,
> Claude-Mem, OmniRoute or MCP configuration. There are no credentials in this
> repository. The whole app lives in `apps/jarvis-hud/`.
>
> Phase 4 adds real adapters for AIVM-BRAIN, OpenClaw, a connector broker and a
> metrics endpoint — all behind feature flags that ship **off**. Point one at a
> running service and the HUD binds it; the ADAPTERS panel states per subsystem
> what is live and what fell back to mock, and why.
>
> Phase 5 adds the **Orb Studio**: shape, size, gradient, glow, motion, speed
> and a colour per core state, all editable live and saved in the browser.
>
> - **[INTEGRATIONS.md](INTEGRATIONS.md)** — how to switch a live adapter on
> - **[ARCHITECTURE.md](ARCHITECTURE.md)** — how the layers fit together

---

## Start it locally

```bash
cd apps/jarvis-hud
npm install
npm run dev
```

Then open **http://127.0.0.1:5173/**

| Command             | What it does                                     |
| ------------------- | ------------------------------------------------ |
| `npm run dev`       | Dev server with hot reload (port 5173)           |
| `npm run build`     | Type-check + production build into `dist/`       |
| `npm run preview`   | Serve the production build (port 4173)           |
| `npm run lint`      | ESLint over the whole app                        |
| `npm run typecheck` | TypeScript only                                  |
| `npm test`          | Vitest unit tests                                |
| `npm run verify`    | lint + typecheck + tests in one go               |

Requires Node 20.19+ or 22.12+ (built and verified on Node 22).

---

## The dashboard

```
┌─ JARVIS ───────────── ● ONLINE ──────────────────── clock / build ─┐
│ SYSTEM STATUS    │                            │ MEMORY            │
│  CPU RAM         │                            │  search + filters │
│  STORAGE NETWORK │        CORE STAGE          │  recent entries   │
│  6 services      │                            ├───────────────────┤
├──────────────────┤                            │ CONNECTORS        │
│ AGENTS           │  [ shape rail | states ]   │  8 integrations   │
│  6 agents        ├────────────────────────────┼───────────────────┤
│  task · activity │  ACTIVITY STREAM           │ MOCK DATA notice  │
├──────────────────┴────────────────────────────┴───────────────────┤
│ JARVIS answer (fixed height, never shifts the layout)             │
│ TRY  [ six example commands ]                                     │
│ [mic][mute][waveform][push to talk]   >_ Talk to JARVIS  [EXECUTE]│
└───────────────────────────────────────────────────────────────────┘
```

### 1. Core

Eight shapes, switchable from the icon rail under the core:

| Shape      | Look                                                   |
| ---------- | ------------------------------------------------------ |
| `ORB`      | Glowing volumetric sphere with an orbital halo          |
| `RING`     | Three counter-rotating holographic rings                |
| `HEXAGON`  | Nested hex lattice with digital edge lines              |
| `HOLOGRAM` | Translucent projection, scanlines, floating particles   |
| `REACTOR`  | Layered arc-reactor assembly                            |
| `WAVE`     | Live waveform that swells with activity                 |
| `MINIMAL`  | One glowing circle                                      |
| `CUSTOM`   | Prepared slot for your own shape                        |

Six states, each with its own accent colour, glow and animation tempo:
`IDLE` · `LISTENING` · `THINKING` · `WORKING` · `SUCCESS` · `ERROR`. All of it
is editable in the Orb Studio below.

Activity intensity rides on the `--jv-i` CSS custom property, registered with
`@property` so the browser interpolates it. A state change therefore costs one
React render instead of one per animation frame — which matters now the HUD
renders five live panels.

### 2. Orb Studio

Open it with **STUDIO** in the control bar under the core. The panel slides in
on the right and the core stays visible, because these are decisions you make
by looking at the orb rather than by reading numbers. Everything applies
instantly.

| Section | Controls |
| --- | --- |
| **FORM** | all eight shapes, a size scale (60–130%) and an opacity slider (15–100%). Opacity floors well above zero: an orb you cannot see is a trap, not a look |
| **GRADIENT** | an on/off switch, four blend styles (`RADIAL` · `LINEAR` · `CONIC` · `DUAL`), a depth slider for how strongly the secondary shows, and a glow multiplier (0–2×). With the gradient off the core is drawn in the primary alone, and the style and depth controls grey out |
| **MOTION** | `SMOOTH` · `PULSE` · `ORBIT` · `STATIC`, plus a speed multiplier. Each style changes the balance between breathing and turning; `STATIC` holds the core completely still |
| **STATES** | pick any of the six states to edit — the core previews it while you do — then set **both** its colours, its tempo, its glow and its opacity. `PRIMARY` drives the whole HUD's tint; `SECONDARY` is the gradient's second stop. Pick either slot and the hex field and swatches follow it. Per-state values multiply the base, so "slower overall" and "slower still when thinking" compose — and the opacity product is clamped so a state multiplier can never push the core past solid or make it vanish |
| **LIBRARY** | save the current look under your own name, load it back, duplicate it or delete it. Deleting asks for a second click rather than opening a dialog |

Six built-in presets — **JARVIS**, **ARC**, **CRIMSON**, **EMERALD**, **VOID**,
**MONO** — set shape, motion, gradient and all twelve colours in one click. A
preset leaves anything it does not mention alone, so your size stays put. MONO
is the one that ships with the gradient switched off.

Your own presets live in the **LIBRARY** section, capped at 40 so storage cannot
grow unbounded. Each row shows a three-colour fingerprint, so you can pick one
out without loading it.

`RESET <STATE>` restores one state; `RESET ALL` returns to the shipped default,
which reproduces the phase 1–4 look exactly.

**Export and import.** The **TRANSFER** section at the bottom moves a theme in
and out as JSON:

| Button | What it does |
| --- | --- |
| `COPY JSON` | Copies the theme to the clipboard. If the browser refuses (no secure context, permission denied) it shows the JSON pre-selected so you can copy it by hand |
| `DOWNLOAD` | Saves `jarvis-orb-theme-YYYY-MM-DD.json` |
| `PASTE JSON` | Opens a box to paste a theme into, then APPLY |
| `LOAD FILE` | Picks an exported `.json` file |

The file carries an envelope — `app`, `kind`, `version`, `exportedAt`, the theme
and your saved presets when you have any — so an import can tell a Jarvis theme
from any other JSON and refuse the second with a useful message rather than
silently producing a default. Imported presets are **merged**, never replacing
the library you built up.

A file written by an older schema is **upgraded rather than rejected**, one
version at a time: version 1's derived second colour is worked out and stored
explicitly, and version 2 gains opacity at full strength. Either way it looks
identical afterwards, and the result says which upgrade ran.

An import is never silently lossy. A value outside its range is clamped, an
unknown shape or gradient is ignored, and **everything that did not survive is
listed** under the result:

```
Theme applied with 3 adjustments.
 · Ignored unknown field(s): author
 · Unknown shape "triangle" — kept reactor
 · glow 99 is outside 0–2 — clamped to 2
```

A file that cannot be read at all — malformed JSON, another app's export, a
different schema version — is refused outright and **the live theme is left
exactly as it was**. A bare theme (what sits in browser storage) is accepted
too, so copying that out and pasting it back works.

**Persistence.** The theme and your saved presets live in this browser under
two keys, `jarvis.hud.orb.theme` and `jarvis.hud.orb.presets`. They hold
appearance only — no identifiers, no history,
no credentials. When a browser refuses durable storage (a private window, a full
quota, storage disabled by policy) the HUD keeps working and the studio badge
reads `SESSION ONLY` instead of `SAVED`, so a lost theme is never a surprise. A
corrupt or outdated save is repaired field by field rather than trusted.

### 3. Command center

Type and press **Enter** (or click EXECUTE). The core walks
`LISTENING → THINKING → WORKING → SUCCESS | ERROR → IDLE`, agents light up, the
activity stream fills, and a mock answer appears above the input.

- **↑ / ↓** recall previous commands, shell style.
- Six example commands are offered as chips: *Show system status*,
  *Analyze project*, *Open browser*, *Check memory*, *Run diagnostics*,
  *Show active agents*. *Open browser* deliberately fails, so the ERROR state is
  reachable from the UI.
- Free-form input is matched by regex against the same handlers; anything
  unrecognised gets an honest "nothing was executed" answer.

### 4. Voice UI (mock)

Microphone button, listening indicator, 24-bar waveform visualiser, mute /
unmute, and push-to-talk (hold the button or the **SPACE** key). Releasing
push-to-talk hands the mock transcript to the command input.

There is deliberately **no `getUserMedia`, no `MediaRecorder` and no
speech-to-text** anywhere in the app. The waveform is generated by
`sampleLevels()` and the transcript is drawn from a fixed phrase list.

### 5. System status

Four machine metrics (CPU, RAM, Storage, Network) plus six services — Claude
Code, OpenClaw, AIVM-BRAIN, Claude-Mem, Headroom and OmniRoute — each carrying
one of four statuses:

| Status    | Meaning                                        |
| --------- | ---------------------------------------------- |
| `ONLINE`  | Reporting normally                             |
| `OFFLINE` | Not reachable                                  |
| `WARNING` | Degraded — Headroom carries this in the demo   |
| `MOCK`    | **Simulated value, no real source attached**   |

In phase 2 no service can report `ONLINE`; a unit test enforces that. Hover any
row for its detail line.

### 6. Agents

Main Agent, AIVM Agent, Claude Code, OpenClaw, Browser Agent and Memory Agent,
each showing status, current task, an activity meter and its last action with a
relative timestamp. The roster drifts on its own and reacts while a command
runs.

### 7. Memory

Free-text search across title, snippet and source, six category filters, and
entries stamped with category, source and age. Backed by a local mock store —
no Claude-Mem database is opened.

### 8. Activity stream

A live feed of command received, agent started, agent working, memory accessed,
task completed, warning and error events, each with its own glyph and colour.
Filter by ALL / AGENTS / MEMORY / ALERTS. Ambient events keep arriving so the
HUD feels alive, and pause while a command is running so its own events stand
out.

### 9. Connectors

GitHub, Notion, Obsidian, Browser, OpenClaw, AIVM-BRAIN, Claude-Mem and
OmniRoute, each marked `CONNECTED`, `DISCONNECTED`, `MOCK` or `NOT CONFIGURED`.
Nothing is authenticated, opened or called — a unit test enforces that no
connector reports `CONNECTED`.

---

## Configuration

Two files, deliberately separated:

**`src/config/jarvis.config.ts`** — look and behaviour.

| Section         | Controls                                                       |
| --------------- | -------------------------------------------------------------- |
| `identity`      | Name, subtitle, build tag                                      |
| `palette`       | Background, panel, text and accent colours                     |
| `stateColors`   | Accent colour per core state                                   |
| `stateMeta`     | Label + hint per state                                         |
| `animation`     | Speed multiplier, pulse/rotation timing, reduced motion         |
| `stateTempo`    | Per-state animation speed                                      |
| `coreShapes`    | Which shapes appear in the rail                                |
| `telemetry`     | `mock` vs `live`, poll interval, future endpoint               |
| `command`       | Placeholder, button label, simulation timings, safety switch    |
| `voice`         | Bar count, transcript speed, push-to-talk key                  |
| `agents`        | Roster tick interval                                           |
| `panels`        | Event stream limit, memory page size                           |

**`src/config/orb.config.ts`** — the orb's default theme, the range of every
control, the six presets and the swatch palette. Editing `defaultTheme` changes
what a fresh browser sees; the studio then edits a copy of it per browser.

**`src/config/mock.config.ts`** — all demo content in one place: `MOCK_MODE`,
metric seeds, service seeds, agent seeds and task pools, memory entries and
categories, connector seeds, ambient events, and the canned command replies.

Colour and timing values are pushed into CSS custom properties (`--jv-*`) at
runtime by `src/hooks/useThemeVars.ts`, so a config change is reflected
everywhere without touching a stylesheet.

---

## Project structure

```
apps/jarvis-hud/src/
├── contracts/     TypeScript interfaces — the only cross-layer vocabulary
├── kernel/        event bus · core state machine · registries · router · runtime
├── adapters/mock/ the mock implementations (the only place fake data lives)
├── state/         React binding: provider + useJarvis()
├── components/    panels and widgets
├── core/          the visual core and its eight shapes
├── contracts/     …including integration.ts and policy.ts
├── adapters/live/ real adapters + the single network chokepoint
├── adapters/local/ the single browser-storage chokepoint
├── config/        jarvis.config.ts (look) · mock.config.ts (content) ·
│                  integrations.config.ts (flags + action policy) ·
│                  orb.config.ts (theme defaults, ranges, presets)
├── utils/         small shared helpers
└── __tests__/     22 suites, 281 tests
```

Dependencies point inward only: UI → kernel → contracts, adapters → contracts.
`src/adapters/mock/index.ts` is the single file that names concrete adapters.

Full detail, including how to plug in AIVM-BRAIN, Claude-Mem, Obsidian,
OpenClaw and Claude Code: **[ARCHITECTURE.md](ARCHITECTURE.md)**.

---

## Layout notes

Desktop-first, single screen, no tabs, no page scrolling. Below 1000px of
viewport height the panels progressively shed padding and secondary text
(`src/styles/compact.css`) rather than introducing a scrollbar. Below 1200px
wide the grid stacks with the core on top. Verified with a full activity log at
1600×950, 1440×900, 1280×800, 1200×820 and 900×1200.

Motion honours `prefers-reduced-motion`, and can be flattened explicitly via
`animation.reducedMotion` in the config.
