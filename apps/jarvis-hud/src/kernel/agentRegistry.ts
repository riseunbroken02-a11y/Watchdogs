/**
 * Agent registry.
 *
 * Holds adapters, exposes a flat view for the UI, and wraps every run in the
 * agent.started / agent.completed event pair so the activity log gets its
 * entries without any adapter having to remember to emit them.
 */

import type {
  AgentAdapter,
  AgentCapability,
  AgentId,
  AgentRegistry,
  AgentRunResult,
  AgentTask,
  AgentView,
  EventBus,
} from '../contracts';

export function createAgentRegistry(bus: EventBus): AgentRegistry {
  const adapters = new Map<AgentId, AgentAdapter>();

  return {
    register(adapter) {
      adapters.set(adapter.descriptor.id, adapter);
    },

    get(id) {
      return adapters.get(id);
    },

    list(): AgentView[] {
      return [...adapters.values()].map((adapter) => ({
        ...adapter.descriptor,
        ...adapter.getState(),
      }));
    },

    withCapability(capability: AgentCapability) {
      return [...adapters.values()].filter((a) =>
        a.descriptor.capabilities.includes(capability),
      );
    },

    async run(id: AgentId, task: AgentTask): Promise<AgentRunResult> {
      const adapter = adapters.get(id);
      if (!adapter) {
        const message = `No agent registered with id "${id}"`;
        bus.emit('system.error', { source: 'AGENT REGISTRY', message });
        return { ok: false, summary: message };
      }

      const { id: agentId, name } = adapter.descriptor;
      bus.emit('agent.started', { agentId, agentName: name, task: task.input });

      try {
        const result = await adapter.run(task);
        bus.emit('agent.completed', {
          agentId,
          agentName: name,
          task: task.input,
          ok: result.ok,
        });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        bus.emit('agent.completed', { agentId, agentName: name, task: task.input, ok: false });
        bus.emit('system.error', { source: name, message });
        return { ok: false, summary: message };
      }
    },

    tickAll() {
      adapters.forEach((adapter) => adapter.tick?.());
    },
  };
}
