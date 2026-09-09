/**
 * AIVM-BRAIN memory adapter.
 *
 * Implements the same `MemoryService` contract as the mock, over HTTP.
 *
 * Expected endpoint shape:
 *   GET  /memory/search?q=&category=&limit=  → { records: MemoryRecord[] }
 *   GET  /memory/:id                          → { record: MemoryRecord | null }
 *   POST /memory                              → { record: MemoryRecord }
 *   GET  /memory/recent?limit=                → { records: MemoryRecord[] }
 *   GET  /memory/stats                        → { total, categories }
 *
 * `save()` is a write, so it does NOT happen here on its own: the command
 * handler must obtain approval first. This adapter is reachable from a handler
 * only after the gate says yes.
 */

import type {
  EventBus,
  MemoryDraft,
  MemoryRecord,
  MemoryService,
  MemoryStats,
} from '../../contracts';
import type { HttpClient } from './httpClient';

interface RecordsResponse {
  records?: unknown[];
}
interface RecordResponse {
  record?: unknown;
}
interface StatsResponse {
  total?: number;
  categories?: number;
}

/** Accepts whatever the endpoint sends and returns only well-formed records. */
function toRecord(raw: unknown): MemoryRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.title !== 'string') return null;
  return {
    id: r.id,
    title: r.title,
    snippet: typeof r.snippet === 'string' ? r.snippet : '',
    category: typeof r.category === 'string' ? r.category : 'uncategorised',
    source: typeof r.source === 'string' ? r.source : 'aivm-brain',
    timestamp:
      typeof r.timestamp === 'number'
        ? r.timestamp
        : typeof r.timestamp === 'string'
          ? Date.parse(r.timestamp) || Date.now()
          : Date.now(),
  };
}

const toRecords = (raw: unknown[] | undefined): MemoryRecord[] =>
  (raw ?? []).map(toRecord).filter((r): r is MemoryRecord => r !== null);

export function createLiveMemory(http: HttpClient, bus: EventBus): MemoryService {
  // Cached so stats() can stay synchronous, as the contract requires.
  let stats: MemoryStats = { total: 0, categories: 0, adapter: 'aivm-brain' };

  const fail = (operation: string, error: string) => {
    bus.emit('system.error', {
      source: 'AIVM-BRAIN',
      message: `Memory ${operation} failed: ${error}`,
    });
  };

  void http.get<StatsResponse>('/memory/stats').then((result) => {
    if (result.ok && result.data) {
      stats = {
        total: result.data.total ?? 0,
        categories: result.data.categories ?? 0,
        adapter: 'aivm-brain',
      };
    }
  });

  return {
    async search(query) {
      const params: Record<string, string> = {};
      if (query.text) params.q = query.text;
      if (query.category && query.category !== 'all') params.category = query.category;
      if (query.limit) params.limit = String(query.limit);

      const result = await http.get<RecordsResponse>('/memory/search', params);
      if (!result.ok) {
        fail('search', result.error);
        // An empty result is honest here: the log carries the failure, and the
        // panel shows "no matches" rather than stale data.
        bus.emit('memory.search', {
          query: query.text ?? '',
          scope: query.category ?? 'all',
          results: 0,
        });
        return [];
      }

      const records = toRecords(result.data?.records);
      bus.emit('memory.search', {
        query: query.text ?? '',
        scope: query.category ?? 'all',
        results: records.length,
      });
      return records;
    },

    async recall(id) {
      const result = await http.get<RecordResponse>(`/memory/${encodeURIComponent(id)}`);
      if (!result.ok) {
        fail('recall', result.error);
        return null;
      }
      return toRecord(result.data?.record);
    },

    async save(draft: MemoryDraft) {
      const result = await http.post<RecordResponse>('/memory', draft);
      const record = result.ok ? toRecord(result.data?.record) : null;
      if (!record) {
        fail('save', result.ok ? 'Endpoint returned no record' : result.error);
        throw new Error(`AIVM-BRAIN save failed: ${result.error || 'malformed response'}`);
      }
      stats = { ...stats, total: stats.total + 1 };
      return record;
    },

    async recent(limit = 10) {
      const result = await http.get<RecordsResponse>('/memory/recent', { limit: String(limit) });
      if (!result.ok) {
        fail('recent', result.error);
        return [];
      }
      return toRecords(result.data?.records);
    },

    stats: () => stats,
  };
}
