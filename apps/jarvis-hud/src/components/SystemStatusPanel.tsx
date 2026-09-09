import { Panel } from './Panel';
import { StatBar } from './StatBar';
import type { SystemMetric } from '../types';

interface SystemStatusPanelProps {
  metrics: SystemMetric[];
  isMock: boolean;
}

/** SYSTEM STATUS — CPU / RAM / STORAGE / NETWORK meters. */
export function SystemStatusPanel({ metrics, isMock }: SystemStatusPanelProps) {
  return (
    <Panel title="System Status" aside={isMock ? 'SIMULATED' : 'LIVE'}>
      {metrics.length === 0 ? (
        <p className="jv-label">initialising…</p>
      ) : (
        metrics.map((m) => (
          <StatBar key={m.id} label={m.label} value={m.value} unit={m.unit} readout={m.readout} />
        ))
      )}
    </Panel>
  );
}
