/**
 * Jarvis core state machine.
 *
 * Pure and framework-free, so the six states can be reasoned about and tested
 * without rendering anything. The HUD reflects `state`; it never sets it
 * directly except through the explicit `force()` used by the manual preview.
 */

import type { CoreEvent, CoreMachine, CoreState, CoreTransition } from '../contracts';

/**
 * The legal moves.
 *
 *   idle → listening → thinking → working → success | error → idle
 *
 * RESET is accepted from anywhere, so a stuck run can always be recovered.
 */
export const TRANSITIONS: CoreTransition[] = [
  { from: 'idle', event: 'LISTEN', to: 'listening' },
  { from: 'listening', event: 'THINK', to: 'thinking' },
  { from: 'listening', event: 'RESET', to: 'idle' },
  { from: 'thinking', event: 'WORK', to: 'working' },
  { from: 'thinking', event: 'RESOLVE', to: 'success' },
  { from: 'thinking', event: 'FAIL', to: 'error' },
  { from: 'working', event: 'RESOLVE', to: 'success' },
  { from: 'working', event: 'FAIL', to: 'error' },
  { from: 'success', event: 'RESET', to: 'idle' },
  { from: 'error', event: 'RESET', to: 'idle' },
  { from: 'idle', event: 'RESET', to: 'idle' },
  { from: 'working', event: 'RESET', to: 'idle' },
  { from: 'thinking', event: 'RESET', to: 'idle' },
];

/** States that mean "a command owns the core right now". */
export const BUSY_STATES: CoreState[] = ['listening', 'thinking', 'working'];

export function nextState(from: CoreState, event: CoreEvent): CoreState | null {
  return TRANSITIONS.find((t) => t.from === from && t.event === event)?.to ?? null;
}

export function createCoreMachine(initial: CoreState = 'idle'): CoreMachine {
  let state = initial;
  const listeners = new Set<(state: CoreState, previous: CoreState) => void>();

  const commit = (next: CoreState) => {
    const previous = state;
    state = next;
    if (next !== previous) listeners.forEach((l) => l(next, previous));
    return next;
  };

  return {
    get state() {
      return state;
    },
    send(event) {
      const next = nextState(state, event);
      if (next === null) return null;
      return commit(next);
    },
    can(event) {
      return nextState(state, event) !== null;
    },
    force(next) {
      return commit(next);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
