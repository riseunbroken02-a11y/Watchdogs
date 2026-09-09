/**
 * OpenClaw agent adapter.
 *
 * Implements the same `AgentAdapter` contract as the mock, over HTTP.
 *
 * Expected endpoint shape:
 *   GET  /agents            → { agents: [{ id, name, role, capabilities, status,
 *                                          currentTask, activity, lastAction }] }
 *   GET  /agents/:id        → one of the above
 *   POST /agents/:id/run    → { ok: boolean, summary: string }
 *
 * SAFETY: `run()` submits work to a real runtime, so it is an `execute` action.
 * A command handler must obtain approval before calling it — see
 * `src/kernel/approvalGate.ts`. This adapter deliberately does not gate itself:
 * one chokepoint is easier to audit than many.
 */

import type {
  AgentAdapter,
  AgentCapability,
  AgentDescriptor,
  AgentId,
  AgentRunResult,
  AgentState,
  AgentStatus,
  AgentTask,
  EventBus,
} from '../../contracts';
import type { HttpClient } from './httpClient';

interface RemoteAgent {
  id?: string;
  name?: string;
  role?: string;
  capabilities?: string[];
  status?: string;
  currentTask?: string;
  activity?: number;
  lastAction?: string;
}

const STATUSES: AgentStatus[] = ['active', 'working', 'idle', 'warning', 'offline'];
const CAPABILITIES: AgentCapability[] = [
  'orchestrate',
  'code',
  'research',
  'browse',
  'automate',
  'recall',
  'analyze',
];

const toStatus = (raw: unknown): AgentStatus =>
  STATUSES.includes(raw as AgentStatus) ? (raw as AgentStatus) : 'idle';

const toCapabilities = (raw: unknown): AgentCapability[] => {
  if (!Array.isArray(raw)) return [];
  return raw.filter((c): c is AgentCapability => CAPABILITIES.includes(c as AgentCapability));
};

class LiveAgentAdapter implements AgentAdapter {
  readonly descriptor: AgentDescriptor;
  private state: AgentState;

  constructor(
    private readonly http: HttpClient,
    private readonly bus: EventBus,
    descriptor: AgentDescriptor,
    state: AgentState,
  ) {
    this.descriptor = descriptor;
    this.state = state;
  }

  getState(): AgentState {
    return this.state;
  }

  /** Refreshes from the runtime. Failures leave the last known state intact. */
  tick(): void {
    void this.http
      .get<RemoteAgent>(`/agents/${encodeURIComponent(this.descriptor.id)}`)
      .then((result) => {
        if (!result.ok || !result.data) return;
        this.state = mergeState(this.state, result.data);
      });
  }

  async run(task: AgentTask): Promise<AgentRunResult> {
    const result = await this.http.post<{ ok?: boolean; summary?: string }>(
      `/agents/${encodeURIComponent(this.descriptor.id)}/run`,
      { input: task.input, commandId: task.commandId },
    );

    if (!result.ok) {
      this.bus.emit('system.error', {
        source: this.descriptor.name,
        message: `OpenClaw run failed: ${result.error}`,
      });
      return { ok: false, summary: `${this.descriptor.name}: ${result.error}` };
    }

    return {
      ok: result.data?.ok !== false,
      summary: result.data?.summary ?? `${this.descriptor.name} completed the task`,
    };
  }
}

function mergeState(current: AgentState, remote: RemoteAgent): AgentState {
  return {
    status: toStatus(remote.status),
    currentTask: remote.currentTask ?? current.currentTask,
    activity:
      typeof remote.activity === 'number'
        ? Math.max(0, Math.min(100, remote.activity))
        : current.activity,
    lastAction: remote.lastAction ?? current.lastAction,
    lastActionAt: remote.lastAction && remote.lastAction !== current.lastAction
      ? Date.now()
      : current.lastActionAt,
  };
}

/**
 * Fetches the roster from OpenClaw. Returns an empty array when the runtime
 * answers with nothing usable, which the resolver treats as a failed binding.
 */
export async function createLiveAgents(
  http: HttpClient,
  bus: EventBus,
): Promise<AgentAdapter[]> {
  const result = await http.get<{ agents?: RemoteAgent[] }>('/agents');
  if (!result.ok || !Array.isArray(result.data?.agents)) return [];

  const now = Date.now();
  return result.data.agents
    .filter((a): a is RemoteAgent & { id: string } => typeof a.id === 'string')
    .map(
      (a) =>
        new LiveAgentAdapter(
          http,
          bus,
          {
            id: a.id as AgentId,
            name: a.name ?? a.id,
            role: a.role ?? 'agent',
            capabilities: toCapabilities(a.capabilities),
            adapter: 'openclaw',
          },
          {
            status: toStatus(a.status),
            currentTask: a.currentTask ?? 'Idle',
            activity: typeof a.activity === 'number' ? a.activity : 0,
            lastAction: a.lastAction ?? '—',
            lastActionAt: now,
          },
        ),
    );
}
