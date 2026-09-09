/**
 * Core state contract.
 *
 * The Jarvis core is a finite state machine. Everything in the HUD — the
 * central visual, the accent colour, the command pipeline — is driven from
 * these six states and nothing else.
 */

export type CoreState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'working'
  | 'success'
  | 'error';

/** Events the machine accepts. Anything else is rejected by the guard. */
export type CoreEvent =
  | 'LISTEN'
  | 'THINK'
  | 'WORK'
  | 'RESOLVE'
  | 'FAIL'
  | 'RESET';

export interface CoreTransition {
  from: CoreState;
  event: CoreEvent;
  to: CoreState;
}

export interface CoreMachine {
  readonly state: CoreState;
  /** Applies an event. Returns the new state, or null when not allowed. */
  send(event: CoreEvent): CoreState | null;
  /** True when the event would be accepted from the current state. */
  can(event: CoreEvent): boolean;
  /** Forces a state, bypassing the guards. Used by the manual state preview. */
  force(state: CoreState): CoreState;
  /** Called after every accepted change. */
  subscribe(listener: (state: CoreState, previous: CoreState) => void): () => void;
}
