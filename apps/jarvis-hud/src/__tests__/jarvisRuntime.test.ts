import { describe, expect, it } from 'vitest';
import { createMockRuntime } from '../adapters/mock';
import type { CoreState } from '../contracts';

/** Instant pacing: the on-screen timings exist for readability, not logic. */
const instant = () => createMockRuntime({ timing: { listening: 0, thinking: 0, working: 0, resolve: 0 } });

/**
 * Runtime-level behaviour: how the kernel composes the pieces, and the
 * distinction between "a command owns the core" and "the core happens to be in
 * a transitional state".
 */
describe('jarvis runtime', () => {
  it('boots idle, not busy, with every registry populated', () => {
    const runtime = instant();
    const snapshot = runtime.getSnapshot();

    expect(snapshot.coreState).toBe('idle');
    expect(snapshot.busy).toBe(false);
    expect(snapshot.stage).toBe('idle');
    expect(snapshot.agents).toHaveLength(6);
    expect(snapshot.connectors.length).toBeGreaterThanOrEqual(8);
    expect(snapshot.memory.stats.total).toBeGreaterThan(0);
  });

  it('rebuilds its snapshot reference on change, so subscribers can diff it', async () => {
    const runtime = instant();
    const first = runtime.getSnapshot();
    let notified = 0;
    runtime.subscribe(() => {
      notified += 1;
    });

    await runtime.dispatch('Start een taak');

    expect(notified).toBeGreaterThan(0);
    expect(runtime.getSnapshot()).not.toBe(first);
  });

  it('previewing a transitional state by hand does not lock the operator out', () => {
    const runtime = instant();

    // listening/thinking/working are transitional, but no command owns the
    // core, so the operator must be able to step back out again.
    for (const state of ['listening', 'thinking', 'working'] as CoreState[]) {
      expect(runtime.forceCoreState(state)).toBe(true);
      expect(runtime.getSnapshot().coreState).toBe(state);
      expect(runtime.getSnapshot().busy).toBe(false);
    }

    expect(runtime.forceCoreState('idle')).toBe(true);
    expect(runtime.getSnapshot().coreState).toBe('idle');
  });

  it('blocks the manual preview only while a command is running', async () => {
    const runtime = instant();
    const inFlight = runtime.dispatch('Start een taak');

    // Give the router a tick to take ownership.
    await new Promise((r) => setTimeout(r, 20));
    expect(runtime.getSnapshot().busy).toBe(true);
    expect(runtime.forceCoreState('error')).toBe(false);

    await inFlight;
    expect(runtime.getSnapshot().busy).toBe(false);
    expect(runtime.forceCoreState('error')).toBe(true);
  });

  it('recovers a hand-parked core when the next command starts', async () => {
    const runtime = instant();
    runtime.forceCoreState('error');

    const result = await runtime.dispatch('Start een taak');

    expect(result?.ok).toBe(true);
    expect(runtime.getSnapshot().coreState).toBe('idle');
  });

  it('refuses concurrent dispatches and records history newest first', async () => {
    const runtime = instant();
    const first = runtime.dispatch('Start een taak');
    expect(await runtime.dispatch('Open mijn projecten')).toBeNull();
    await first;

    await runtime.dispatch('Open mijn projecten');
    const { history } = runtime.getSnapshot();
    expect(history).toHaveLength(2);
    expect(history[0].input).toBe('Open mijn projecten');
    expect(history[0].result?.ok).toBe(true);
    expect(runtime.getSnapshot().stage).toBe('result');
  });

  it('ignores empty input', async () => {
    const runtime = instant();
    expect(await runtime.dispatch('   ')).toBeNull();
    expect(runtime.getSnapshot().history).toHaveLength(0);
  });

  it('start() is idempotent, so StrictMode cannot double the heartbeats', () => {
    const runtime = instant();
    const stopA = runtime.start();
    const stopB = runtime.start();
    expect(stopA).toBe(stopB);
    stopA();
  });

  it('records every bus event in the activity log, newest first', async () => {
    const runtime = instant();
    await runtime.dispatch('Open mijn projecten');
    const names = runtime.getSnapshot().events.map((e) => e.name);

    expect(names[0]).toBe('command.completed');
    expect(names).toContain('command.received');
    expect(names).toContain('agent.started');
  });
});
