import { useCallback, useEffect, useRef, useState } from 'react';
import { ambientEventIntervalMs } from '../config/mock.config';
import { agents as agentsConfig } from '../config/jarvis.config';
import { createAgentRoster, engageAgents, releaseAgents, tickAgents } from '../services/agents';
import { runCommand } from '../services/commands';
import { createConnectors } from '../services/connectors';
import { bootEvents, createEvent, randomAmbientEvent } from '../services/events';
import { createMemoryStore } from '../services/memory';
import type {
  AgentInfo,
  ConnectorInfo,
  CoreState,
  EventKind,
  MemoryEntry,
  SystemEvent,
} from '../types';
import { useCommandHistory } from './useCommandHistory';
import { useCoreState } from './useCoreState';
import { useTelemetry } from './useTelemetry';

const MAX_EVENTS = 60;

/**
 * Composes every mock subsystem into one object.
 *
 * Everything here is local and simulated. Wiring real data later means
 * replacing the services this hook calls — the panels consume this shape and
 * do not need to change.
 */
export function useJarvisSystem() {
  const core = useCoreState('idle');
  const telemetry = useTelemetry();
  const history = useCommandHistory();

  const [agents, setAgents] = useState<AgentInfo[]>(createAgentRoster);
  const [memories] = useState<MemoryEntry[]>(createMemoryStore);
  const [connectors] = useState<ConnectorInfo[]>(createConnectors);
  const [events, setEvents] = useState<SystemEvent[]>(bootEvents);
  const [busy, setBusy] = useState(false);

  const pushEvent = useCallback((kind: EventKind, source: string, message: string) => {
    setEvents((prev) => [createEvent(kind, source, message), ...prev].slice(0, MAX_EVENTS));
  }, []);

  /* -------------------------------------------------- agent heartbeat -- */
  useEffect(() => {
    const id = window.setInterval(() => setAgents(tickAgents), agentsConfig.tickIntervalMs);
    return () => window.clearInterval(id);
  }, []);

  /* ------------------------------------------------- ambient events ---- */
  const busyRef = useRef(busy);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    const id = window.setInterval(() => {
      // Stay quiet while a command is running so its own events stand out.
      if (busyRef.current) return;
      setEvents((prev) => [randomAmbientEvent(), ...prev].slice(0, MAX_EVENTS));
    }, ambientEventIntervalMs);
    return () => window.clearInterval(id);
  }, []);

  /* ------------------------------------------------------- commands ---- */
  const execute = useCallback(
    async (input: string) => {
      const trimmed = input.trim();
      if (!trimmed || busyRef.current) return;

      const id = history.add(trimmed);
      setBusy(true);
      busyRef.current = true;
      core.setBusy(true);

      try {
        const result = await runCommand(trimmed, {
          onState: (next: CoreState) => core.setState(next),
          onEvent: pushEvent,
          onAgents: (phase, ids, label) =>
            setAgents((prev) =>
              phase === 'engage' ? engageAgents(prev, ids, label) : releaseAgents(prev, ids, label),
            ),
        });
        history.complete(id, result);
      } finally {
        core.setBusy(false);
        busyRef.current = false;
        setBusy(false);
      }
    },
    [core, history, pushEvent],
  );

  return {
    core,
    telemetry,
    agents,
    memories,
    connectors,
    events,
    history,
    busy,
    execute,
    pushEvent,
  };
}

export type JarvisSystem = ReturnType<typeof useJarvisSystem>;
