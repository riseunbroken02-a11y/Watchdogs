# Running the live adapters

Phase 4 can talk to real services. **A fresh checkout talks to none of them.**
Every integration ships as `mock` with an empty endpoint, so the app performs no
network activity until you point it at something.

This file is the operator's guide. For how the layers fit together, see
[ARCHITECTURE.md](ARCHITECTURE.md).

---

## What you are switching on

| Subsystem | Contract | Live adapter | Backed by |
| --- | --- | --- | --- |
| `memory` | `MemoryService` | `aivm-brain` | AIVM-BRAIN over HTTP |
| `agents` | `AgentAdapter` | `openclaw` | OpenClaw runtime over HTTP |
| `connectors` | `Connector` | `broker` | a local broker that holds the tokens |
| `telemetry` | `TelemetryProvider` | `metrics` | any metrics endpoint |

Each resolves **independently**. Memory can be live while everything else stays
mock, and a subsystem that fails to answer never takes the HUD down.

---

## 1. Choose a mode

Edit `src/config/integrations.config.ts`:

```ts
export const integrations = {
  memory: { mode: 'auto', endpoint: 'http://127.0.0.1:8787', timeoutMs: 4000 },
  agents: { ...OFF },
  connectors: { ...OFF },
  telemetry: { ...OFF },
};
```

| Mode | Behaviour |
| --- | --- |
| `mock` | Never connects. No probe, no request. **The shipped default.** |
| `auto` | Probes the endpoint. Answers → live. Silent → mock, with the reason shown. |
| `live` | Probes the endpoint. Silent → the subsystem is marked **FAILED** in the HUD and still serves mock data, so the interface keeps working. |

Use `auto` for a service that may or may not be running. Use `live` when it
*should* be there and you want a loud failure if it is not.

An empty `endpoint` forces `mock` whatever the mode says — there is no way to
accidentally probe a blank URL.

## 2. Start the HUD

```bash
npm run dev
```

At boot each configured endpoint is probed once (3 s timeout). The **ADAPTERS**
panel, bottom-right, then states per subsystem what actually resolved:

```
ADAPTERS                    1/4 LIVE
● MEMORY      aivm-brain           LIVE
○ AGENTS      Configured as mock   MOCK
○ CONNECTORS  Configured as mock   MOCK
○ TELEMETRY   Configured as mock   MOCK
```

A fallback always names its cause — `No endpoint configured`,
`Endpoint did not answer: Timed out`, `Endpoint answered but returned no usable
data`. Every binding decision is also written to the activity log.

**The HUD never claims a subsystem is live without having asked it.**

---

## What each endpoint must serve

Every integration needs `GET /health` returning 2xx. That is the probe.

### Memory — AIVM-BRAIN

```
GET  /health
GET  /memory/stats                              → { total, categories }
GET  /memory/search?q=&category=&limit=         → { records: [...] }
GET  /memory/recent?limit=                      → { records: [...] }
GET  /memory/:id                                → { record: {...} | null }
POST /memory   { title, snippet, category, source }
                                                → { record: {...} }
```

A record needs at least `id` and `title`. Missing fields get safe defaults;
malformed entries are dropped rather than rendered. A timestamp may be epoch ms
or an ISO string.

### Agents — OpenClaw

```
GET  /health
GET  /agents                → { agents: [{ id, name, role, capabilities,
                                           status, currentTask, activity,
                                           lastAction }] }
GET  /agents/:id            → one agent object (polled as a heartbeat)
POST /agents/:id/run  { input, commandId }
                            → { ok: boolean, summary: string }
```

`status` must be one of `active | working | idle | warning | offline`;
`capabilities` entries outside the known set are ignored. An empty roster counts
as a failed binding — a runtime with no agents is not a working integration.

### Connectors — broker

```
GET /health
GET /connectors             → { connectors: [{ id, name, status,
                                               capabilities, detail }] }
GET /connectors/:id/health  → { status, latencyMs, detail }
```

The HUD never authenticates to GitHub, Notion, Gmail or Calendar itself. It asks
the broker, which holds those credentials. `status` is
`connected | disconnected | mock | not-configured`.

### Telemetry

```
GET /health
GET /metrics                → { metrics: [{ id, label, value, unit, readout }] }
```

`value` is 0–100 and is clamped. A failed poll keeps the last good snapshot and
is reported once per outage, not once per tick.

---

## Credentials

**There are no credentials in this repository, and there must never be.** This
bundle ships to a browser: anything compiled into it is readable by whoever
opens the page.

The shipped provider supplies nothing, which is why the live adapters only work
against an endpoint that needs no authentication — typically one on the loopback
interface.

For an authenticated deployment, inject a provider that mints **short-lived**
tokens from your own backend:

```ts
import { createRuntime } from './adapters';

const runtime = await createRuntime({
  credentials: {
    async getToken(integrationId) {
      // Your backend holds the real secret. The browser only ever sees a
      // short-lived token, and only for the integration that needs it.
      const res = await fetch('/api/token/' + integrationId, { credentials: 'same-origin' });
      return res.ok ? (await res.json()).token : undefined;
    },
  },
});
```

The token is attached as `Authorization: Bearer …` by the HTTP client and never
logged, never returned in an error, and never written to storage. A provider
that throws is treated as "no token" rather than failing the request.

Requests always go out with `credentials: 'omit'`, so no ambient cookie is ever
attached: an adapter authenticates explicitly or not at all.

---

## What the HUD is allowed to do

Reaching real systems means the HUD can now change things. It is gated:

| Action kind | Behaviour |
| --- | --- |
| `read` | Runs without asking. |
| `write` | **Approval dialog.** Nothing happens until you click APPROVE. |
| `execute` | **Approval dialog.** |
| `destructive` | **Blocked by policy.** No approve button is ever offered. |
| `financial` | **Blocked by policy.** No approve button is ever offered. |

Rules the gate enforces:

- Focus lands on **DENY**, never APPROVE. Escape denies.
- An unanswered request **auto-denies** after 45 s. Silence is not consent.
- Only one request is open at a time; a second is refused rather than queued, so
  you can never approve the wrong thing.
- Blocked kinds are rejected before a dialog could exist — a misclick cannot
  delete data or move money.

Change the policy in `actionPolicy` in `src/config/integrations.config.ts`.
Moving `destructive` or `financial` out of `blocked` is a deliberate act with
obvious consequences; the safety test asserts they are there.

A handler cannot bypass this. `ctx.requestApproval()` is the only route to a
non-read action, and the command id is stamped by the router rather than by the
caller.

---

## Troubleshooting

| The HUD says | What happened |
| --- | --- |
| `Configured as mock` | The mode is `mock`. Expected default. |
| `No endpoint configured` | The mode allows live but `endpoint` is empty. |
| `Endpoint did not answer: Timed out` | Nothing responded to `GET /health` within 3 s. |
| `Endpoint did not answer: Endpoint unreachable` | Connection refused, DNS failure, or blocked by CORS. |
| `Endpoint answered but returned no usable data` | `/health` was fine, but `/agents` or `/connectors` returned an empty or malformed list. |
| `HTTP 401` / `HTTP 403` in the log | The endpoint wants authentication. Inject a `CredentialProvider`. |

A browser enforces CORS: your endpoint must send
`Access-Control-Allow-Origin` for the HUD's origin. A connection that works in
`curl` but not in the HUD is almost always this.

---

## Turning everything back off

Set every `mode` back to `'mock'`, or clear the endpoints. `npm test` asserts
the shipped defaults connect to nothing, so a stray endpoint left in the config
fails the suite before it reaches anyone.
