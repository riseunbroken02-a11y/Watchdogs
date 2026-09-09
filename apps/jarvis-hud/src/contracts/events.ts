/**
 * Typed event bus contract.
 *
 * Every subsystem publishes here and every panel listens here. Payloads are
 * fully typed, so a listener for `command.completed` cannot accidentally be
 * handed an agent payload.
 */

import type { ConnectorStatus } from './connector';

/** Severity carried by every record, used for colour and filtering. */
export type EventStatus = 'ok' | 'pending' | 'warning' | 'error';

/**
 * The event map. The eight names required by the architecture, plus
 * `system.info` so ambient/heartbeat notices have a home that is clearly not
 * an error.
 */
export interface JarvisEventMap {
  'command.received': { commandId: string; input: string };
  'command.started': { commandId: string; input: string; handlerId: string };
  'command.completed': {
    commandId: string;
    input: string;
    ok: boolean;
    summary: string;
    durationMs: number;
  };
  'agent.started': { agentId: string; agentName: string; task: string };
  'agent.completed': { agentId: string; agentName: string; task: string; ok: boolean };
  'memory.search': { query: string; scope: string; results: number };
  'connector.status': { connectorId: string; connectorName: string; status: ConnectorStatus; detail: string };
  'system.error': { source: string; message: string };
  'system.info': { source: string; message: string; level: 'info' | 'warning' };
}

export type JarvisEventName = keyof JarvisEventMap;

/** A published event, as stored by the activity log. */
export interface JarvisEventRecord<N extends JarvisEventName = JarvisEventName> {
  id: string;
  name: N;
  payload: JarvisEventMap[N];
  /** Emitting subsystem, e.g. "OPENCLAW" or "MEMORY AGENT". */
  source: string;
  status: EventStatus;
  /** One-line human description shown in the activity log. */
  description: string;
  /** Epoch ms. */
  timestamp: number;
}

export type EventListener<N extends JarvisEventName> = (record: JarvisEventRecord<N>) => void;

export interface EventBus {
  /** Publishes an event. Source/status/description are derived if omitted. */
  emit<N extends JarvisEventName>(
    name: N,
    payload: JarvisEventMap[N],
    meta?: { source?: string; status?: EventStatus; description?: string },
  ): JarvisEventRecord<N>;

  /** Subscribes to one event name. Returns an unsubscribe function. */
  on<N extends JarvisEventName>(name: N, listener: EventListener<N>): () => void;

  /** Subscribes to every event. */
  onAny(listener: (record: JarvisEventRecord) => void): () => void;

  /** Removes every listener. Used when a runtime is disposed. */
  clear(): void;
}
