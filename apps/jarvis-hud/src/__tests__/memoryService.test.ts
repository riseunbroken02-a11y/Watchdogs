import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEventBus } from '../kernel/eventBus';
import { createMockMemory } from '../adapters/mock/mockMemory';
import type { EventBus, MemoryService } from '../contracts';

let bus: EventBus;
let memory: MemoryService;

beforeEach(() => {
  bus = createEventBus();
  memory = createMockMemory(bus);
});

describe('MemoryService contract — mock adapter', () => {
  it('implements all four operations plus stats', () => {
    for (const op of ['search', 'recall', 'save', 'recent', 'stats'] as const) {
      expect(typeof memory[op]).toBe('function');
    }
  });

  it('search() returns everything for an empty query', async () => {
    const all = await memory.search({ text: '', category: 'all' });
    expect(all.length).toBe(memory.stats().total);
  });

  it('search() filters by category and by free text', async () => {
    const decisions = await memory.search({ category: 'decision' });
    expect(decisions.length).toBeGreaterThan(0);
    expect(decisions.every((m) => m.category === 'decision')).toBe(true);

    const byTitle = await memory.search({ text: 'registry' });
    expect(byTitle.length).toBeGreaterThan(0);

    const bySource = await memory.search({ text: 'operator' });
    expect(bySource.length).toBeGreaterThan(0);

    expect(await memory.search({ text: 'zzz-nothing-matches' })).toHaveLength(0);
  });

  it('search() respects the limit', async () => {
    expect(await memory.search({ limit: 3 })).toHaveLength(3);
  });

  it('search() emits memory.search with the result count', async () => {
    const listener = vi.fn();
    bus.on('memory.search', listener);

    const hits = await memory.search({ text: 'registry', category: 'all' });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].payload).toEqual({
      query: 'registry',
      scope: 'all',
      results: hits.length,
    });
  });

  it('recall() returns one record by id, or null', async () => {
    const [first] = await memory.recent(1);
    expect(await memory.recall(first.id)).toEqual(first);
    expect(await memory.recall('does-not-exist')).toBeNull();
  });

  it('save() appends a retrievable record and updates stats', async () => {
    const before = memory.stats().total;
    const saved = await memory.save({
      title: 'Phase 3 architecture',
      snippet: 'Contracts, kernel, adapters, UI.',
      category: 'decision',
    });

    expect(memory.stats().total).toBe(before + 1);
    expect(await memory.recall(saved.id)).toEqual(saved);
    expect((await memory.recent(1))[0].id).toBe(saved.id);
    expect((await memory.search({ text: 'Phase 3 architecture' }))[0].id).toBe(saved.id);
  });

  it('recent() is newest first and honours the limit', async () => {
    const recent = await memory.recent(5);
    expect(recent).toHaveLength(5);
    for (let i = 1; i < recent.length; i += 1) {
      expect(recent[i - 1].timestamp).toBeGreaterThanOrEqual(recent[i].timestamp);
    }
  });

  it('reports the adapter so mock is never mistaken for a real store', () => {
    expect(memory.stats().adapter).toBe('mock');
  });
});
