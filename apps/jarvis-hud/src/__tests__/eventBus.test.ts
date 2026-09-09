import { describe, expect, it, vi } from 'vitest';
import { createEventBus } from '../kernel/eventBus';
import type { JarvisEventName } from '../contracts';

const ALL_EVENTS: JarvisEventName[] = [
  'command.received',
  'command.started',
  'command.completed',
  'agent.started',
  'agent.completed',
  'memory.search',
  'connector.status',
  'system.error',
  'system.info',
];

describe('typed event bus', () => {
  it('delivers only to listeners of that event name', () => {
    const bus = createEventBus();
    const onCommand = vi.fn();
    const onAgent = vi.fn();
    bus.on('command.received', onCommand);
    bus.on('agent.started', onAgent);

    bus.emit('command.received', { commandId: 'c1', input: 'hallo' });

    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onAgent).not.toHaveBeenCalled();
    expect(onCommand.mock.calls[0][0].payload.input).toBe('hallo');
  });

  it('delivers every event to onAny listeners', () => {
    const bus = createEventBus();
    const seen: JarvisEventName[] = [];
    bus.onAny((record) => seen.push(record.name));

    bus.emit('command.received', { commandId: 'c1', input: 'x' });
    bus.emit('memory.search', { query: 'x', scope: 'all', results: 2 });
    bus.emit('system.error', { source: 'TEST', message: 'boom' });

    expect(seen).toEqual(['command.received', 'memory.search', 'system.error']);
  });

  it('derives source, status and description for all nine event types', () => {
    const bus = createEventBus();
    const records = [
      bus.emit('command.received', { commandId: 'c', input: 'open projects' }),
      bus.emit('command.started', { commandId: 'c', input: 'x', handlerId: 'projects' }),
      bus.emit('command.completed', { commandId: 'c', input: 'x', ok: true, summary: 'done', durationMs: 12 }),
      bus.emit('agent.started', { agentId: 'coding', agentName: 'CODING AGENT', task: 't' }),
      bus.emit('agent.completed', { agentId: 'coding', agentName: 'CODING AGENT', task: 't', ok: true }),
      bus.emit('memory.search', { query: 'q', scope: 'all', results: 1 }),
      bus.emit('connector.status', { connectorId: 'github', connectorName: 'GITHUB', status: 'mock', detail: 'repo' }),
      bus.emit('system.error', { source: 'KERNEL', message: 'bad' }),
      bus.emit('system.info', { source: 'KERNEL', message: 'note', level: 'warning' }),
    ];

    expect(records.map((r) => r.name)).toEqual(ALL_EVENTS);
    for (const record of records) {
      expect(record.source.length).toBeGreaterThan(0);
      expect(record.description.length).toBeGreaterThan(0);
      expect(['ok', 'pending', 'warning', 'error']).toContain(record.status);
      expect(record.timestamp).toBeGreaterThan(0);
    }
  });

  it('maps failure and warning onto the right status', () => {
    const bus = createEventBus();
    expect(bus.emit('command.completed', { commandId: 'c', input: 'x', ok: false, summary: 's', durationMs: 1 }).status).toBe('error');
    expect(bus.emit('agent.completed', { agentId: 'a', agentName: 'A', task: 't', ok: false }).status).toBe('error');
    expect(bus.emit('system.info', { source: 'S', message: 'm', level: 'warning' }).status).toBe('warning');
    expect(bus.emit('system.error', { source: 'S', message: 'm' }).status).toBe('error');
  });

  it('lets metadata be overridden explicitly', () => {
    const bus = createEventBus();
    const record = bus.emit(
      'system.info',
      { source: 'X', message: 'm', level: 'info' },
      { source: 'OVERRIDE', status: 'warning', description: 'custom' },
    );
    expect(record.source).toBe('OVERRIDE');
    expect(record.status).toBe('warning');
    expect(record.description).toBe('custom');
  });

  it('gives every record a unique id and unsubscribes cleanly', () => {
    const bus = createEventBus();
    const ids = new Set<string>();
    const listener = vi.fn();
    const off = bus.on('system.info', listener);

    for (let i = 0; i < 20; i += 1) {
      ids.add(bus.emit('system.info', { source: 'S', message: `m${i}`, level: 'info' }).id);
    }
    expect(ids.size).toBe(20);
    expect(listener).toHaveBeenCalledTimes(20);

    off();
    bus.emit('system.info', { source: 'S', message: 'after', level: 'info' });
    expect(listener).toHaveBeenCalledTimes(20);

    bus.clear();
    const any = vi.fn();
    bus.onAny(any);
    bus.clear();
    bus.emit('system.info', { source: 'S', message: 'x', level: 'info' });
    expect(any).not.toHaveBeenCalled();
  });
});
