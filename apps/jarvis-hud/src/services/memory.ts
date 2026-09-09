/**
 * Memory store — SIMULATION ONLY.
 *
 * A local in-memory list built from `mock.config.ts`. No Claude-Mem database,
 * file or API is opened.
 */

import { memorySeeds } from '../config/mock.config';
import type { MemoryEntry } from '../types';

export function createMemoryStore(): MemoryEntry[] {
  const now = Date.now();
  return memorySeeds.map((seed, i) => ({
    id: `mem-${i + 1}`,
    title: seed.title,
    snippet: seed.snippet,
    category: seed.category,
    source: seed.source,
    timestamp: now - seed.ago * 60_000,
  }));
}

/**
 * Filters by category and free-text query.
 * `category` of "all" (or empty) skips the category filter.
 */
export function searchMemories(
  entries: MemoryEntry[],
  query: string,
  category: string,
): MemoryEntry[] {
  const q = query.trim().toLowerCase();
  return entries.filter((entry) => {
    if (category && category !== 'all' && entry.category !== category) return false;
    if (!q) return true;
    return (
      entry.title.toLowerCase().includes(q) ||
      entry.snippet.toLowerCase().includes(q) ||
      entry.source.toLowerCase().includes(q) ||
      entry.category.toLowerCase().includes(q)
    );
  });
}

/** "6 min ago" style stamp used across the memory and agent panels. */
export function relativeTime(timestamp: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
