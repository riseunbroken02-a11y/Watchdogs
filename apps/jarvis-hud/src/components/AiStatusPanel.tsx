import { palette } from '../config/jarvis.config';
import type { AiModuleStatus, ModuleHealth } from '../types';
import { Panel } from './Panel';
import './StatusPanels.css';

const TONE: Record<ModuleHealth, string> = {
  online: palette.success,
  degraded: palette.warning,
  offline: palette.danger,
  standby: palette.textDim,
};

const HEALTH_LABEL: Record<ModuleHealth, string> = {
  online: 'ONLINE',
  degraded: 'DEGRADED',
  offline: 'OFFLINE',
  standby: 'STANDBY',
};

interface AiStatusPanelProps {
  modules: AiModuleStatus[];
  isMock: boolean;
}

/** AI STATUS — AIVM-BRAIN, OPENCLAW, CLAUDE CODE, CLAUDE-MEM, OMNIROUTE. */
export function AiStatusPanel({ modules, isMock }: AiStatusPanelProps) {
  const online = modules.filter((m) => m.health === 'online').length;

  return (
    <Panel
      title="AI Status"
      aside={modules.length ? `${online}/${modules.length} ${isMock ? '· SIM' : ''}` : '—'}
    >
      <div className="jv-modules">
        {modules.map((m) => (
          <div
            key={m.id}
            className="jv-module"
            style={{ '--jv-tone': TONE[m.health] } as React.CSSProperties}
          >
            <span className="jv-module__dot" />
            <span className="jv-module__text">
              <span className="jv-module__label">{m.label}</span>
              <span className="jv-module__detail">{m.detail}</span>
            </span>
            <span className="jv-module__meta">
              <span className="jv-module__health">{HEALTH_LABEL[m.health]}</span>
              <span className="jv-module__latency">
                {m.latencyMs === null ? '—' : `${m.latencyMs}ms`}
              </span>
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
