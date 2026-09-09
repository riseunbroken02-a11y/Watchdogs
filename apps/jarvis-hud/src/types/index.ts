/**
 * Shared types for the JARVIS HUD.
 * Phase 1: everything is fed by mock data, but these types are already shaped
 * the way a real AIVM-BRAIN / OpenClaw / MCP status feed would deliver it.
 */

export type CoreShapeId =
  | 'orb'
  | 'ring'
  | 'hexagon'
  | 'hologram'
  | 'reactor'
  | 'wave'
  | 'minimal'
  | 'custom';

export type CoreState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'working'
  | 'success'
  | 'error';

/** Every core shape component receives exactly this. */
export interface CoreShapeProps {
  /** Current activity state of JARVIS — drives colour + animation speed. */
  state: CoreState;
  /** 0..1 activity level, e.g. derived from system load or command progress. */
  intensity: number;
  /** Extra class hook for layout. */
  className?: string;
}

export type ModuleHealth = 'online' | 'degraded' | 'offline' | 'standby';

/** One AI subsystem (AIVM-BRAIN, OpenClaw, ...). */
export interface AiModuleStatus {
  id: string;
  label: string;
  health: ModuleHealth;
  /** Short human readable detail, e.g. "12 skills · 4 docs indexed". */
  detail: string;
  /** Round-trip latency in ms, or null when not applicable. */
  latencyMs: number | null;
}

/** One system metric (CPU, RAM, STORAGE, NETWORK). */
export interface SystemMetric {
  id: string;
  label: string;
  /** 0..100 */
  value: number;
  unit: string;
  /** Secondary readout, e.g. "14.2 / 32 GB". */
  readout: string;
}

export interface TelemetrySnapshot {
  system: SystemMetric[];
  modules: AiModuleStatus[];
  /** Wall-clock of this snapshot. */
  timestamp: number;
  /** True while data is simulated. Flip to false when a real source is wired up. */
  isMock: boolean;
}

export interface LogEntry {
  id: string;
  time: string;
  level: 'info' | 'warn' | 'error' | 'success';
  source: string;
  message: string;
}
