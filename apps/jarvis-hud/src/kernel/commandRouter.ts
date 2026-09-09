/**
 * Command router.
 *
 * input → processing → result, with the core state machine and the event bus
 * driven from one place. Handlers are registered, never hardcoded here, so a
 * real backend can add its own without touching this file or the UI.
 */

import type {
  AgentId,
  AgentRegistry,
  CommandContext,
  CommandHandler,
  CommandResult,
  CommandRouter,
  ConnectorRegistry,
  CoreMachine,
  EventBus,
  MemoryService,
} from '../contracts';

export interface CommandRouterDeps {
  bus: EventBus;
  core: CoreMachine;
  agents: AgentRegistry;
  memory: MemoryService;
  connectors: ConnectorRegistry;
  /** Pacing of the visual pipeline, in ms. */
  timing: { listening: number; thinking: number; working: number; resolve: number };
  /** Handler used when nothing matches. */
  fallback: CommandHandler;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function createCommandRouter(deps: CommandRouterDeps): CommandRouter {
  const { bus, core, agents, memory, connectors, timing, fallback } = deps;
  const handlers: CommandHandler[] = [];
  let counter = 0;

  return {
    register(handler) {
      handlers.push(handler);
    },

    list() {
      return [...handlers];
    },

    resolve(input) {
      return handlers.find((h) => h.matches(input)) ?? fallback;
    },

    async dispatch(input: string): Promise<CommandResult> {
      counter += 1;
      const id = `cmd-${counter}`;
      const startedAt = Date.now();
      const trimmed = input.trim();

      bus.emit('command.received', { commandId: id, input: trimmed });

      const handler = this.resolve(trimmed);
      const context: CommandContext = {
        request: { id, input: trimmed, receivedAt: startedAt },
        runAgent: (agentId: AgentId, agentInput: string) =>
          agents.run(agentId, { input: agentInput, commandId: id }),
        memory,
        connectors,
        progress: (message) =>
          bus.emit('system.info', { source: handler.id.toUpperCase(), message, level: 'info' }),
      };

      // --- input -----------------------------------------------------------
      core.send('LISTEN');
      await wait(timing.listening);

      // --- processing ------------------------------------------------------
      core.send('THINK');
      bus.emit('command.started', { commandId: id, input: trimmed, handlerId: handler.id });
      await wait(timing.thinking);

      core.send('WORK');

      let outcome: Omit<CommandResult, 'handlerId' | 'durationMs'>;
      try {
        outcome = await handler.run(context);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        bus.emit('system.error', { source: 'COMMAND ROUTER', message });
        outcome = { ok: false, reply: `Handler "${handler.id}" failed: ${message}` };
      }

      await wait(timing.working);

      // --- result ----------------------------------------------------------
      const durationMs = Date.now() - startedAt;
      const result: CommandResult = { ...outcome, handlerId: handler.id, durationMs };

      core.send(result.ok ? 'RESOLVE' : 'FAIL');
      bus.emit('command.completed', {
        commandId: id,
        input: trimmed,
        ok: result.ok,
        summary: result.reply,
        durationMs,
      });

      await wait(timing.resolve);
      core.send('RESET');

      return result;
    },
  };
}
