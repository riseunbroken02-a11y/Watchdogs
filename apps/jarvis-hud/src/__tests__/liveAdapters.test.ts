import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEventBus } from '../kernel/eventBus';
import { createHttpClient } from '../adapters/live/httpClient';
import { createLiveAgents } from '../adapters/live/liveAgents';
import { createLiveConnectors } from '../adapters/live/liveConnectors';
import { createLiveMemory } from '../adapters/live/liveMemory';
import { createLiveTelemetry } from '../adapters/live/liveTelemetry';
import type { EventBus } from '../contracts';

const ENDPOINT = 'http://127.0.0.1:9999';

let bus: EventBus;
beforeEach(() => {
  bus = createEventBus();
});
afterEach(() => vi.unstubAllGlobals());

/** Routes stubbed responses by path. Unlisted paths fail like a dead server. */
function stubRoutes(routes: Record<string, unknown>, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const path = new URL(url).pathname;
      if (!(path in routes)) throw new TypeError('Failed to fetch');
      return new Response(JSON.stringify(routes[path]), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
}

const http = () =>
  createHttpClient({ baseUrl: ENDPOINT, timeoutMs: 500, integrationId: 'test' });

describe('live memory adapter (AIVM-BRAIN)', () => {
  it('maps remote records onto the MemoryService contract', async () => {
    stubRoutes({
      '/memory/stats': { total: 42, categories: 5 },
      '/memory/search': {
        records: [
          { id: 'r1', title: 'Phase 4', snippet: 'live adapters', category: 'decision', timestamp: 1700000000000 },
        ],
      },
    });

    const memory = createLiveMemory(http(), bus);
    const hits = await memory.search({ text: 'phase' });

    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ id: 'r1', title: 'Phase 4', category: 'decision' });
    expect(memory.stats().adapter).toBe('aivm-brain');
  });

  it('discards malformed records instead of rendering them', async () => {
    stubRoutes({
      '/memory/stats': { total: 1, categories: 1 },
      '/memory/search': { records: [{ id: 'ok', title: 'Good' }, { title: 'no id' }, null, 42] },
    });

    const hits = await createLiveMemory(http(), bus).search({});
    expect(hits.map((h) => h.id)).toEqual(['ok']);
  });

  it('emits memory.search even when the endpoint fails, reporting zero results', async () => {
    stubRoutes({});
    const searches: number[] = [];
    const errors: string[] = [];
    bus.on('memory.search', (r) => searches.push(r.payload.results));
    bus.on('system.error', (r) => errors.push(r.payload.message));

    const hits = await createLiveMemory(http(), bus).search({ text: 'x' });

    expect(hits).toEqual([]);
    expect(searches).toEqual([0]);
    expect(errors[0]).toMatch(/Memory search failed/);
  });

  it('throws on a failed save rather than pretending it stored something', async () => {
    stubRoutes({ '/memory/stats': { total: 0, categories: 0 } });
    const memory = createLiveMemory(http(), bus);
    await expect(memory.save({ title: 't', snippet: 's', category: 'session' })).rejects.toThrow(
      /save failed/i,
    );
  });

  it('recall() returns null for a miss', async () => {
    stubRoutes({ '/memory/stats': { total: 0, categories: 0 }, '/memory/nope': { record: null } });
    expect(await createLiveMemory(http(), bus).recall('nope')).toBeNull();
  });
});

describe('live agent adapter (OpenClaw)', () => {
  it('builds adapters from the remote roster', async () => {
    stubRoutes({
      '/agents': {
        agents: [
          { id: 'coding', name: 'CODING', role: 'engineering', capabilities: ['code'], status: 'active', activity: 40 },
          { id: 'bad' },
        ],
      },
    });

    const agents = await createLiveAgents(http(), bus);
    expect(agents).toHaveLength(2);
    expect(agents[0].descriptor.adapter).toBe('openclaw');
    expect(agents[0].descriptor.capabilities).toEqual(['code']);
    expect(agents[0].getState().status).toBe('active');
    // The malformed entry still gets safe defaults rather than crashing.
    expect(agents[1].descriptor.name).toBe('bad');
    expect(agents[1].getState().status).toBe('idle');
  });

  it('returns an empty roster when the endpoint answers with nothing usable', async () => {
    stubRoutes({ '/agents': { agents: 'not an array' } });
    expect(await createLiveAgents(http(), bus)).toEqual([]);
  });

  it('run() reports the remote outcome', async () => {
    stubRoutes({
      '/agents': { agents: [{ id: 'coding', name: 'CODING' }] },
      '/agents/coding/run': { ok: true, summary: 'patch drafted' },
    });

    const [agent] = await createLiveAgents(http(), bus);
    expect(await agent.run({ input: 'draft', commandId: 'c1' })).toEqual({
      ok: true,
      summary: 'patch drafted',
    });
  });

  it('run() fails safely and reports on the bus when the runtime is unreachable', async () => {
    stubRoutes({ '/agents': { agents: [{ id: 'coding', name: 'CODING' }] } });
    const errors: string[] = [];
    bus.on('system.error', (r) => errors.push(r.payload.message));

    const [agent] = await createLiveAgents(http(), bus);
    const result = await agent.run({ input: 'draft', commandId: 'c1' });

    expect(result.ok).toBe(false);
    expect(errors[0]).toMatch(/OpenClaw run failed/);
  });
});

describe('live connector adapter', () => {
  it('builds connectors and health-checks them', async () => {
    stubRoutes({
      '/connectors': {
        connectors: [{ id: 'github', name: 'GITHUB', status: 'connected', capabilities: ['read', 'nonsense'] }],
      },
      '/connectors/github/health': { status: 'connected', latencyMs: 12, detail: 'ok' },
    });

    const [connector] = await createLiveConnectors(http());
    expect(connector.capabilities).toEqual(['read']);

    const health = await connector.healthCheck();
    expect(health.status).toBe('connected');
    expect(health.latencyMs).toBe(12);
  });

  it('reports disconnected when the health call fails', async () => {
    stubRoutes({ '/connectors': { connectors: [{ id: 'github' }] } });
    const [connector] = await createLiveConnectors(http());
    const health = await connector.healthCheck();

    expect(health.status).toBe('disconnected');
    expect(health.latencyMs).toBeNull();
  });
});

describe('live telemetry provider', () => {
  it('normalises metrics and reports itself as live', async () => {
    stubRoutes({ '/metrics': { metrics: [{ id: 'cpu', label: 'CPU', value: 130, unit: '%' }] } });
    const provider = createLiveTelemetry(http(), bus, 10_000);

    expect(provider.isMock).toBe(false);
    const snapshot = await new Promise<import('../contracts').TelemetrySnapshot>((resolve) => {
      const stop = provider.subscribe((s) => {
        stop();
        resolve(s);
      });
    });

    // Out-of-range values are clamped rather than blowing out the meter.
    expect(snapshot.metrics[0].value).toBe(100);
    expect(snapshot.isMock).toBe(false);
  });

  it('reports a poll failure once, not on every tick', async () => {
    stubRoutes({});
    const errors: string[] = [];
    bus.on('system.error', (r) => errors.push(r.payload.message));

    const provider = createLiveTelemetry(http(), bus, 5);
    const stop = provider.subscribe(() => {});
    await new Promise((r) => setTimeout(r, 40));
    stop();

    expect(errors.length).toBe(1);
    expect(errors[0]).toMatch(/Metrics poll failed/);
  });
});
