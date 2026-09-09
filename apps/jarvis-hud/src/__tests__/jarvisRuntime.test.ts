import { describe, expect, it } from 'vitest';
import { createMockRuntime } from '../adapters/mock';
import type { CoreState } from '../contracts';

/** Instant pacing: the on-screen timings exist for readability, not logic. */
const instant = () =>
  createMockRuntime({ timing: { listening: 0, thinking: 0, working: 0, resolve: 0 } });

/**
 * A read-only command. "Start een taak" and "Onthoud dit" now go through the
 * approval gate, so they are exercised in approvalFlow.test.ts instead.
 */
const READ_COMMAND = 'Open mijn projecten';

/**
 * Runtime-level behaviour: how the kernel composes the pieces, and the
 * distinction between "a command owns the core" and "the core happens to be in
 * a transitional state".
 */
describe('jarvis runtime', () => {
  it('boots idle, not busy, with every registry populated', async () => {
    const runtime = await instant();
    const snapshot = runtime.getSnapshot();

    expect(snapshot.coreState).toBe('idle');
    expect(snapshot.busy).toBe(false);
    expect(snapshot.stage).toBe('idle');
    expect(snapshot.agents).toHaveLength(6);
    expect(snapshot.connectors.length).toBeGreaterThanOrEqual(8);
    expect(snapshot.memory.stats.total).toBeGreaterThan(0);
  });

  it('rebuilds its snapshot reference on change, so subscribers can diff it', async () => {
    const runtime = await instant();
    const first = runtime.getSnapshot();
    let notified = 0;
    runtime.subscribe(() => {
      notified += 1;
    });

    await runtime.dispatch(READ_COMMAND);

    expect(notified).toBeGreaterThan(0);
    expect(runtime.getSnapshot()).not.toBe(first);
  });

  it('previewing a transitional state by hand does not lock the operator out', async () => {
    const runtime = await instant();

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
    const runtime = await instant();
    const inFlight = runtime.dispatch(READ_COMMAND);

    // Give the router a tick to take ownership.
    await new Promise((r) => setTimeout(r, 20));
    expect(runtime.getSnapshot().busy).toBe(true);
    expect(runtime.forceCoreState('error')).toBe(false);

    await inFlight;
    expect(runtime.getSnapshot().busy).toBe(false);
    expect(runtime.forceCoreState('error')).toBe(true);
  });

  it('recovers a hand-parked core when the next command starts', async () => {
    const runtime = await instant();
    runtime.forceCoreState('error');

    const result = await runtime.dispatch(READ_COMMAND);

    expect(result?.ok).toBe(true);
    expect(runtime.getSnapshot().coreState).toBe('idle');
  });

  it('refuses concurrent dispatches and records history newest first', async () => {
    const runtime = await instant();
    const first = runtime.dispatch(READ_COMMAND);
    expect(await runtime.dispatch('Zoek in mijn geheugen')).toBeNull();
    await first;

    await runtime.dispatch('Zoek in mijn geheugen');
    const { history } = runtime.getSnapshot();
    expect(history).toHaveLength(2);
    expect(history[0].input).toBe('Zoek in mijn geheugen');
    expect(history[0].result?.ok).toBe(true);
    expect(runtime.getSnapshot().stage).toBe('result');
  });

  it('ignores empty input', async () => {
    const runtime = await instant();
    expect(await runtime.dispatch('   ')).toBeNull();
    expect(runtime.getSnapshot().history).toHaveLength(0);
  });

  it('start() is idempotent, so StrictMode cannot double the heartbeats', async () => {
    const runtime = await instant();
    const stopA = runtime.start();
    const stopB = runtime.start();
    expect(stopA).toBe(stopB);
    stopA();
  });

  it('records every bus event in the activity log, newest first', async () => {
    const runtime = await instant();
    await runtime.dispatch(READ_COMMAND);
    const names = runtime.getSnapshot().events.map((e) => e.name);

    expect(names[0]).toBe('command.completed');
    expect(names).toContain('command.received');
    expect(names).toContain('agent.started');
  });
});
