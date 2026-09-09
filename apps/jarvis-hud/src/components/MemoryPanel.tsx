import { memo, useMemo, useState } from 'react';
import { memoryCategories } from '../config/mock.config';
import { relativeTime, searchMemories } from '../services/memory';
import { useJarvis } from '../state/jarvisContext';
import { Panel } from './Panel';
import './Panels.css';

/**
 * MEMORY — recent memories with free-text search and category filters.
 * Backed by the local mock store; no Claude-Mem database is opened.
 */
export const MemoryPanel = memo(function MemoryPanel() {
  const { memories } = useJarvis();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');

  const results = useMemo(
    () => searchMemories(memories, query, category),
    [memories, query, category],
  );

  const toolbar = (
    <>
      <div className="jv-mem-search">
        <svg
          className="jv-mem-search__icon"
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden
        >
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5L14 14" strokeLinecap="round" />
        </svg>
        <input
          className="jv-mem-search__input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search memory..."
          aria-label="Search memory"
          spellCheck={false}
        />
        {query ? (
          <button
            type="button"
            className="jv-mem-search__clear"
            onClick={() => setQuery('')}
            aria-label="Clear search"
          >
            ×
          </button>
        ) : null}
      </div>
      <div className="jv-mem-cats" role="group" aria-label="Memory categories">
        {memoryCategories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className="jv-mem-cat"
            aria-pressed={category === cat.id}
            onClick={() => setCategory(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>
    </>
  );

  return (
    <Panel
      title="Memory"
      aside={`${results.length}/${memories.length} · MOCK`}
      toolbar={toolbar}
      className="jv-panel--memory"
    >
      {results.length === 0 ? (
        <p className="jv-empty">No memories match this filter.</p>
      ) : (
        results.map((entry) => (
          <article key={entry.id} className="jv-mem">
            <h3 className="jv-mem__title">{entry.title}</h3>
            <p className="jv-mem__snippet">{entry.snippet}</p>
            <div className="jv-mem__foot">
              <span className="jv-mem__cat">{entry.category.toUpperCase()}</span>
              <span className="jv-mem__sep">/</span>
              <span>{entry.source}</span>
              <span className="jv-mem__sep">/</span>
              <span>{relativeTime(entry.timestamp)}</span>
            </div>
          </article>
        ))
      )}
    </Panel>
  );
});
