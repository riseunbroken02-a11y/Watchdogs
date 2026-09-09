/**
 * Agent roster — SIMULATION ONLY.
 *
 * No agent process is started, inspected or contacted. The roster drifts
 * through the task lines in `mock.config.ts` so the panel looks alive.
 */

import { agentSeeds, agentTaskPool } from '../config/mock.config';
import type { AgentInfo, AgentStatus } from '../types';

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

export function createAgentRoster(): AgentInfo[] {
  const now = Date.now();
  return agentSeeds.map((seed) => ({
    id: seed.id,
    label: seed.label,
    role: seed.role,
    status: seed.status,
    currentTask: seed.currentTask,
    activity: seed.activity,
    lastAction: seed.lastAction,
    lastActionAt: now - seed.lastActionAgo * 1000,
  }));
}

/** Activity level each status settles around. */
const ACTIVITY_TARGET: Record<AgentStatus, number> = {
  active: 38,
  working: 76,
  idle: 8,
  warning: 45,
  offline: 0,
};

/**
 * Advances the roster one tick: activity eases towards its target and a single
 * non-offline agent may rotate to a new task line.
 */
export function tickAgents(agents: AgentInfo[]): AgentInfo[] {
  const rotateIndex = Math.random() < 0.35 ? Math.floor(Math.random() * agents.length) : -1;

  return agents.map((agent, index) => {
    const target = ACTIVITY_TARGET[agent.status];
    const noise = agent.status === 'offline' ? 0 : (Math.random() - 0.5) * 14;
    const activity = Math.max(0, Math.min(100, agent.activity + (target - agent.activity) * 0.25 + noise));

    if (index !== rotateIndex || agent.status === 'offline') {
      return { ...agent, activity };
    }

    const pool = agentTaskPool[agent.id] ?? [agent.currentTask];
    const nextTask = pick(pool);
    if (nextTask === agent.currentTask) return { ...agent, activity };

    return {
      ...agent,
      activity,
      currentTask: nextTask,
      lastAction: agent.currentTask,
      lastActionAt: Date.now(),
    };
  });
}

/**
 * Marks the agents a command engages, so the panel reacts when the operator
 * sends something. Purely cosmetic.
 */
export function engageAgents(agents: AgentInfo[], ids: string[], task: string): AgentInfo[] {
  return agents.map((agent) =>
    ids.includes(agent.id) && agent.status !== 'offline'
      ? { ...agent, status: 'working' as AgentStatus, currentTask: task, activity: 82 }
      : agent,
  );
}

/** Returns engaged agents to their resting status once a command finishes. */
export function releaseAgents(agents: AgentInfo[], ids: string[], lastAction: string): AgentInfo[] {
  return agents.map((agent) => {
    if (!ids.includes(agent.id) || agent.status === 'offline') return agent;
    const seed = agentSeeds.find((s) => s.id === agent.id);
    return {
      ...agent,
      status: seed?.status ?? 'active',
      currentTask: seed?.currentTask ?? agent.currentTask,
      lastAction,
      lastActionAt: Date.now(),
    };
  });
}
