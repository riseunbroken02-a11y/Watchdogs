# JARVIS HUD — Phase 1

A fully local, interactive command-center interface for the AIVM-BRAIN /
OpenClaw system.

> **Phase 1 is the interface only.**
> Every number you see is simulated. The HUD performs **no** API calls, runs
> **no** commands and touches **no** part of your AIVM-BRAIN, OpenClaw,
> Claude Code, Claude-Mem or OmniRoute setup. It is a self-contained frontend
> living in `apps/jarvis-hud/` and nothing outside that folder was changed.

---

## Start it locally

```bash
cd apps/jarvis-hud
npm install
npm run dev
```

Then open **http://127.0.0.1:5173/**

Other scripts:

| Command             | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Dev server with hot reload (port 5173)        |
| `npm run build`     | Type-check + production build into `dist/`    |
| `npm run preview`   | Serve the production build (port 4173)        |
| `npm run typecheck` | TypeScript only                               |

Requires Node 20.19+ or 22.12+ (built and verified on Node 22).

---

## What's on screen

```
┌───────────────────────────────────────────────────────────────────────┐
│ JARVIS            ● JARVIS ONLINE                     clock / build   │
├──────────────┬────────────────────────────────┬───────────────────────┤
│ CORE SHAPE   │                                │ SYSTEM STATUS         │
│  ORB         │                                │   CPU / RAM /         │
│  RING        │           ┌─────────┐          │   STORAGE / NETWORK   │
│  HEXAGON     │           │  CORE   │          ├───────────────────────┤
│  HOLOGRAM    │           └─────────┘          │ AI STATUS             │
│  REACTOR     │                                │   AIVM-BRAIN          │
│  WAVE        │        IDLE | Standing by      │   OPENCLAW            │
│  MINIMAL     │                                │   CLAUDE CODE         │
│  CUSTOM      │                                │   CLAUDE-MEM          │
├──────────────┤                                │   OMNIROUTE           │
│ CORE STATE   │                                ├───────────────────────┤
│  6 states    │                                │ ⚠ DEMO DATA           │
├──────────────┴────────────────────────────────┴───────────────────────┤
│ ACTIVITY LOG                                                          │
├───────────────────────────────────────────────────────────────────────┤
│ >_ Talk to JARVIS...                                       [EXECUTE]  │
└───────────────────────────────────────────────────────────────────────┘
```

### Core shapes

Click any entry in **CORE SHAPE** to swap the central core instantly:

| Shape      | Look                                                      |
| ---------- | --------------------------------------------------------- |
| `ORB`      | Glowing volumetric sphere, soft pulse, orbital halo        |
| `RING`     | Three counter-rotating holographic rings around a core     |
| `HEXAGON`  | Nested hex lattice, digital edge lines, slow rotation      |
| `HOLOGRAM` | Translucent projection, scanlines, floating particles      |
| `REACTOR`  | Layered arc-reactor assembly with rotating housings        |
| `WAVE`     | Live waveform that swells with activity                    |
| `MINIMAL`  | One glowing circle, nothing else                           |
| `CUSTOM`   | Empty slot prepared for your own shape (see below)         |

### Core states

The core changes colour, glow and animation tempo per state. Trigger any of
them manually from the **CORE STATE** panel:

| State       | Accent  | Meaning                    |
| ----------- | ------- | -------------------------- |
| `IDLE`      | cyan    | Standing by                |
| `LISTENING` | blue    | Capturing input            |
| `THINKING`  | violet  | Reasoning over context     |
| `WORKING`   | amber   | Executing task chain       |
| `SUCCESS`   | green   | Task completed             |
| `ERROR`     | red     | Task failed                |

### Command center

Type into `Talk to JARVIS...` and press **EXECUTE**. This runs a *simulated*
pipeline — `LISTENING → THINKING → WORKING → SUCCESS | ERROR → IDLE` — so you
can watch the core react, with matching lines in the activity log. Try
`status report`, `memory check`, `route info`, or `deploy now` (that one
demonstrates the error state).

Nothing is sent anywhere. The safety switch is `command.executeForReal` in the
config, and it is `false`.

---

## Configuration

Everything tunable lives in **`src/config/jarvis.config.ts`**:

| Section         | Controls                                                      |
| --------------- | ------------------------------------------------------------- |
| `identity`      | Name, subtitle, build tag in the header                       |
| `palette`       | Background, panel, text and accent colours                    |
| `stateColors`   | Accent colour per core state                                  |
| `stateMeta`     | Label + hint text per state                                   |
| `animation`     | Global speed multiplier, pulse/rotation timing, reduced motion |
| `stateTempo`    | Per-state animation speed (lower = more agitated)             |
| `coreShapes`    | Which shapes appear in the selector, and their labels          |
| `defaultShape`  | Shape shown on first load                                     |
| `telemetry`     | `mock` vs `live`, poll interval, future endpoint              |
| `systemMetrics` | The CPU / RAM / STORAGE / NETWORK rows                        |
| `aiModules`     | The five AI subsystem rows                                    |
| `command`       | Placeholder, button label, simulation timings, safety switch  |

Colour and timing values are pushed into CSS custom properties (`--jv-*`) at
runtime by `src/hooks/useThemeVars.ts`, so a change in the config is reflected
everywhere without touching a stylesheet.

---

## Project structure

```
apps/jarvis-hud/
├── index.html
├── vite.config.ts
├── src/
│   ├── main.tsx                  entry point
│   ├── App.tsx                   dashboard layout
│   ├── App.css
│   ├── config/
│   │   └── jarvis.config.ts      ← the one file you tweak
│   ├── types/index.ts            shared types (already backend-shaped)
│   ├── core/
│   │   ├── CoreStage.tsx         renders the selected shape + state caption
│   │   ├── CoreStage.css
│   │   └── shapes/
│   │       ├── registry.ts       shape id → component
│   │       ├── shapes.css        all shape styling
│   │       └── *Core.tsx         the eight shapes
│   ├── components/               Panel, StatBar, ShapeSelector, StateSelector,
│   │                             StatusBadge, SystemStatusPanel, AiStatusPanel,
│   │                             CommandCenter, DemoDataNotice (+ .css each)
│   ├── hooks/
│   │   ├── useCoreState.ts       state machine + smoothed intensity
│   │   ├── useTelemetry.ts       subscribes to the telemetry source
│   │   ├── useThemeVars.ts       config → CSS custom properties
│   │   └── useClock.ts
│   ├── services/
│   │   ├── telemetry.ts          mock source + seam for the real one
│   │   └── commands.ts           simulated command pipeline
│   └── styles/
│       ├── tokens.css            design tokens
│       ├── global.css            reset + ambient background
│       └── compact.css           height-adaptive one-screen fitting
```

Styling is kept out of the components: each component has a sibling `.css`
file, and the shared vocabulary lives in `styles/`.

---

## Adding your own core shape

1. Copy `src/core/shapes/CustomCore.tsx` to e.g. `MyCore.tsx` and draw whatever
   you want. The component receives `{ state, intensity }` and inherits
   `--jv-state` (current accent colour) and `--i` (0..1 intensity).
2. Register it in `src/core/shapes/registry.ts`.
3. Add an entry to `coreShapes` in `src/config/jarvis.config.ts`.

It then appears in the CORE SHAPE selector automatically. Add the shape id to
the `CoreShapeId` union in `src/types/index.ts` so TypeScript stays happy.

---

## Connecting real data later (phase 2+)

The seams are already in place — no component will need to change:

- **Telemetry** — implement `createLiveSource()` in `src/services/telemetry.ts`
  (fetch, WebSocket or an MCP bridge) so it returns the same `TelemetrySource`
  shape, then set `telemetry.source = 'live'` in the config. The `DEMO DATA`
  banner and the `SIMULATED` labels are driven by `snapshot.isMock`, so they
  switch to `LIVE` on their own.
- **Commands** — replace the body of `runCommand()` in
  `src/services/commands.ts` with a call into your OpenClaw / MCP bridge and
  flip `command.executeForReal` to `true`.
- **Types** — `AiModuleStatus`, `SystemMetric` and `TelemetrySnapshot` in
  `src/types/index.ts` are already shaped the way a real status feed delivers
  data.

---

## Layout notes

Desktop-first, single screen, no tabs, no page scrolling. On shorter displays
the panels progressively shed padding and secondary text
(`src/styles/compact.css`) rather than introducing a scrollbar; verified with
the full activity log at 1600×950, 1440×900 and 1280×800. Below 1100px wide the
grid stacks into a tablet layout with the core on top.

Motion honours `prefers-reduced-motion`, and can also be flattened explicitly
via `animation.reducedMotion` in the config.
