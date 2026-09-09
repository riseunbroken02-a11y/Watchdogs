/**
 * Agent contract.
 *
 * An agent adapter is the seam where a real runtime (OpenClaw workers, a Claude
 * Code session, a browser driver) plugs in. Phase 3 ships mock adapters only;
 * a real one implements the same interface and is registered the same way.
 */

export type AgentId =
  | 'jarvis'
  | 'coding'
  | 'research'
  | 'browser'
  | 'automation'
  | 'memory';

export type AgentStatus = 'active' | 'working' | 'idle' | 'warning' | 'offline';

/** What an agent claims it can do. Used by the router to pick a handler. */
export type AgentCapability =
  | 'orchestrate'
  | 'code'
  | 'research'
  | 'browse'
  | 'automate'
  | 'recall'
  | 'analyze';

export interface AgentDescriptor {
  id: AgentId;
  name: string;
  /** Short role line shown next to the name. */
  role: string;
  capabilities: AgentCapability[];
  /** Which adapter backs this agent, e.g. "mock" or "openclaw". */
  adapter: string;
}

/** Live view of an agent, as rendered by the agents panel. */
export interface AgentState {
  status: AgentStatus;
  currentTask: string;
  /** 0..100 */
  activity: number;
  lastAction: string;
  lastActionAt: number;
}

export interface AgentTask {
  /** Free-form instruction. Phase 3 adapters only echo it. */
  input: string;
  /** Correlates agent work with the command that triggered it. */
  commandId: string;
}

export interface AgentRunResult {
  ok: boolean;
  /** One-line outcome, surfaced in the activity log. */
  summary: string;
}

/**
 * Implement this to add a real agent.
 * `run()` must never perform destructive work without an explicit capability.
 */
export interface AgentAdapter {
  readonly descriptor: AgentDescriptor;
  /** Current state. Adapters own their own state so the UI stays dumb. */
  getState(): AgentState;
  /** Advances a simulated/real heartbeat. Optional for real adapters. */
  tick?(): void;
  /** Runs a task. Phase 3 mock adapters resolve without side effects. */
  run(task: AgentTask): Promise<AgentRunResult>;
}

/** Registry view combining the static descriptor with live state. */
export interface AgentView extends AgentDescriptor, AgentState {}

export interface AgentRegistry {
  register(adapter: AgentAdapter): void;
  get(id: AgentId): AgentAdapter | undefined;
  list(): AgentView[];
  /** Agents advertising a capability, in registration order. */
  withCapability(capability: AgentCapability): AgentAdapter[];
  /** Runs a task on one agent and emits agent.started / agent.completed. */
  run(id: AgentId, task: AgentTask): Promise<AgentRunResult>;
  tickAll(): void;
}
