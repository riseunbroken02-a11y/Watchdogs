import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createConnectorRegistry } from '../kernel/connectorRegistry';
import { createEventBus } from '../kernel/eventBus';
import { createMockConnectors } from '../adapters/mock/mockConnectors';
import type { ConnectorRegistry, ConnectorStatus, EventBus } from '../contracts';

let bus: EventBus;
let registry: ConnectorRegistry;

beforeEach(() => {
  bus = createEventBus();
  registry = createConnectorRegistry(bus);
  createMockConnectors().forEach((c) => registry.register(c));
});

describe('connector registry', () => {
  it('registers every connector the architecture requires', () => {
    const ids = registry.list().map((c) => c.id);
    for (const required of [
      'aivm-brain',
      'openclaw',
      'claude-code',
      'claude-mem',
      'github',
      'notion',
      'gmail',
      'google-calendar',
    ]) {
      expect(ids).toContain(required);
    }
  });

  it('exposes id, name, status and capabilities for each connector', () => {
    for (const c of registry.list()) {
      expect(c.id).toBeTruthy();
      expect(c.name).toBeTruthy();
      expect(['connected', 'disconnected', 'mock', 'not-configured']).toContain(c.status);
      expect(Array.isArray(c.capabilities)).toBe(true);
      expect(c.capabilities.length).toBeGreaterThan(0);
    }
  });

  it('get() returns the connector, and undefined for an unknown id', () => {
    expect(registry.get('github')?.name).toBe('GITHUB');
    expect(registry.get('nope')).toBeUndefined();
  });

  it('check() runs healthCheck and records the result', async () => {
    const health = await registry.check('github');

    expect(health?.status).toBe('mock');
    expect(health?.checkedAt).toBeGreaterThan(0);
    expect(registry.list().find((c) => c.id === 'github')?.latencyMs).toBeGreaterThan(0);
  });

  it('stays quiet when a repeated check finds the same status', async () => {
    const listener = vi.fn();
    bus.on('connector.status', listener);

    await registry.check('github');
    await registry.check('github');

    // A status event marks a transition; repeating an unchanged status would
    // bury everything else in the activity log.
    expect(listener).not.toHaveBeenCalled();
  });

  it('emits connector.status when a status actually changes', async () => {
    const listener = vi.fn();
    bus.on('connector.status', listener);

    let status: ConnectorStatus = 'mock';
    registry.register({
      id: 'flaky',
      name: 'FLAKY',
      capabilities: ['read'],
      get status() {
        return status;
      },
      async healthCheck() {
        return { status, latencyMs: 5, detail: 'stub', checkedAt: Date.now() };
      },
    });

    await registry.check('flaky');
    expect(listener).not.toHaveBeenCalled();

    status = 'disconnected';
    await registry.check('flaky');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].payload).toMatchObject({
      connectorId: 'flaky',
      status: 'disconnected',
    });
  });

  it('check() returns null for an unknown connector', async () => {
    expect(await registry.check('nope')).toBeNull();
  });

  it('checkAll() summarises the sweep in one event instead of one per connector', async () => {
    const perConnector = vi.fn();
    const summaries: string[] = [];
    bus.on('connector.status', perConnector);
    bus.on('system.info', (r) => summaries.push(r.description));

    await registry.checkAll();

    expect(perConnector).not.toHaveBeenCalled();
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatch(/Health sweep — \d+\/\d+ connectors responded/);
  });

  it('checkAll() probes every connector and records latency for reachable ones', async () => {
    const views = await registry.checkAll();
    expect(views).toHaveLength(registry.list().length);
    for (const v of views) {
      expect(v.checkedAt).not.toBeNull();
      if (v.status === 'mock' || v.status === 'connected') {
        expect(v.latencyMs).toBeGreaterThan(0);
      } else {
        expect(v.latencyMs).toBeNull();
      }
    }
  });

  it('never reports a real connection in phase 3', async () => {
    const views = await registry.checkAll();
    expect(views.some((v) => v.status === 'connected')).toBe(false);
  });
});
