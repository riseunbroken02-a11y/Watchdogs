import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAgentRegistry } from '../kernel/agentRegistry';
import { createCommandRouter } from '../kernel/commandRouter';
import { createConnectorRegistry } from '../kernel/connectorRegistry';
import { createCoreMachine } from '../kernel/coreMachine';
import { createEventBus } from '../kernel/eventBus';
import { createMockAgents } from '../adapters/mock/mockAgents';
import { createMockConnectors } from '../adapters/mock/mockConnectors';
import { createMockMemory } from '../adapters/mock/mockMemory';
import {
  createFallbackHandler,
  createMockCommandHandlers,
} from '../adapters/mock/mockCommandHandlers';
import type { CommandRouter, CoreMachine, CoreState, EventBus, JarvisEventName } from '../contracts';

let bus: EventBus;
let core: CoreMachine;
let router: CommandRouter;

/** Zero timings so the pipeline runs instantly in tests. */
function build() {
  bus = createEventBus();
  core = createCoreMachine();

  const agents = createAgentRegistry(bus);
  createMockAgents().forEach((a) => agents.register(a));

  const connectors = createConnectorRegistry(bus);
  createMockConnectors().forEach((c) => connectors.register(c));

  const memory = createMockMemory(bus);

  router = createCommandRouter({
    bus,
    core,
    agents,
    memory,
    connectors,
    timing: { listening: 0, thinking: 0, working: 0, resolve: 0 },
    fallback: createFallbackHandler(),
  });
  createMockCommandHandlers().forEach((h) => router.register(h));
}

beforeEach(build);

describe('command router', () => {
  it('registers a handler for every documented example command', () => {
    const examples = router.list().map((h) => h.example);
    for (const command of [
      'Open mijn projecten',
      'Analyseer mijn systeem',
      'Start een taak',
      'Wat is er vandaag actief?',
      'Zoek in mijn geheugen',
    ]) {
      expect(examples).toContain(command);
    }
  });

  it('resolves each example to its own handler', () => {
    for (const handler of router.list()) {
      expect(router.resolve(handler.example).id).toBe(handler.id);
    }
  });

  it('matches free-form phrasing, not just the exact chip text', () => {
    expect(router.resolve('open mijn projecten graag').id).toBe('projects');
    expect(router.resolve('kun je mijn systeem analyseren').id).toBe('system-analysis');
    expect(router.resolve('WAT IS ER VANDAAG ACTIEF').id).toBe('active-today');
    expect(router.resolve('search memory please').id).toBe('memory-search');
  });

  it('falls back for unrecognised input rather than failing', async () => {
    expect(router.resolve('maak een broodje').id).toBe('fallback');
    const result = await router.dispatch('maak een broodje');
    expect(result.ok).toBe(true);
    expect(result.handlerId).toBe('fallback');
    expect(result.reply).toContain('maak een broodje');
    expect(result.detail?.join(' ')).toMatch(/nothing was executed/i);
  });

  it('drives the core through the full state sequence', async () => {
    const seen: CoreState[] = [core.state];
    core.subscribe((state) => seen.push(state));

    await router.dispatch('Open mijn projecten');

    expect(seen).toEqual(['idle', 'listening', 'thinking', 'working', 'success', 'idle']);
  });

  it('routes a failing command to the error state', async () => {
    const seen: CoreState[] = [];
    core.subscribe((state) => seen.push(state));

    const result = await router.dispatch('Open browser');

    expect(result.ok).toBe(false);
    expect(seen).toContain('error');
    expect(seen[seen.length - 1]).toBe('idle');
  });

  it('emits the command lifecycle in order, wrapping the agent events', async () => {
    const names: JarvisEventName[] = [];
    bus.onAny((r) => names.push(r.name));

    await router.dispatch('Open mijn projecten');

    expect(names[0]).toBe('command.received');
    expect(names).toContain('command.started');
    expect(names).toContain('agent.started');
    expect(names).toContain('agent.completed');
    expect(names[names.length - 1]).toBe('command.completed');
  });

  it('reports the handler id and a duration on every result', async () => {
    const result = await router.dispatch('Start een taak');
    expect(result.handlerId).toBe('start-task');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.reply.length).toBeGreaterThan(0);
  });

  it('lets a handler read memory through the service contract', async () => {
    const listener = vi.fn();
    bus.on('memory.search', listener);
    const result = await router.dispatch('Zoek in mijn geheugen');
    expect(listener).toHaveBeenCalled();
    expect(result.reply).toMatch(/Memory holds \d+ records/);
  });

  it('lets a handler read connector health through the registry', async () => {
    const sweeps: string[] = [];
    bus.on('system.info', (r) => sweeps.push(r.description));

    const result = await router.dispatch('Analyseer mijn systeem');

    expect(sweeps.some((d) => /Health sweep/.test(d))).toBe(true);
    expect(result.reply).toMatch(/connectors responded/);
  });

  it('turns a throwing handler into an error result instead of crashing', async () => {
    router.register({
      id: 'explodes',
      title: 'Explodes',
      example: '',
      agents: ['jarvis'],
      matches: (input) => input === 'explode',
      run: async () => {
        throw new Error('handler blew up');
      },
    });

    const errors = vi.fn();
    bus.on('system.error', errors);

    const result = await router.dispatch('explode');

    expect(result.ok).toBe(false);
    expect(result.reply).toContain('handler blew up');
    expect(errors).toHaveBeenCalledTimes(1);
    expect(core.state).toBe('idle');
  });
});
