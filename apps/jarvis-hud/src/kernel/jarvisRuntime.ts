/**
 * Jarvis runtime — the kernel.
 *
 * Composes the event bus, the core state machine, both registries, the memory
 * service, the telemetry provider and the command router into one object, and
 * exposes an immutable snapshot the UI can subscribe to.
 *
 * There is no React in this file, and no adapter either: everything arrives
 * through the contracts. That is what makes phase 4 a matter of passing
 * different adapters rather than editing the HUD.
 */

import type {
  AgentRegistry,
  AgentView,
  CommandHandler,
  CommandResult,
  CommandStage,
  ConnectorRegistry,
  ConnectorView,
  CoreMachine,
  CoreState,
  EventBus,
  JarvisEventRecord,
  MemoryRecord,
  MemoryService,
  MemoryStats,
  TelemetryProvider,
  TelemetrySnapshot,
} from '../contracts';

export interface CommandHistoryEntry {
  id: string;
  input: string;
  result: CommandResult | null;
  timestamp: number;
}

export interface JarvisSnapshot {
  coreState: CoreState;
  /**
   * True while a COMMAND owns the core — not merely while the core happens to
   * sit in a transitional state. Previewing LISTENING by hand must not lock the
   * operator out of the state selector.
   */
  busy: boolean;
  /** Which of input → processing → result the command center is showing. */
  stage: CommandStage;
  agents: AgentView[];
  connectors: ConnectorView[];
  events: JarvisEventRecord[];
  telemetry: TelemetrySnapshot;
  memory: { stats: MemoryStats; recent: MemoryRecord[] };
  history: CommandHistoryEntry[];
  lastResult: CommandResult | null;
}

export interface JarvisRuntimeDeps {
  bus: EventBus;
  core: CoreMachine;
  agents: AgentRegistry;
  connectors: ConnectorRegistry;
  memory: MemoryService;
  telemetry: TelemetryProvider;
  router: import('../contracts').CommandRouter;
  handlers: CommandHandler[];
  /** Background cadence, all in ms. */
  intervals: { agentTick: number; ambient: number; connectorSweep: number };
  /** Ambient notices emitted while the system is idle. */
  ambient: { source: string; message: string; level: 'info' | 'warning' }[];
  /** Events retained by the activity log. */
  eventLimit: number;
}

export interface JarvisRuntime {
  readonly bus: EventBus;
  readonly memory: MemoryService;
  readonly agents: AgentRegistry;
  readonly connectors: ConnectorRegistry;
  readonly router: import('../contracts').CommandRouter;
  getSnapshot(): JarvisSnapshot;
  subscribe(listener: () => void): () => void;
  /** Runs a command through the router and records it in the history. */
  dispatch(input: string): Promise<CommandResult | null>;
  /** Manual state preview. Ignored while a command owns the core. */
  forceCoreState(state: CoreState): boolean;
  /** Starts the background heartbeats. Returns a stop function. */
  start(): () => void;
}

const MAX_HISTORY = 50;

export function createJarvisRuntime(deps: JarvisRuntimeDeps): JarvisRuntime {
  const { bus, core, agents, connectors, memory, telemetry, router } = deps;

  deps.handlers.forEach((handler) => router.register(handler));

  const listeners = new Set<() => void>();
  let history: CommandHistoryEntry[] = [];
  let events: JarvisEventRecord[] = [];
  let lastResult: CommandResult | null = null;
  let stage: CommandStage = 'idle';
  let recent: MemoryRecord[] = [];
  let telemetrySnapshot: TelemetrySnapshot = {
    metrics: [],
    timestamp: 0,
    adapter: telemetry.adapter,
    isMock: telemetry.isMock,
  };

  let started = false;
  let commandBusy = false;
  let stop: () => void = () => {};

  let snapshot: JarvisSnapshot = build();

  function build(): JarvisSnapshot {
    return {
      coreState: core.state,
      busy: commandBusy,
      stage,
      agents: agents.list(),
      connectors: connectors.list(),
      events,
      telemetry: telemetrySnapshot,
      memory: { stats: memory.stats(), recent },
      history,
      lastResult,
    };
  }

  /** Rebuilds the snapshot once and notifies every subscriber. */
  function commit() {
    snapshot = build();
    listeners.forEach((l) => l());
  }

  // Every published event lands in the activity log.
  bus.onAny((record) => {
    events = [record, ...events].slice(0, deps.eventLimit);
    commit();
  });

  core.subscribe(() => commit());

  return {
    bus,
    memory,
    agents,
    connectors,
    router,

    getSnapshot: () => snapshot,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async dispatch(input: string) {
      const trimmed = input.trim();
      if (!trimmed || commandBusy) return null;

      const entry: CommandHistoryEntry = {
        id: `hist-${history.length + 1}-${Date.now()}`,
        input: trimmed,
        result: null,
        timestamp: Date.now(),
      };
      history = [entry, ...history].slice(0, MAX_HISTORY);
      commandBusy = true;
      stage = 'processing';
      // A manual preview may have parked the core mid-machine; reset so the
      // command always starts its run from idle.
      if (core.state !== 'idle') core.force('idle');
      commit();

      try {
        const result = await router.dispatch(trimmed);

        history = history.map((h) => (h.id === entry.id ? { ...h, result } : h));
        lastResult = result;
        stage = 'result';
        recent = await memory.recent(deps.eventLimit);
        return result;
      } finally {
        commandBusy = false;
        commit();
      }
    },

    forceCoreState(state) {
      // Only a running command blocks the manual preview.
      if (commandBusy) return false;
      core.force(state);
      return true;
    },

    start() {
      // Idempotent: React StrictMode mounts effects twice in development, and
      // a second set of heartbeats would double every background event.
      if (started) return stop;
      started = true;

      const stops: (() => void)[] = [];

      stops.push(
        telemetry.subscribe((next) => {
          telemetrySnapshot = next;
          commit();
        }),
      );

      const agentTimer = setInterval(() => {
        agents.tickAll();
        commit();
      }, deps.intervals.agentTick);
      stops.push(() => clearInterval(agentTimer));

      const ambientTimer = setInterval(() => {
        // Stay quiet while a command runs so its own events stand out.
        if (commandBusy || deps.ambient.length === 0) return;
        const notice = deps.ambient[Math.floor(Math.random() * deps.ambient.length)];
        bus.emit('system.info', notice);
      }, deps.intervals.ambient);
      stops.push(() => clearInterval(ambientTimer));

      const sweepTimer = setInterval(() => {
        if (commandBusy) return;
        void connectors.checkAll().then(commit);
      }, deps.intervals.connectorSweep);
      stops.push(() => clearInterval(sweepTimer));

      // Boot: probe every connector once and seed the memory feed.
      void connectors.checkAll().then(commit);
      void memory.recent(deps.eventLimit).then((records) => {
        recent = records;
        commit();
      });

      stop = () => {
        if (!started) return;
        started = false;
        stops.forEach((fn) => fn());
      };
      return stop;
    },
  };
}
