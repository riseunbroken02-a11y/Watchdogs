import { memo, useMemo, useState } from 'react';
import { palette } from '../config/jarvis.config';
import { useJarvis } from '../state/jarvisContext';
import type { EventKind } from '../types';
import { Panel } from './Panel';
import './EventStream.css';

/** Glyph + tone per event kind. Keeps the stream scannable at a glance. */
const KIND: Record<EventKind, { glyph: string; tone: string }> = {
  command: { glyph: '>', tone: palette.accent },
  'agent-start': { glyph: '▸', tone: palette.accent },
  'agent-work': { glyph: '◆', tone: palette.warning },
  memory: { glyph: '◈', tone: palette.violet },
  'task-complete': { glyph: '✓', tone: palette.success },
  warning: { glyph: '!', tone: palette.warning },
  error: { glyph: '✕', tone: palette.danger },
  info: { glyph: '·', tone: palette.textDim },
};

type Filter = 'all' | 'agents' | 'memory' | 'alerts';

const MATCHES: Record<Filter, (kind: EventKind) => boolean> = {
  all: () => true,
  agents: (k) => k === 'agent-start' || k === 'agent-work' || k === 'command' || k === 'task-complete',
  memory: (k) => k === 'memory',
  alerts: (k) => k === 'warning' || k === 'error',
};

const clock = (ts: number) =>
  new Date(ts).toLocaleTimeString('en-GB', { hour12: false });

/**
 * ACTIVITY / EVENT STREAM — a live-looking feed of everything the mock system
 * does: commands received, agents starting and working, memory accessed, tasks
 * completed, warnings and errors.
 */
export const EventStreamPanel = memo(function EventStreamPanel() {
  const { events } = useJarvis();
  const [filter, setFilter] = useState<Filter>('all');

  const visible = useMemo(() => events.filter((e) => MATCHES[filter](e.kind)), [events, filter]);

  const filters = (
    <div className="jv-stream-filters" role="group" aria-label="Event filter">
      {(['all', 'agents', 'memory', 'alerts'] as Filter[]).map((f) => (
        <button
          key={f}
          type="button"
          className="jv-stream-filter"
          aria-pressed={filter === f}
          onClick={() => setFilter(f)}
        >
          {f.toUpperCase()}
        </button>
      ))}
    </div>
  );

  return (
    <Panel
      title="Activity Stream"
      actions={filters}
      aside={`${visible.length} · MOCK`}
      className="jv-panel--stream"
    >
      <div className="jv-stream">
        {visible.length === 0 ? (
          <p className="jv-empty">No events match this filter.</p>
        ) : (
          visible.map((e) => (
            <div
              key={e.id}
              className={`jv-event jv-event--${e.kind}`}
              style={{ '--jv-tone': KIND[e.kind].tone } as React.CSSProperties}
            >
              <span className="jv-event__time">{clock(e.timestamp)}</span>
              <span className="jv-event__glyph">{KIND[e.kind].glyph}</span>
              <span className="jv-event__source">{e.source}</span>
              <span className="jv-event__msg">{e.message}</span>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
});
