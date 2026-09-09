import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRuntime } from '../adapters';
import { createMockRuntime } from '../adapters/mock';
import type { CoreState, JarvisEventName } from '../contracts';
import type { JarvisRuntime } from '../kernel/jarvisRuntime';

/**
 * The whole path the architecture describes:
 *
 *   operator → command center → core state machine → agents / memory /
 *   connectors → approval gate → result → HUD snapshot
 */

const INSTANT = { listening: 0, thinking: 0, working: 0, resolve: 0 };
const QUIET = { agentTick: 10_000, ambient: 10_000, connectorSweep: 10_000 };

const build = () =>
  createMockRuntime({ timing: INSTANT, intervals: QUIET, approvalTimeoutMs: 200 });

/** Approves (or denies) the next request as soon as it appears. */
function autoDecide(runtime: JarvisRuntime, outcome: 'approved' | 'denied') {
  const stop = runtime.approvals.subscribe((pending) => {
    if (pending) runtime.approvals.resolve(pending.id, outcome);
  });
  return stop;
}

afterEach(() => vi.unstubAllGlobals());

describe('end-to-end command flow', () => {
  it('carries a read command from input to a rendered result', async () => {
    const runtime = await build();
    const names: JarvisEventName[] = [];
    const states: CoreState[] = [runtime.getSnapshot().coreState];
    runtime.bus.onAny((r) => names.push(r.name));
    runtime.subscribe(() => {
      const state = runtime.getSnapshot().coreState;
      if (states[states.length - 1] !== state) states.push(state);
    });

    const result = await runtime.dispatch('Analyseer mijn systeem');

    // 1. the core walked the machine
    expect(states).toEqual(['idle', 'listening', 'thinking', 'working', 'success', 'idle']);
    // 2. the lifecycle is on the bus, wrapping the agent and connector work
    expect(names[0]).toBe('command.received');
    expect(names).toContain('command.started');
    expect(names).toContain('agent.started');
    expect(names).toContain('agent.completed');
    expect(names[names.length - 1]).toBe('command.completed');
    // 3. the result reached the snapshot the HUD renders
    const snapshot = runtime.getSnapshot();
    expect(snapshot.lastResult?.reply).toBe(result?.reply);
    expect(snapshot.stage).toBe('result');
    expect(snapshot.history[0].result?.handlerId).toBe('system-analysis');
    // 4. the activity log has the record, newest first
    expect(snapshot.events[0].name).toBe('command.completed');
  });

  it('stops a write at the gate and performs it only after approval', async () => {
    const runtime = await build();
    const before = runtime.getSnapshot().memory.stats.total;

    const denied = runtime.dispatch('Onthoud dit: fase 4 is af');
    const stopDeny = autoDecide(runtime, 'denied');
    const deniedResult = await denied;
    stopDeny();

    expect(deniedResult?.ok).toBe(false);
    expect(deniedResult?.reply).toMatch(/Nothing saved/);
    expect(runtime.getSnapshot().memory.stats.total).toBe(before);

    const approved = runtime.dispatch('Onthoud dit: fase 4 is af');
    const stopApprove = autoDecide(runtime, 'approved');
    const approvedResult = await approved;
    stopApprove();

    expect(approvedResult?.ok).toBe(true);
    expect(approvedResult?.reply).toMatch(/Saved to memory/);
    expect(runtime.getSnapshot().memory.stats.total).toBe(before + 1);
  });

  it('surfaces the pending approval in the snapshot so the dialog can render it', async () => {
    const runtime = await build();
    const inFlight = runtime.dispatch('Start een taak');

    await vi.waitFor(() => expect(runtime.getSnapshot().pendingApproval).not.toBeNull());
    const pending = runtime.getSnapshot().pendingApproval!;
    expect(pending.kind).toBe('execute');
    expect(pending.target).toBe('automation-agent');

    runtime.approvals.resolve(pending.id, 'approved');
    const result = await inFlight;

    expect(result?.ok).toBe(true);
    expect(runtime.getSnapshot().pendingApproval).toBeNull();
  });

  it('auto-denies an unanswered approval and reports it honestly', async () => {
    const runtime = await build();
    const result = await runtime.dispatch('Start een taak');

    expect(result?.ok).toBe(false);
    expect(result?.detail?.join(' ')).toMatch(/expired/);
    expect(runtime.getSnapshot().coreState).toBe('idle');
  });

  it('reports every subsystem as mock when nothing is configured', async () => {
    const runtime = await build();
    const { bindings } = runtime.getSnapshot();

    expect(bindings.map((b) => b.id)).toEqual(['memory', 'agents', 'connectors', 'telemetry']);
    expect(bindings.every((b) => b.state === 'mock')).toBe(true);
    expect(bindings.every((b) => b.adapter === 'mock')).toBe(true);
    expect(bindings.every((b) => b.reason.length > 0)).toBe(true);
  });
});

describe('end-to-end with a live memory adapter', () => {
  /** A stub AIVM-BRAIN that answers the four routes the adapter uses. */
  function stubBrain() {
    const records = [
      { id: 'live-1', title: 'Live record', snippet: 'from the stub brain', category: 'decision', timestamp: Date.now() },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const path = new URL(url).pathname;
        const body =
          path === '/health'
            ? { status: 'ok' }
            : path === '/memory/stats'
              ? { total: records.length, categories: 3 }
              : path === '/memory/search' || path === '/memory/recent'
                ? { records }
                : null;
        if (body === null) throw new TypeError('Failed to fetch');
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );
  }

  const liveMemoryRuntime = (): Promise<JarvisRuntime> =>
    createRuntime({
      timing: INSTANT,
      intervals: QUIET,
      approvalTimeoutMs: 200,
      integrations: {
        memory: { mode: 'live', endpoint: 'http://127.0.0.1:8787', timeoutMs: 500 },
        agents: { mode: 'mock', endpoint: '', timeoutMs: 500 },
        connectors: { mode: 'mock', endpoint: '', timeoutMs: 500 },
        telemetry: { mode: 'mock', endpoint: '', timeoutMs: 500 },
      },
    });

  it('binds memory live while the other subsystems stay mock', async () => {
    stubBrain();
    const runtime = await liveMemoryRuntime();
    const { bindings } = runtime.getSnapshot();

    const memory = bindings.find((b) => b.id === 'memory')!;
    expect(memory.state).toBe('live');
    expect(memory.adapter).toBe('aivm-brain');
    expect(memory.latencyMs).not.toBeNull();

    // One live subsystem must not drag the others across.
    expect(bindings.filter((b) => b.id !== 'memory').every((b) => b.state === 'mock')).toBe(true);
  });

  it('serves a command from the live store, and says which adapter answered', async () => {
    stubBrain();
    const runtime = await liveMemoryRuntime();
    const result = await runtime.dispatch('Zoek in mijn geheugen');

    expect(result?.ok).toBe(true);
    expect(result?.detail?.join(' ')).toContain('aivm-brain');
    expect(runtime.getSnapshot().memory.stats.adapter).toBe('aivm-brain');
  });

  it('falls back to mock and flags the failure when the endpoint dies', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    const runtime = await liveMemoryRuntime();
    const memory = runtime.getSnapshot().bindings.find((b) => b.id === 'memory')!;

    expect(memory.state).toBe('failed');
    expect(memory.adapter).toBe('mock');
    expect(memory.reason).toMatch(/did not answer/);

    // The HUD still works: a command served by the mock store succeeds.
    const result = await runtime.dispatch('Zoek in mijn geheugen');
    expect(result?.ok).toBe(true);
    expect(runtime.getSnapshot().memory.stats.adapter).toBe('mock');
  });
});
