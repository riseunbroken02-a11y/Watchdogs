# JARVIS HUD — Architecture

Phase 3. The HUD runs on a kernel that knows nothing about React, and adapters
that know nothing about the UI. Everything between them is a TypeScript
interface.

> **Still local-only.** Every adapter shipped today is a mock. Nothing performs
> a network request, opens a socket, starts an OAuth flow, reads a credential,
> runs a shell command, touches the filesystem, sends a message or moves money.
> `src/__tests__/safety.test.ts` scans the source and fails if any of that
> appears.

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
│  ADAPTERS      src/adapters/mock  (later: src/adapters/live)    │
│                The only code that knows where data really comes │
│                from. Implements the contracts.                  │
└─────────────────────────────────────────────────────────────────┘
```

Dependencies point **inward only**: UI → kernel → contracts, and adapters →
contracts. The kernel never imports an adapter; the UI never imports one
either, except in the single assembly file described below.

### The one place adapters are chosen

`src/state/JarvisProvider.tsx` calls `createMockRuntime()` from
`src/adapters/mock/index.ts`. That assembly file is the only module that names
concrete adapters. Adding a live adapter set means writing a sibling
`src/adapters/live/index.ts` and switching `runtime.adapters` in
`src/config/jarvis.config.ts`. No panel changes.

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
| No browser storage | source scan, and a browser assertion that both stores stay empty |

The source scan strips comments before matching, so documentation that
*mentions* a forbidden API never trips it — only real code does.
