/**
 * Typed event bus.
 *
 * Small on purpose: a map of listener sets, plus derived metadata so every
 * record the activity log receives already carries a source, a status and a
 * human description.
 */

import type {
  EventBus,
  EventListener,
  EventStatus,
  JarvisEventMap,
  JarvisEventName,
  JarvisEventRecord,
} from '../contracts';

/** Default source + status + description per event name. */
const DERIVE: {
  [N in JarvisEventName]: (p: JarvisEventMap[N]) => {
    source: string;
    status: EventStatus;
    description: string;
  };
} = {
  'command.received': (p) => ({
    source: 'OPERATOR',
    status: 'pending',
    description: p.input,
  }),
  'command.started': (p) => ({
    source: 'COMMAND ROUTER',
    status: 'pending',
    description: `Routed to handler "${p.handlerId}"`,
  }),
  'command.completed': (p) => ({
    source: 'JARVIS',
    status: p.ok ? 'ok' : 'error',
    description: `${p.summary} (${p.durationMs} ms)`,
  }),
  'agent.started': (p) => ({
    source: p.agentName,
    status: 'pending',
    description: p.task,
  }),
  'agent.completed': (p) => ({
    source: p.agentName,
    status: p.ok ? 'ok' : 'error',
    description: p.ok ? `Completed: ${p.task}` : `Failed: ${p.task}`,
  }),
  'memory.search': (p) => ({
    source: 'MEMORY',
    status: 'ok',
    description: `"${p.query || '*'}" in ${p.scope} — ${p.results} result${p.results === 1 ? '' : 's'}`,
  }),
  'connector.status': (p) => ({
    source: p.connectorName,
    status:
      p.status === 'connected' ? 'ok' : p.status === 'disconnected' ? 'warning' : 'ok',
    description: `${p.status.replace('-', ' ')} — ${p.detail}`,
  }),
  'system.error': (p) => ({
    source: p.source,
    status: 'error',
    description: p.message,
  }),
  'system.info': (p) => ({
    source: p.source,
    status: p.level === 'warning' ? 'warning' : 'ok',
    description: p.message,
  }),
};

export function createEventBus(): EventBus {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- one map, many payload shapes; each `on` call is typed at the boundary.
  const listeners = new Map<JarvisEventName, Set<(record: any) => void>>();
  const anyListeners = new Set<(record: JarvisEventRecord) => void>();
  let counter = 0;

  return {
    emit(name, payload, meta) {
      counter += 1;
      const derived = DERIVE[name](payload);
      const record: JarvisEventRecord<typeof name> = {
        id: `evt-${counter}`,
        name,
        payload,
        source: meta?.source ?? derived.source,
        status: meta?.status ?? derived.status,
        description: meta?.description ?? derived.description,
        timestamp: Date.now(),
      };

      listeners.get(name)?.forEach((listener) => listener(record));
      anyListeners.forEach((listener) => listener(record as JarvisEventRecord));
      return record;
    },

    on<N extends JarvisEventName>(name: N, listener: EventListener<N>) {
      let set = listeners.get(name);
      if (!set) {
        set = new Set();
        listeners.set(name, set);
      }
      set.add(listener);
      return () => {
        set?.delete(listener);
      };
    },

    onAny(listener) {
      anyListeners.add(listener);
      return () => {
        anyListeners.delete(listener);
      };
    },

    clear() {
      listeners.clear();
      anyListeners.clear();
    },
  };
}
