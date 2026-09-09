import { memo, useMemo, useState } from 'react';
import type { JarvisEventName, JarvisEventRecord } from '../contracts';
import { clockTime } from '../utils/time';
import { useJarvis } from '../state/useJarvis';
import { Panel } from './Panel';
import { statusTone } from './statusMeta';
import './EventStream.css';

type Filter = 'all' | 'commands' | 'agents' | 'memory' | 'system';

const MATCHES: Record<Filter, (name: JarvisEventName) => boolean> = {
  all: () => true,
  commands: (n) => n.startsWith('command.'),
  agents: (n) => n.startsWith('agent.'),
  memory: (n) => n.startsWith('memory.'),
  system: (n) => n.startsWith('system.') || n.startsWith('connector.'),
};

const FILTERS: Filter[] = ['all', 'commands', 'agents', 'memory', 'system'];

/**
 * ACTIVITY LOG — renders the real records published on the kernel's event bus.
 *
 * Each row shows the five things the architecture asks for: time, event name,
 * source, status and a short description. Nothing here is synthesised for
 * display; the bus derives source/status/description when an event is emitted.
 */
export const EventStreamPanel = memo(function EventStreamPanel() {
  const { events } = useJarvis();
  const [filter, setFilter] = useState<Filter>('all');

  const visible = useMemo(() => events.filter((e) => MATCHES[filter](e.name)), [events, filter]);

  const filters = (
    <div className="jv-stream-filters" role="group" aria-label="Event filter">
      {FILTERS.map((f) => (
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

  const isOperatorInput = (e: JarvisEventRecord) => e.name === 'command.received';

  return (
    <Panel
      title="Activity Log"
      actions={filters}
      aside={`${visible.length} EVENTS · MOCK`}
      className="jv-panel--stream"
    >
      <div className="jv-stream">
        {visible.length === 0 ? (
          <p className="jv-empty">No events match this filter.</p>
        ) : (
          visible.map((e) => (
            <div
              key={e.id}
              className={`jv-event jv-event--${e.status} ${isOperatorInput(e) ? 'jv-event--input' : ''}`}
              style={{ '--jv-tone': statusTone(e.status) } as React.CSSProperties}
            >
              <span className="jv-event__time">{clockTime(e.timestamp)}</span>
              <span className="jv-event__name">{e.name}</span>
              <span className="jv-event__source">{e.source}</span>
              <span className="jv-event__status">{e.status.toUpperCase()}</span>
              <span className="jv-event__msg">{e.description}</span>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
});
