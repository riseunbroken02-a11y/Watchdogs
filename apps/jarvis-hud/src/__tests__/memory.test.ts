import { describe, expect, it } from 'vitest';
import { createMemoryStore, relativeTime, searchMemories } from '../services/memory';

const store = createMemoryStore();

describe('memory search', () => {
  it('returns everything for an empty query in the "all" category', () => {
    expect(searchMemories(store, '', 'all')).toHaveLength(store.length);
  });

  it('filters by category', () => {
    const decisions = searchMemories(store, '', 'decision');
    expect(decisions.length).toBeGreaterThan(0);
    expect(decisions.every((m) => m.category === 'decision')).toBe(true);
  });

  it('matches title, snippet and source case-insensitively', () => {
    expect(searchMemories(store, 'PHASE 1', 'all').length).toBeGreaterThan(0);
    expect(searchMemories(store, 'registry', 'all').length).toBeGreaterThan(0);
    expect(searchMemories(store, 'operator', 'all').length).toBeGreaterThan(0);
  });

  it('combines query and category', () => {
    const hits = searchMemories(store, 'hud', 'project');
    expect(hits.every((m) => m.category === 'project')).toBe(true);
  });

  it('returns nothing for a query that matches no entry', () => {
    expect(searchMemories(store, 'zzzzz-no-such-thing', 'all')).toHaveLength(0);
  });
});

describe('relativeTime', () => {
  const now = 1_700_000_000_000;
  it('formats seconds, minutes, hours and days', () => {
    expect(relativeTime(now - 5_000, now)).toBe('5s ago');
    expect(relativeTime(now - 120_000, now)).toBe('2m ago');
    expect(relativeTime(now - 7_200_000, now)).toBe('2h ago');
    expect(relativeTime(now - 172_800_000, now)).toBe('2d ago');
  });

  it('never reports a negative age', () => {
    expect(relativeTime(now + 10_000, now)).toBe('0s ago');
  });
});
