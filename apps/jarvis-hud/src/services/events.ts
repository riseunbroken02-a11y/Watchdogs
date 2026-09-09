/**
 * Event stream — SIMULATION ONLY.
 *
 * Events are generated in the browser from `mock.config.ts`. No log file, no
 * socket, no external source is read.
 */

import { ambientEvents } from '../config/mock.config';
import type { EventKind, SystemEvent } from '../types';

let counter = 0;

export function createEvent(kind: EventKind, source: string, message: string): SystemEvent {
  counter += 1;
  return { id: `evt-${counter}`, kind, source, message, timestamp: Date.now() };
}

/** One random ambient event, used by the heartbeat. */
export function randomAmbientEvent(): SystemEvent {
  const seed = ambientEvents[Math.floor(Math.random() * ambientEvents.length)];
  return createEvent(seed.kind as EventKind, seed.source, seed.message);
}

/** Events shown before the operator does anything, newest first. */
export function bootEvents(): SystemEvent[] {
  const boot: [EventKind, string, string][] = [
    ['info', 'SYSTEM', 'JARVIS HUD phase 2 initialised — mock mode'],
    ['agent-start', 'MAIN AGENT', 'Agent roster online · 6 agents registered'],
    ['info', 'OMNIROUTE', 'Model router ready · 6 routes'],
    ['memory', 'CLAUDE-MEM', 'Memory store attached · 418 entries'],
    ['warning', 'HEADROOM', 'Context budget at 62% free'],
  ];
  // Reverse so the newest boot line ends up first in the stream.
  return boot.map(([kind, source, message]) => createEvent(kind, source, message)).reverse();
}
