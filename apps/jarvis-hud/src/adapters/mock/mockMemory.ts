/**
 * Mock memory adapter.
 *
 * Implements the full `MemoryService` contract over an in-memory array.
 * `save()` appends to that array and nothing else — no database, no file, no
 * API call.
 *
 * PHASE 4: an AIVM-BRAIN adapter, a Claude-Mem adapter and an
 * Obsidian/Markdown adapter each implement this same interface. The memory
 * panel calls `search()` and does not learn which one answered.
 */

import type {
  EventBus,
  MemoryDraft,
  MemoryQuery,
  MemoryRecord,
  MemoryService,
  MemoryStats,
} from '../../contracts';
import { memoryCategories, memorySeeds } from '../../config/mock.config';

export function createMockMemory(bus: EventBus): MemoryService {
  const now = Date.now();
  let records: MemoryRecord[] = memorySeeds.map((seed, i) => ({
    id: `mem-${i + 1}`,
    title: seed.title,
    snippet: seed.snippet,
    category: seed.category,
    source: seed.source,
    timestamp: now - seed.ago * 60_000,
  }));
  let saved = 0;

  /** Shared by search() and the exported pure helper below. */
  const filter = (query: MemoryQuery): MemoryRecord[] => {
    const text = (query.text ?? '').trim().toLowerCase();
    const category = query.category ?? 'all';
    const hits = records.filter((record) => {
      if (category !== 'all' && record.category !== category) return false;
      if (!text) return true;
      return (
        record.title.toLowerCase().includes(text) ||
        record.snippet.toLowerCase().includes(text) ||
        String(record.source).toLowerCase().includes(text) ||
        record.category.toLowerCase().includes(text)
      );
    });
    return query.limit ? hits.slice(0, query.limit) : hits;
  };

  return {
    async search(query) {
      const hits = filter(query);
      bus.emit('memory.search', {
        query: query.text ?? '',
        scope: query.category ?? 'all',
        results: hits.length,
      });
      return hits;
    },

    async recall(id) {
      return records.find((r) => r.id === id) ?? null;
    },

    async save(draft: MemoryDraft) {
      saved += 1;
      const record: MemoryRecord = {
        id: `mem-saved-${saved}`,
        title: draft.title,
        snippet: draft.snippet,
        category: draft.category,
        source: draft.source ?? 'mock',
        timestamp: Date.now(),
      };
      records = [record, ...records];
      return record;
    },

    async recent(limit = 10) {
      return [...records].sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
    },

    stats(): MemoryStats {
      return {
        total: records.length,
        // "all" is a filter, not a real category.
        categories: memoryCategories.filter((c) => c.id !== 'all').length,
        adapter: 'mock',
      };
    },
  };
}
