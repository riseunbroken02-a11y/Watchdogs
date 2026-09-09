/**
 * Memory contract.
 *
 * One interface, four operations. AIVM-BRAIN, Claude-Mem and an
 * Obsidian/Markdown vault each become an adapter implementing this — the HUD
 * never learns which one is behind it.
 */

export type MemorySource = 'mock' | 'aivm-brain' | 'claude-mem' | 'obsidian' | 'operator';

export interface MemoryRecord {
  id: string;
  title: string;
  snippet: string;
  /** Category slug, e.g. "decision" or "code". */
  category: string;
  /** Which store the record came from. */
  source: MemorySource | string;
  /** Epoch ms. */
  timestamp: number;
}

export interface MemoryQuery {
  /** Free text. Empty matches everything within the category. */
  text?: string;
  /** Category slug, or "all". */
  category?: string;
  limit?: number;
}

/** Written through save(). Ids and timestamps are assigned by the adapter. */
export interface MemoryDraft {
  title: string;
  snippet: string;
  category: string;
  source?: MemorySource | string;
}

/** Filter chip shown above the memory list. */
export interface MemoryCategory {
  id: string;
  label: string;
}

export interface MemoryStats {
  total: number;
  categories: number;
  /** Adapter identifier, surfaced in the UI so mock is never mistaken for real. */
  adapter: string;
}

export interface MemoryService {
  /** Filtered query. Emits memory.search on the bus. */
  search(query: MemoryQuery): Promise<MemoryRecord[]>;
  /** Single record by id, or null. */
  recall(id: string): Promise<MemoryRecord | null>;
  /**
   * Appends a record. Phase 3 writes to an in-memory array only — nothing
   * touches a database, a file or an API.
   */
  save(draft: MemoryDraft): Promise<MemoryRecord>;
  /** Most recent records, newest first. */
  recent(limit?: number): Promise<MemoryRecord[]>;
  stats(): MemoryStats;
}
