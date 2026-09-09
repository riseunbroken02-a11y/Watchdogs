import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAgentRegistry } from '../kernel/agentRegistry';
import { createEventBus } from '../kernel/eventBus';
import { createMockAgents } from '../adapters/mock/mockAgents';
import type { AgentRegistry, EventBus } from '../contracts';

let bus: EventBus;
let registry: AgentRegistry;

beforeEach(() => {
  bus = createEventBus();
  registry = createAgentRegistry(bus);
  createMockAgents().forEach((a) => registry.register(a));
});

describe('agent registry', () => {
  it('registers the six agents the architecture requires', () => {
    expect(registry.list().map((a) => a.id)).toEqual([
      'jarvis',
      'coding',
      'research',
      'browser',
      'automation',
      'memory',
    ]);
  });

  it('exposes descriptor and live state in one view', () => {
    for (const a of registry.list()) {
      expect(a.name).toBeTruthy();
      expect(a.role).toBeTruthy();
      expect(a.adapter).toBe('mock');
      expect(a.capabilities.length).toBeGreaterThan(0);
      expect(a.currentTask).toBeTruthy();
      expect(a.activity).toBeGreaterThanOrEqual(0);
      expect(a.activity).toBeLessThanOrEqual(100);
    }
  });

  it('finds agents by capability', () => {
    expect(registry.withCapability('code').map((a) => a.descriptor.id)).toEqual(['coding']);
    expect(registry.withCapability('recall').map((a) => a.descriptor.id)).toEqual(['memory']);
    expect(registry.withCapability('orchestrate').map((a) => a.descriptor.id)).toEqual(['jarvis']);
    expect(registry.withCapability('analyze').length).toBeGreaterThan(1);
  });

  it('wraps run() in agent.started / agent.completed', async () => {
    const started = vi.fn();
    const completed = vi.fn();
    bus.on('agent.started', started);
    bus.on('agent.completed', completed);

    const result = await registry.run('coding', { input: 'draft a patch', commandId: 'c1' });

    expect(result.ok).toBe(true);
    expect(started).toHaveBeenCalledTimes(1);
    expect(completed).toHaveBeenCalledTimes(1);
    expect(started.mock.calls[0][0].payload.task).toBe('draft a patch');
    expect(completed.mock.calls[0][0].payload.ok).toBe(true);
  });

  it('returns the agent to its resting state after a run', async () => {
    const before = registry.list().find((a) => a.id === 'coding')!;
    await registry.run('coding', { input: 'x', commandId: 'c1' });
    const after = registry.list().find((a) => a.id === 'coding')!;

    expect(after.status).toBe(before.status);
    expect(after.lastAction).toBe('Handled: x');
    expect(after.lastActionAt).toBeGreaterThanOrEqual(before.lastActionAt);
  });

  it('refuses to run an offline agent instead of pretending', async () => {
    const result = await registry.run('browser', { input: 'open a page', commandId: 'c1' });
    expect(result.ok).toBe(false);
    expect(result.summary).toMatch(/offline/i);
    expect(registry.list().find((a) => a.id === 'browser')!.status).toBe('offline');
  });

  it('reports an unknown agent as an error rather than throwing', async () => {
    const errors = vi.fn();
    bus.on('system.error', errors);
    // @ts-expect-error — deliberately probing an unregistered id
    const result = await registry.run('does-not-exist', { input: 'x', commandId: 'c1' });
    expect(result.ok).toBe(false);
    expect(errors).toHaveBeenCalledTimes(1);
  });

  it('keeps activity inside 0..100 across many ticks and leaves offline agents at zero', () => {
    for (let i = 0; i < 200; i += 1) registry.tickAll();
    for (const a of registry.list()) {
      expect(a.activity).toBeGreaterThanOrEqual(0);
      expect(a.activity).toBeLessThanOrEqual(100);
    }
    expect(registry.list().find((a) => a.id === 'browser')!.activity).toBe(0);
  });
});
