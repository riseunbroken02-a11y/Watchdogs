import { memo } from 'react';
import { useJarvis } from '../state/useJarvis';
import { useRuntime } from '../state/jarvisContext';
import { Panel } from './Panel';
import { StatusChip, StatusDot } from './StatusIndicator';
import { statusTone } from './statusMeta';
import './Panels.css';

/**
 * CONNECTORS — the connector registry, with a manual health sweep.
 *
 * `healthCheck()` runs through the contract and resolves locally: no socket is
 * opened, no OAuth flow starts and no credential is read.
 */
export const ConnectorsPanel = memo(function ConnectorsPanel() {
  const { connectors } = useJarvis();
  const runtime = useRuntime();
  return (
    <Panel
      title="Connectors"
      aside={`${connectors.filter((c) => c.status === 'mock').length}/${connectors.length} MOCK`}
      actions={
        <button
          type="button"
          className="jv-stream-filter"
          onClick={() => void runtime.connectors.checkAll()}
          title="Run every healthCheck() — resolves locally, contacts nothing"
        >
          HEALTH CHECK
        </button>
      }
    >
      <div className="jv-rows">
        {connectors.map((c) => (
          <div
            key={c.id}
            className="jv-row jv-row--connector"
            style={{ '--jv-tone': statusTone(c.status) } as React.CSSProperties}
            title={`${c.name} — ${c.detail || 'no detail'} · capabilities: ${c.capabilities.join(', ')}`}
          >
            <StatusDot status={c.status} />
            <span className="jv-row__text">
              <span className="jv-row__label">{c.name}</span>
            </span>
            <span className="jv-row__meta">
              <StatusChip status={c.status} />
              <span className="jv-row__latency">
                {c.latencyMs === null ? '—' : `${c.latencyMs}ms`}
              </span>
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
});
