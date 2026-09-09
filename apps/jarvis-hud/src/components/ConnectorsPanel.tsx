import { memo } from 'react';
import { useJarvis } from '../state/jarvisContext';
import { Panel } from './Panel';
import { StatusChip, StatusDot } from './StatusIndicator';
import { statusTone } from './statusMeta';
import './Panels.css';

/**
 * CONNECTORS — what each integration *would* be. Nothing is authenticated,
 * opened or called: this panel is a read-only mock inventory.
 */
export const ConnectorsPanel = memo(function ConnectorsPanel() {
  const { connectors } = useJarvis();
  const mockCount = connectors.filter((c) => c.state === 'mock').length;

  return (
    <Panel title="Connectors" aside={`${mockCount}/${connectors.length} MOCK`}>
      <div className="jv-rows">
        {connectors.map((c) => (
          <div
            key={c.id}
            className="jv-row jv-row--connector"
            title={`${c.label} — ${c.detail}`}
            style={{ '--jv-tone': statusTone(c.state) } as React.CSSProperties}
          >
            <StatusDot status={c.state} />
            <span className="jv-row__text">
              <span className="jv-row__label">{c.label}</span>
            </span>
            <StatusChip status={c.state} />
          </div>
        ))}
      </div>
    </Panel>
  );
});
