import { memo } from 'react';
import { useJarvis } from '../state/jarvisContext';
import { Panel } from './Panel';
import { StatBar } from './StatBar';
import { StatusChip, StatusDot } from './StatusIndicator';
import { statusTone } from './statusMeta';
import './Panels.css';

/**
 * SYSTEM STATUS — the four machine metrics plus the six backend services,
 * exactly as phase 2 specifies them, in one panel.
 */
export const SystemStatusPanel = memo(function SystemStatusPanel() {
  const { telemetry } = useJarvis();
  const { metrics, services, isMock } = telemetry;

  return (
    <Panel title="System Status" aside={isMock ? 'SIMULATED' : 'LIVE'}>
      {metrics.length === 0 ? (
        <p className="jv-empty">initialising…</p>
      ) : (
        <>
          <div className="jv-section">
            <span className="jv-section__label">MACHINE</span>
          </div>
          <div className="jv-stats-grid">
            {metrics.map((m) => (
              <StatBar key={m.id} label={m.label} value={m.value} unit={m.unit} readout={m.readout} />
            ))}
          </div>

          <div className="jv-section">
            <span className="jv-section__label">SERVICES</span>
          </div>
          <div className="jv-rows">
            {services.map((s) => (
              <div
                key={s.id}
                className="jv-row jv-row--service"
                title={`${s.label} — ${s.detail}`}
                style={{ '--jv-tone': statusTone(s.status) } as React.CSSProperties}
              >
                <StatusDot status={s.status} />
                <span className="jv-row__text">
                  <span className="jv-row__label">{s.label}</span>
                </span>
                <span className="jv-row__meta">
                  <StatusChip status={s.status} />
                  <span className="jv-row__latency">
                    {s.latencyMs === null ? '—' : `${s.latencyMs}ms`}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
});
