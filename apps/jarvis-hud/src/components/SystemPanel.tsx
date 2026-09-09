import { memo } from 'react';
import { palette } from '../config/jarvis.config';
import { useJarvis } from '../state/useJarvis';
import { Panel } from './Panel';
import { MetricCard, SubsystemCard } from './StatusCards';
import './StatusCards.css';

/** Headroom is reported as "free", so a high number is good. */
const INVERTED = new Set(['headroom']);

/**
 * SYSTEM STATUS — status cards for CPU, RAM, Storage, Network and Headroom
 * (from the telemetry provider) plus Agents, Memory and Connectors (from their
 * registries). Every value arrives through a contract, so a real provider
 * swaps in without this component changing.
 */
export const SystemPanel = memo(function SystemPanel() {
  const { telemetry, agents, connectors, memory } = useJarvis();

  const agentsLive = agents.filter((a) => a.status !== 'offline').length;
  const connectorsUp = connectors.filter(
    (c) => c.status === 'mock' || c.status === 'connected',
  ).length;

  return (
    <Panel title="System Status" aside={telemetry.isMock ? 'SIMULATED' : 'LIVE'}>
      <div className="jv-cards">
        {telemetry.metrics.map((m) => (
          <MetricCard
            key={m.id}
            label={m.label}
            value={m.value}
            unit={m.unit}
            readout={m.readout}
            invert={INVERTED.has(m.id)}
          />
        ))}

        <SubsystemCard
          label="AGENTS"
          value={`${agentsLive}/${agents.length}`}
          sub={`${agents.filter((a) => a.status === 'working').length} working`}
          tone={agentsLive === agents.length ? palette.success : palette.warning}
          ratio={agents.length ? (agentsLive / agents.length) * 100 : 0}
        />

        <SubsystemCard
          label="MEMORY"
          value={String(memory.stats.total)}
          sub={`${memory.stats.categories} categories · ${memory.stats.adapter}`}
          tone={palette.violet}
        />

        <SubsystemCard
          label="CONNECTORS"
          value={`${connectorsUp}/${connectors.length}`}
          sub={`${connectors.filter((c) => c.status === 'mock').length} mock`}
          tone={connectorsUp === connectors.length ? palette.success : palette.warning}
          ratio={connectors.length ? (connectorsUp / connectors.length) * 100 : 0}
        />
      </div>
    </Panel>
  );
});
