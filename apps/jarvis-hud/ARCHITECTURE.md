# JARVIS HUD — Architecture

Phase 5. The HUD runs on a kernel that knows nothing about React, and adapters
that know nothing about the UI. Everything between them is a TypeScript
interface.

> **Live-capable, shipped off.** Real adapters exist for AIVM-BRAIN, OpenClaw,
> a connector broker and a metrics endpoint, but every integration ships as
> `mock` with an empty endpoint, so a fresh checkout performs no network
> activity at all. Switching one on is documented in
> [INTEGRATIONS.md](INTEGRATIONS.md).
>
> Two things enforce that in code rather than by convention:
> `src/adapters/live/httpClient.ts` is the only file allowed to call `fetch`,
> `src/adapters/local/localAppearanceStorage.ts` is the only one allowed to
> touch browser storage, `src/adapters/local/themeTransfer.ts` the only one
> allowed to reach the clipboard or the download folder, and `src/kernel/approvalGate.ts` is the only route to
> any action that is not a plain read. `src/__tests__/safety.test.ts` asserts both, plus the shipped
> defaults, and scans the source for everything that stays forbidden.

---

## The four layers

```
┌─────────────────────────────────────────────────────────────────┐
│  UI            src/components · src/core · src/state            │
│                React. Renders a snapshot, dispatches commands.  │
│                Holds no business logic.                         │
├─────────────────────────────────────────────────────────────────┤
│  CONTRACTS     src/contracts                                    │
│                Pure TypeScript interfaces. The only vocabulary  │
│                shared across the boundary. No runtime code.     │
├─────────────────────────────────────────────────────────────────┤
│  KERNEL        src/kernel                                       │
│                Event bus · core state machine · agent registry  │
│                · connector registry · command router · runtime. │
│                Framework-free and adapter-free.                 │
├─────────────────────────────────────────────────────────────────┤
│  ADAPTERS      src/adapters/mock · src/adapters/live            │
│                The only code that knows where data really comes │
│                from. Implements the contracts. All network      │
│                traffic goes through live/httpClient.ts.         │
└─────────────────────────────────────────────────────────────────┘
```

Dependencies point **inward only**: UI → kernel → contracts, and adapters →
contracts. The kernel never imports an adapter; the UI never imports one
either, except in the single assembly file described below.

### The one place adapters are chosen

`src/adapters/index.ts` is the only module that names concrete adapters. It
resolves each subsystem independently through `src/kernel/adapterResolver.ts`:
probe the configured endpoint, bind live if it answers, otherwise fall back to
mock and record why. Every outcome becomes an `IntegrationBinding` the ADAPTERS
panel renders, so what is live is visible on screen rather than buried in a
config file.

Memory can be live while agents stay mock. A subsystem that fails never takes
the HUD down — it serves mock data and is flagged.

### The appearance layer

The orb's look is data, not code. One `OrbTheme` object — shape, size, glow,
speed, gradient, motion and a style per core state — drives every visual
property of the core, and the studio is simply one editor for it.

```
OrbStudio ─► AppearanceStore ─► CSS custom properties ─► the core repaints
  (UI)         (kernel)            (useThemeVars)         (no React render)
                   │
                   └─► AppearanceStorage ─► localStorage | memory
                        (contract)           (adapters/local)
```

`src/kernel/appearanceStore.ts` owns validation: every value that arrives from
outside — a preset, a saved theme, a slider — is clamped and type-checked
there, so a corrupt save or a hand-edited key can never put the HUD into an
unrenderable state. `normaliseTheme()` repairs field by field and discards a
save from an older schema version rather than half-applying it.

`src/kernel/themeSchema.ts` holds that validation on its own, so the store and
the serialiser can both depend on it without depending on each other. It also
owns the **migration**: a theme saved by an older schema is upgraded rather than
discarded — version 1 had no secondary colour, so the colour it *was* deriving
is computed and stored explicitly, and the upgrade is invisible.

`normaliseTheme(raw, base)` takes what a rejected value falls back *to*. Loading
from storage falls back to the shipped default; an in-place edit falls back to
the theme the operator already had, so a bad hex never silently resets a field
to factory.

`src/kernel/themeSerializer.ts` turns a theme into a portable file and back.
Export wraps it in an envelope (`app`, `kind`, `version`, `exportedAt`) so an
import can refuse an unrelated JSON file with a useful message. Import repairs
what is repairable, refuses what is not, and reports every adjustment — a paste
that quietly produced the default theme would be worse than an error.

Two adapters carry the I/O, each a single chokepoint like the network client:
`src/adapters/local/localAppearanceStorage.ts` for browser storage (appearance
only, one key, every access wrapped) and `src/adapters/local/themeTransfer.ts`
for the clipboard, downloads and reading a picked file. All of it is
operator-initiated and carries appearance only.

Changes reach the screen through CSS custom properties rather than React
re-renders, so dragging a slider repaints the orb without re-mounting anything.

### The approval gate

Once real systems are reachable, anything beyond reading has to be asked for.
`ctx.requestApproval()` is the only route to a non-read action; the router
stamps the command id so a handler cannot forge one. `read` passes;
`write` and `execute` open a dialog; `destructive` and `financial` are blocked
by policy before a dialog could exist. Focus defaults to DENY, Escape denies,
and an unanswered request auto-denies — silence is not consent.

---

## The kernel

### Event bus — `src/kernel/eventBus.ts`

A typed pub/sub. `JarvisEventMap` maps each event name to its payload shape, so
a `command.completed` listener can never be handed an agent payload.

| Event | Emitted by | Payload highlights |
| --- | --- | --- |
| `command.received` | router | `commandId`, `input` |
| `command.started` | router | `handlerId` |
| `command.completed` | router | `ok`, `summary`, `durationMs` |
| `agent.started` | agent registry | `agentId`, `task` |
| `agent.completed` | agent registry | `ok` |
| `memory.search` | memory adapter | `query`, `scope`, `results` |
| `connector.status` | connector registry | `status`, `detail` |
| `system.error` | anywhere | `source`, `message` |
| `system.info` | anywhere | `message`, `level: info \| warning` |

The eight required events plus `system.info`, so ambient notices and warnings
have a home that is clearly not an error.

Every emitted record carries a derived `source`, `status` and `description`, so
the activity log renders bus records directly — nothing is synthesised for
display.

`connector.status` reports **transitions**, not repeats: a background sweep that
finds nothing changed emits one `system.info` summary instead of one event per
connector.

### Core state machine — `src/kernel/coreMachine.ts`

Pure and framework-free.

```
idle ──LISTEN──► listening ──THINK──► thinking ──WORK──► working
                                          │                 │
                                     RESOLVE│FAIL      RESOLVE│FAIL
                                          ▼                 ▼
                                    success / error ──RESET──► idle
```

Illegal transitions return `null` rather than guessing. `RESET` is accepted from
every state, so a stuck run is always recoverable. `force()` bypasses the guards
and exists only for the manual state preview in the HUD.

**"Busy" is not a state.** The runtime tracks whether a *command* owns the core
separately from whether the core happens to sit in a transitional state — so
previewing `LISTENING` by hand never locks the operator out.

### Registries

`agentRegistry` wraps every `run()` in the `agent.started` / `agent.completed`
pair, so no adapter has to remember to emit them, and turns a throwing adapter
into a failed result plus a `system.error`.

`connectorRegistry` owns health results and the transition logic described
above.

### Command router — `src/kernel/commandRouter.ts`

Handlers are **registered, not hardcoded**. `dispatch()` walks the pipeline
(input → processing → result), drives the state machine, hands each handler a
context with `runAgent()`, `memory` and `connectors`, and emits the command
lifecycle. A handler that throws becomes an error result; the core still
returns to `idle`.

### Runtime — `src/kernel/jarvisRuntime.ts`

Composes everything and exposes an immutable `JarvisSnapshot` plus
`subscribe()`. React binds to it with `useSyncExternalStore`, so a re-render
happens exactly when the snapshot reference moves. `start()` is idempotent —
React StrictMode mounts effects twice in development and would otherwise double
every background heartbeat.

---

## Plugging in the real thing

### Agents

Implement `AgentAdapter` (`src/contracts/agent.ts`):

```ts
export interface AgentAdapter {
  readonly descriptor: AgentDescriptor;   // id, name, role, capabilities, adapter
  getState(): AgentState;                 // status, currentTask, activity, lastAction
  tick?(): void;                          // optional heartbeat
  run(task: AgentTask): Promise<AgentRunResult>;
}
```

Register it in the assembly file:

```ts
const agents = createAgentRegistry(bus);
agents.register(createOpenClawAgent({ endpoint, credentials }));  // real
agents.register(createClaudeCodeAgent({ session }));              // real
```

The registry emits the lifecycle events, the agents panel renders
`registry.list()`, and command handlers reach agents through
`ctx.runAgent(id, input)`. **Where each of your systems fits:**

| Agent slot | Backed later by |
| --- | --- |
| `jarvis` | your orchestrator — routes to the others |
| `coding` | a Claude Code session |
| `research` | a retrieval/search agent |
| `browser` | a browser driver (Playwright, CDP) |
| `automation` | an OpenClaw worker pool |
| `memory` | the memory service below |

A real `run()` must respect its declared capabilities: an agent without
`execute` should never shell out.

### Memory

Implement `MemoryService` (`src/contracts/memory.ts`) — four operations:

```ts
search(query: MemoryQuery): Promise<MemoryRecord[]>
recall(id: string): Promise<MemoryRecord | null>
save(draft: MemoryDraft): Promise<MemoryRecord>
recent(limit?: number): Promise<MemoryRecord[]>
stats(): MemoryStats
```

The memory panel calls `search()` and never learns which store answered — it
only reads `stats().adapter` to label the source honestly. Three adapters are
anticipated:

- **AIVM-BRAIN** — `search()` → knowledge-graph query, `save()` →
  `capture_document`, `recall()` → node fetch.
- **Claude-Mem** — `search()` → memory store query, `recent()` → session log.
- **Obsidian / Markdown** — `search()` → vault grep or index, `save()` → append
  a note. Read-only is fine: a `save()` that rejects is a valid implementation.

Route several at once with a composite adapter that fans out and merges by
`timestamp`; `MemoryRecord.source` already carries which store a record came
from, so the UI can show mixed results without changing.

`search()` should emit `memory.search` on the bus, as the mock does, so the
activity log stays truthful.

### Connectors

Implement `Connector` (`src/contracts/connector.ts`):

```ts
interface Connector {
  readonly id: string;
  readonly name: string;
  readonly capabilities: ConnectorCapability[];
  readonly status: ConnectorStatus;   // connected | disconnected | mock | not-configured
  healthCheck(): Promise<ConnectorHealth>;
}
```

**Credentials are injected, never imported.** A real connector factory takes a
provider argument:

```ts
createGitHubConnector({ getToken: () => tokenProvider.get('github') })
```

Nothing reads `process.env` or `import.meta.env` in this app, and a test
enforces that. Keep it that way: secrets belong in the host process that
constructs the adapters, not in the HUD bundle, which ships to a browser.

`healthCheck()` is the *only* method the HUD calls on its own. Anything that
writes must be reached through an explicit command handler, so an action is
always traceable to an operator instruction in the activity log.

### Telemetry

Implement `TelemetryProvider` (`src/contracts/telemetry.ts`) — one
`subscribe()` that pushes `TelemetrySnapshot`s. Set `isMock: false` and the
`SIMULATED` badge becomes `LIVE` on its own. The status cards render whatever
metrics arrive, so adding or removing one needs no component change.

### Commands

Implement `CommandHandler` (`src/contracts/command.ts`) and register it:

```ts
router.register({
  id: 'deploy',
  title: 'Deploy',
  example: 'Deploy naar staging',
  agents: ['automation'],
  matches: (input) => /deploy/i.test(input),
  run: async (ctx) => { /* real work via ctx.runAgent(...) */ },
});
```

`matches()` runs in registration order, first match wins, and an unmatched
input falls through to the fallback handler. Dutch patterns should match
keywords in either order — the verb moves to the end in a subordinate clause
("kun je mijn systeem analyseren").

---

## Data flow of one command

```
operator types  ─► CommandCenter ─► runtime.dispatch()
                                        │
                                        ├─► bus: command.received      ─┐
                                        ├─► core: LISTEN → THINK        │
                                        ├─► bus: command.started        │
                                        ├─► handler.run(ctx)            ├─► Activity Log
                                        │      ├─ ctx.runAgent()  ──────┤   (renders the
                                        │      │    └─ bus: agent.*     │    bus records
                                        │      ├─ ctx.memory.search()   │    directly)
                                        │      │    └─ bus: memory.*    │
                                        │      └─ ctx.connectors.check()│
                                        │           └─ bus: connector.* │
                                        ├─► core: WORK → RESOLVE/FAIL   │
                                        ├─► bus: command.completed     ─┘
                                        └─► core: RESET → idle
                                        
snapshot rebuilt ─► useSyncExternalStore ─► every panel re-renders once
```

---

## Configuration

| File | Owns |
| --- | --- |
| `src/config/jarvis.config.ts` | Look and behaviour: palette, animation, core shapes, command pacing, voice, intervals, **which adapter set runs** |
| `src/config/mock.config.ts` | Demo content only: metric seeds, agent seeds, memories, connector seeds, ambient notices |

Neither contains a key, token, endpoint credential or environment read.

`createMockRuntime()` accepts timing and interval overrides, which is how the
test suite runs a full command pipeline in milliseconds instead of the six
seconds that make it readable on screen.

---

## Testing

| Suite | Covers |
| --- | --- |
| `coreMachine.test.ts` | transitions, guards, illegal moves, subscribers |
| `eventBus.test.ts` | typed delivery, derived metadata for all nine events |
| `commandRouter.test.ts` | routing, Dutch phrasing, lifecycle order, throwing handlers |
| `agentRegistry.test.ts` | registration, capabilities, run wrapping, offline refusal |
| `connectorRegistry.test.ts` | health checks, transition-only events, sweep summary |
| `memoryService.test.ts` | search / recall / save / recent against the contract |
| `jarvisRuntime.test.ts` | snapshot behaviour, busy semantics, idempotent start |
| `appearanceStore.test.ts` | theme editing, clamping, presets, reset, repair of corrupt saves |
| `appearanceStorage.test.ts` | round-trip, quota failure, blocked storage, what is stored |
| `themeSerializer.test.ts` | export envelope, round-trip of every preset, refusals, reported repairs |
| `themeMigration.test.ts` | version 1 → 2 upgrade, legacy gradient mapping, unmigratable versions |
| `presetLibrary.test.ts` | save, load, duplicate, delete, the cap, and repair of a tampered library |
| `gradientToggle.test.ts` | primary/secondary independence, the on/off switch, blend styles |
| `themeTransfer.test.ts` | clipboard fallback, object-URL release, unreadable file |
| `color.test.ts` | hex ⇄ HSL round-trip and the gradient derivations |
| `safety.test.ts` | mock mode on, and a source scan for forbidden capabilities |

`npm run verify` runs lint, typecheck and tests together.

---

## Safety model

The phase-3 guarantees, and where each is enforced:

| Guarantee | Enforced by |
| --- | --- |
| Runs on mock adapters | `runtime.adapters === 'mock'`, asserted in `safety.test.ts` |
| No real command execution | `command.executeForReal === false`, asserted |
| No connector reports a real connection | asserted over the registry |
| No network, socket or beacon | source scan |
| No microphone or recording | source scan (`useVoice` is the only voice module) |
| No shell or filesystem writes | source scan |
| No secrets in source or environment | source scan for credential literals and `process.env` |
| Browser storage only in the appearance chokepoint | source scan, plus a test asserting it stores appearance under one key and nothing else |
| Clipboard and downloads only in the transfer chokepoint | source scan, plus a test asserting an export carries appearance and nothing else |

The source scan strips comments before matching, so documentation that
*mentions* a forbidden API never trips it — only real code does.
