/**
 * Contract barrel.
 *
 * Everything the HUD talks to is described here and nowhere else. Adapters
 * implement these interfaces; the kernel composes them; the UI consumes the
 * kernel. No layer reaches past its neighbour.
 */

export * from './core';
export * from './events';
export * from './agent';
export * from './memory';
export * from './connector';
export * from './telemetry';
export * from './command';
export * from './integration';
export * from './policy';
