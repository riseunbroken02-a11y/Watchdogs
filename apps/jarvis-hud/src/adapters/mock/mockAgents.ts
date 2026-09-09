/**
 * Mock agent adapters.
 *
 * Each of the six agents implements the same `AgentAdapter` interface a real
 * one would. `run()` resolves locally after a short delay: no process is
 * started, no shell is invoked, no request leaves the browser.
 *
 * PHASE 4: replace one of these with an adapter that talks to OpenClaw / a
 * Claude Code session / a browser driver. The registry, the router and every
 * panel stay exactly as they are.
 */

import type {
  AgentAdapter,
  AgentDescriptor,
  AgentId,
  AgentRunResult,
  AgentState,
  AgentStatus,
  AgentTask,
} from '../../contracts';
import { agentSeeds, agentTaskPool } from '../../config/mock.config';

/** Activity level each status settles around. */
const ACTIVITY_TARGET: Record<AgentStatus, number> = {
  active: 38,
  working: 76,
  idle: 8,
  warning: 45,
  offline: 0,
};

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

class MockAgentAdapter implements AgentAdapter {
  readonly descriptor: AgentDescriptor;
  private state: AgentState;
  private readonly restingStatus: AgentStatus;
  private readonly restingTask: string;

  constructor(descriptor: AgentDescriptor, state: AgentState) {
    this.descriptor = descriptor;
    this.state = state;
    this.restingStatus = state.status;
    this.restingTask = state.currentTask;
  }

  getState(): AgentState {
    return this.state;
  }

  /** Eases activity toward its target and occasionally rotates the task line. */
  tick(): void {
    const target = ACTIVITY_TARGET[this.state.status];
    const noise = this.state.status === 'offline' ? 0 : (Math.random() - 0.5) * 14;
    const activity = Math.max(
      0,
      Math.min(100, this.state.activity + (target - this.state.activity) * 0.25 + noise),
    );

    if (this.state.status === 'offline' || Math.random() > 0.2) {
      this.state = { ...this.state, activity };
      return;
    }

    const pool = agentTaskPool[this.descriptor.id] ?? [this.state.currentTask];
    const nextTask = pick(pool);
    this.state =
      nextTask === this.state.currentTask
        ? { ...this.state, activity }
        : {
            ...this.state,
            activity,
            currentTask: nextTask,
            lastAction: this.state.currentTask,
            lastActionAt: Date.now(),
          };
  }

  async run(task: AgentTask): Promise<AgentRunResult> {
    if (this.state.status === 'offline') {
      // An offline agent refuses rather than pretending to work.
      return { ok: false, summary: `${this.descriptor.name} is offline` };
    }

    this.state = {
      ...this.state,
      status: 'working',
      currentTask: `Processing: ${task.input}`,
      activity: 82,
    };

    // Simulated latency only — nothing is executed.
    await new Promise((r) => setTimeout(r, 120 + Math.random() * 180));

    this.state = {
      ...this.state,
      status: this.restingStatus,
      currentTask: this.restingTask,
      lastAction: `Handled: ${task.input}`,
      lastActionAt: Date.now(),
    };

    return { ok: true, summary: `${this.descriptor.name} handled "${task.input}" (mock)` };
  }
}

export function createMockAgents(): AgentAdapter[] {
  const now = Date.now();
  return agentSeeds.map((seed) =>
    new MockAgentAdapter(
      {
        id: seed.id as AgentId,
        name: seed.label,
        role: seed.role,
        capabilities: seed.capabilities,
        adapter: 'mock',
      },
      {
        status: seed.status,
        currentTask: seed.currentTask,
        activity: seed.activity,
        lastAction: seed.lastAction,
        lastActionAt: now - seed.lastActionAgo * 1000,
      },
    ),
  );
}
