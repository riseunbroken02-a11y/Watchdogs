import { describe, expect, it, vi } from 'vitest';
import { BUSY_STATES, createCoreMachine, nextState, TRANSITIONS } from '../kernel/coreMachine';
import type { CoreState } from '../contracts';

const ALL_STATES: CoreState[] = ['idle', 'listening', 'thinking', 'working', 'success', 'error'];

describe('jarvis core state machine', () => {
  it('starts idle and exposes all six states', () => {
    expect(createCoreMachine().state).toBe('idle');
    const reachable = new Set<CoreState>(['idle']);
    TRANSITIONS.forEach((t) => reachable.add(t.to));
    expect([...reachable].sort()).toEqual([...ALL_STATES].sort());
  });

  it('walks the happy path idle → listening → thinking → working → success → idle', () => {
    const m = createCoreMachine();
    expect(m.send('LISTEN')).toBe('listening');
    expect(m.send('THINK')).toBe('thinking');
    expect(m.send('WORK')).toBe('working');
    expect(m.send('RESOLVE')).toBe('success');
    expect(m.send('RESET')).toBe('idle');
  });

  it('reaches error from thinking and from working', () => {
    const a = createCoreMachine();
    a.send('LISTEN');
    a.send('THINK');
    expect(a.send('FAIL')).toBe('error');

    const b = createCoreMachine();
    b.send('LISTEN');
    b.send('THINK');
    b.send('WORK');
    expect(b.send('FAIL')).toBe('error');
  });

  it('rejects illegal transitions instead of guessing', () => {
    const m = createCoreMachine();
    expect(m.send('RESOLVE')).toBeNull();
    expect(m.send('WORK')).toBeNull();
    expect(m.state).toBe('idle');
    expect(m.can('LISTEN')).toBe(true);
    expect(m.can('FAIL')).toBe(false);
  });

  it('accepts RESET from every state so a run can always be recovered', () => {
    for (const state of ALL_STATES) {
      expect(nextState(state, 'RESET')).toBe('idle');
    }
  });

  it('force() bypasses the guards for the manual preview', () => {
    const m = createCoreMachine();
    expect(m.force('error')).toBe('error');
    expect(m.force('success')).toBe('success');
  });

  it('notifies subscribers only on a real change', () => {
    const m = createCoreMachine();
    const listener = vi.fn();
    const off = m.subscribe(listener);

    m.send('LISTEN');
    expect(listener).toHaveBeenCalledWith('listening', 'idle');
    listener.mockClear();

    m.force('listening');
    expect(listener).not.toHaveBeenCalled();

    off();
    m.send('THINK');
    expect(listener).not.toHaveBeenCalled();
  });

  it('marks exactly the in-flight states as busy', () => {
    expect(BUSY_STATES).toEqual(['listening', 'thinking', 'working']);
    expect(BUSY_STATES).not.toContain('idle');
    expect(BUSY_STATES).not.toContain('error');
  });
});
