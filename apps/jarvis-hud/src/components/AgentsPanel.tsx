import { memo } from 'react';
import { relativeTime } from '../services/memory';
import { useJarvis } from '../state/jarvisContext';
import { Panel } from './Panel';
import { StatusChip, StatusDot } from './StatusIndicator';
import { statusTone } from './statusMeta';
import './Panels.css';

/**
 * AGENTS — status, current task, activity level and last action per agent.
 * Rows react while a command runs (see engageAgents/releaseAgents).
 */
export const AgentsPanel = memo(function AgentsPanel() {
  const { agents } = useJarvis();
  const live = agents.filter((a) => a.status !== 'offline').length;

  return (
    <Panel title="Agents" aside={`${live}/${agents.length} · MOCK`}>
      <div className="jv-rows">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="jv-row jv-agent"
            style={{ '--jv-tone': statusTone(agent.status) } as React.CSSProperties}
            title={`${agent.label} (${agent.role}) — ${agent.currentTask}. Last: ${agent.lastAction}`}
          >
            <StatusDot status={agent.status} />
            <span className="jv-row__text">
              <span className="jv-agent__head">
                <span className="jv-row__label">{agent.label}</span>
                <span className="jv-agent__role">{agent.role}</span>
              </span>
              <span className="jv-agent__task">{agent.currentTask}</span>
              <span className="jv-agent__last">
                last: {agent.lastAction} · {relativeTime(agent.lastActionAt)}
              </span>
            </span>
            <span className="jv-row__meta">
              <StatusChip status={agent.status} />
              <span className="jv-agent__meter">
                <span
                  className="jv-agent__meter-fill"
                  style={{ width: `${Math.round(agent.activity)}%` }}
                />
              </span>
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
});
