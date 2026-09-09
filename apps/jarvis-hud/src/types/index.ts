/**
 * Shared types for the JARVIS HUD.
 *
 * Phase 2: everything is still fed by local mock data, but these types are
 * shaped the way a real AIVM-BRAIN / OpenClaw / MCP feed would deliver it, so
 * swapping in a live source later is a service-level change only.
 */

/* ------------------------------------------------------------------ core -- */

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

/**
 * Every core shape component receives exactly this.
 * Activity intensity is NOT passed as a prop — it lives in the `--jv-i` CSS
 * custom property so shapes can animate without re-rendering React.
 */
export interface CoreShapeProps {
  /** Current activity state of JARVIS — drives colour + animation speed. */
  state: CoreState;
  /** Extra class hook for layout. */
  className?: string;
}

/* ---------------------------------------------------------------- system -- */

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

/** Service health. MOCK means "simulated value, no real source attached". */
export type ServiceStatus = 'online' | 'offline' | 'warning' | 'mock';

/** One backend service (Claude Code, OpenClaw, AIVM-BRAIN, ...). */
export interface ServiceInfo {
  id: string;
  label: string;
  status: ServiceStatus;
  /** Short human readable detail, e.g. "12 skills · 4 docs indexed". */
  detail: string;
  /** Round-trip latency in ms, or null when not applicable. */
  latencyMs: number | null;
}

export interface TelemetrySnapshot {
  metrics: SystemMetric[];
  services: ServiceInfo[];
  /** Wall-clock of this snapshot. */
  timestamp: number;
  /** True while data is simulated. Flip to false when a real source is wired up. */
  isMock: boolean;
}

/* ---------------------------------------------------------------- agents -- */

export type AgentStatus = 'active' | 'working' | 'idle' | 'warning' | 'offline';

export interface AgentInfo {
  id: string;
  label: string;
  /** Role line, e.g. "orchestrator". */
  role: string;
  status: AgentStatus;
  /** What the agent is doing right now. */
  currentTask: string;
  /** 0..100 activity level, rendered as a mini meter. */
  activity: number;
  /** The last thing it finished. */
  lastAction: string;
  /** Epoch ms of that last action. */
  lastActionAt: number;
}

/* ---------------------------------------------------------------- memory -- */

export interface MemoryEntry {
  id: string;
  title: string;
  snippet: string;
  /** Category id, matches MemoryCategory.id. */
  category: string;
  /** Where it came from, e.g. "claude-code" or "aivm-brain". */
  source: string;
  /** Epoch ms. */
  timestamp: number;
}

export interface MemoryCategory {
  id: string;
  label: string;
}

/* ------------------------------------------------------------ connectors -- */

export type ConnectorState = 'connected' | 'disconnected' | 'mock' | 'not-configured';

export interface ConnectorInfo {
  id: string;
  label: string;
  state: ConnectorState;
  detail: string;
}

/* ---------------------------------------------------------------- events -- */

export type EventKind =
  | 'command'
  | 'agent-start'
  | 'agent-work'
  | 'memory'
  | 'task-complete'
  | 'warning'
  | 'error'
  | 'info';

export interface SystemEvent {
  id: string;
  kind: EventKind;
  /** Emitting subsystem, e.g. "OPENCLAW". */
  source: string;
  message: string;
  /** Epoch ms. */
  timestamp: number;
}

/* --------------------------------------------------------------- command -- */

export interface CommandResult {
  /** JARVIS's spoken/written answer. */
  reply: string;
  /** False routes the core to the ERROR state. */
  ok: boolean;
  /** Optional structured lines rendered under the reply. */
  detail?: string[];
}

export interface CommandHistoryEntry {
  id: string;
  input: string;
  result: CommandResult | null;
  timestamp: number;
}

/* ----------------------------------------------------------------- voice -- */

/** `off` = mic not engaged, `muted` = engaged but input suppressed. */
export type VoiceState = 'off' | 'listening' | 'muted';

export interface VoiceSnapshot {
  state: VoiceState;
  /** 16 bars, 0..1, driving the visualiser. */
  levels: number[];
  /** Mock transcript that builds up while "listening". */
  transcript: string;
  /** True while the push-to-talk key is held. */
  pushToTalk: boolean;
}
