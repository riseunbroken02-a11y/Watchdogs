/**
 * ============================================================================
 *  JARVIS HUD — MOCK DATA
 * ============================================================================
 *  PHASE 3 IS STILL LOCAL-ONLY.
 *
 *  Every value in this file is invented. Nothing here reads from, writes to or
 *  authenticates against AIVM-BRAIN, OpenClaw, Claude Code, Claude-Mem,
 *  OmniRoute, MCP servers or any external API. There are no keys, tokens or
 *  secrets in this repository and none are read from the environment.
 *
 *  This is the single place to edit the demo content: seed values, service
 *  names, agents, memories, connectors, event templates and the canned command
 *  responses. Look-and-feel lives in `jarvis.config.ts` instead.
 * ============================================================================
 */

import type {
  AgentCapability,
  AgentStatus,
  ConnectorCapability,
  ConnectorStatus,
  MemoryCategory,
} from '../contracts';

/** Master switch. While true the UI labels every reading as simulated. */
export const MOCK_MODE = true;

/* ------------------------------------------------------------ 1. metrics -- */

export interface MetricSeed {
  id: string;
  label: string;
  unit: string;
  /** Value the simulation drifts around. */
  base: number;
  /** How far it may wander. */
  drift: number;
  /** Optional capacity used to build the secondary readout. */
  total?: string;
  /** True when a HIGH value is bad in reverse — reported as "free" instead. */
  invert?: boolean;
}

export const metricSeeds: MetricSeed[] = [
  { id: 'cpu', label: 'CPU', unit: '%', base: 34, drift: 16 },
  { id: 'ram', label: 'RAM', unit: '%', base: 58, drift: 10, total: '32 GB' },
  { id: 'storage', label: 'STORAGE', unit: '%', base: 71, drift: 1.5, total: '2 TB' },
  { id: 'network', label: 'NETWORK', unit: 'Mb/s', base: 42, drift: 30 },
  { id: 'headroom', label: 'HEADROOM', unit: '%', base: 38, drift: 6, invert: true },
];

/* ----------------------------------------------------------- 2. services -- */

/**
 * There is no separate "services" list any more.
 *
 * Its former members are now either metrics (Headroom) or connectors
 * (AIVM-BRAIN, OpenClaw, Claude Code, Claude-Mem, OmniRoute), so nothing is
 * described in two places.
 */

/* ------------------------------------------------------------- 3. agents -- */

export interface AgentSeed {
  id: string;
  label: string;
  role: string;
  status: AgentStatus;
  capabilities: AgentCapability[];
  currentTask: string;
  activity: number;
  lastAction: string;
  /** Seconds ago the last action happened, at boot. */
  lastActionAgo: number;
}

export const agentSeeds: AgentSeed[] = [
  {
    id: 'jarvis',
    label: 'JARVIS AGENT',
    role: 'orchestrator',
    status: 'active',
    capabilities: ['orchestrate', 'analyze'],
    currentTask: 'Awaiting operator command',
    activity: 22,
    lastAction: 'Routed request to Coding Agent',
    lastActionAgo: 48,
  },
  {
    id: 'coding',
    label: 'CODING AGENT',
    role: 'engineering',
    status: 'idle',
    capabilities: ['code', 'analyze'],
    currentTask: 'No active session',
    activity: 6,
    lastAction: 'Completed diff review',
    lastActionAgo: 320,
  },
  {
    id: 'research',
    label: 'RESEARCH AGENT',
    role: 'analysis',
    status: 'active',
    capabilities: ['research', 'analyze'],
    currentTask: 'Watching for new sources',
    activity: 31,
    lastAction: 'Summarised 4 documents',
    lastActionAgo: 150,
  },
  {
    id: 'browser',
    label: 'BROWSER AGENT',
    role: 'web',
    status: 'offline',
    capabilities: ['browse'],
    currentTask: 'Not started',
    activity: 0,
    lastAction: 'Session closed',
    lastActionAgo: 1840,
  },
  {
    id: 'automation',
    label: 'AUTOMATION AGENT',
    role: 'task runtime',
    status: 'active',
    capabilities: ['automate', 'execute' as AgentCapability],
    currentTask: 'Holding 3 idle workers',
    activity: 41,
    lastAction: 'Drained task queue',
    lastActionAgo: 92,
  },
  {
    id: 'memory',
    label: 'MEMORY AGENT',
    role: 'recall',
    status: 'active',
    capabilities: ['recall'],
    currentTask: 'Watching for new context',
    activity: 33,
    lastAction: 'Stored session summary',
    lastActionAgo: 210,
  },
];

/** Task lines the simulation rotates through per agent. */
export const agentTaskPool: Record<string, string[]> = {
  jarvis: ['Awaiting operator command', 'Planning task decomposition', 'Routing to sub-agent', 'Summarising results'],
  coding: ['No active session', 'Reading repository tree', 'Drafting patch', 'Running type check'],
  research: ['Watching for new sources', 'Ranking search results', 'Extracting key claims', 'Writing summary'],
  browser: ['Not started', 'Launching headless session', 'Fetching page', 'Extracting content'],
  automation: ['Holding 3 idle workers', 'Scheduling task batch', 'Draining task queue', 'Recycling worker pool'],
  memory: ['Watching for new context', 'Embedding recent turns', 'Pruning stale entries', 'Serving recall query'],
};

/* ------------------------------------------------------------- 4. memory -- */

export const memoryCategories: MemoryCategory[] = [
  { id: 'all', label: 'ALL' },
  { id: 'project', label: 'PROJECT' },
  { id: 'decision', label: 'DECISION' },
  { id: 'code', label: 'CODE' },
  { id: 'session', label: 'SESSION' },
  { id: 'research', label: 'RESEARCH' },
];

export interface MemorySeed {
  title: string;
  snippet: string;
  category: string;
  source: string;
  /** Minutes ago, at boot. */
  ago: number;
}

export const memorySeeds: MemorySeed[] = [
  {
    title: 'Jarvis HUD phase 1 shipped',
    snippet: 'Interface-only command center delivered under apps/jarvis-hud with eight core shapes and six states.',
    category: 'project',
    source: 'claude-code',
    ago: 6,
  },
  {
    title: 'Keep backend mocked until phase 3',
    snippet: 'Decision: no AIVM-BRAIN, OpenClaw or MCP wiring before the interface is signed off.',
    category: 'decision',
    source: 'operator',
    ago: 18,
  },
  {
    title: 'Core shape registry pattern',
    snippet: 'Shapes resolve through src/core/shapes/registry.ts so adding one needs no component changes.',
    category: 'code',
    source: 'claude-code',
    ago: 34,
  },
  {
    title: 'Telemetry adapter seam',
    snippet: 'createTelemetrySource() switches between mock and live via telemetry.source in the config.',
    category: 'code',
    source: 'aivm-brain',
    ago: 47,
  },
  {
    title: 'Height-adaptive compaction',
    snippet: 'Panels shed padding and secondary text below 1000px so the HUD stays on one screen.',
    category: 'decision',
    source: 'claude-code',
    ago: 63,
  },
  {
    title: 'OmniRoute lane budget',
    snippet: 'Six routes configured; primary lane reserved for long-context reasoning work.',
    category: 'research',
    source: 'omniroute',
    ago: 88,
  },
  {
    title: 'Session: HUD verification run',
    snippet: '47 automated checks across shapes, states, command pipeline and layout — all green.',
    category: 'session',
    source: 'claude-code',
    ago: 105,
  },
  {
    title: 'Reduced-motion contract',
    snippet: 'All animation honours prefers-reduced-motion plus an explicit config override.',
    category: 'code',
    source: 'claude-code',
    ago: 140,
  },
  {
    title: 'Watchdogs repo layout',
    snippet: 'Apps live under apps/*. Nothing outside apps/jarvis-hud is touched by the HUD work.',
    category: 'project',
    source: 'operator',
    ago: 190,
  },
  {
    title: 'Headroom warning threshold',
    snippet: 'Context budget flagged WARNING below 65% free so long sessions get compacted early.',
    category: 'research',
    source: 'headroom',
    ago: 240,
  },
];

/* --------------------------------------------------------- 5. connectors -- */

export interface ConnectorSeed {
  id: string;
  label: string;
  state: ConnectorStatus;
  detail: string;
  capabilities: ConnectorCapability[];
}

export const connectorSeeds: ConnectorSeed[] = [
  { id: 'aivm-brain', label: 'AIVM-BRAIN', state: 'mock', detail: 'knowledge graph · 1.2k nodes', capabilities: ['read', 'write', 'search'] },
  { id: 'openclaw', label: 'OPENCLAW', state: 'mock', detail: 'local runtime · 3 workers', capabilities: ['execute', 'schedule'] },
  { id: 'claude-code', label: 'CLAUDE CODE', state: 'mock', detail: 'cli bridge · session active', capabilities: ['read', 'write', 'execute'] },
  { id: 'claude-mem', label: 'CLAUDE-MEM', state: 'mock', detail: 'memory store · 418 entries', capabilities: ['read', 'write', 'search'] },
  { id: 'github', label: 'GITHUB', state: 'mock', detail: 'riseunbroken02-a11y/Watchdogs', capabilities: ['read', 'write', 'search'] },
  { id: 'notion', label: 'NOTION', state: 'not-configured', detail: 'no workspace linked', capabilities: ['read', 'write', 'search'] },
  { id: 'gmail', label: 'GMAIL', state: 'not-configured', detail: 'no account linked', capabilities: ['read', 'notify'] },
  { id: 'google-calendar', label: 'GOOGLE CAL.', state: 'disconnected', detail: 'session expired', capabilities: ['read', 'schedule'] },
  { id: 'omniroute', label: 'OMNIROUTE', state: 'mock', detail: 'model router · 6 routes', capabilities: ['execute'] },
];

/* ------------------------------------------------------------- 6. events -- */

/**
 * Ambient notices emitted while the system is idle, so the activity log has a
 * pulse. They are published as `system.info` events.
 */
export const ambientNotices: { source: string; message: string; level: 'info' | 'warning' }[] = [
  { source: 'AIVM AGENT', message: 'Indexed 8 new graph nodes', level: 'info' },
  { source: 'CLAUDE-MEM', message: 'Recall query served in 27 ms', level: 'info' },
  { source: 'OMNIROUTE', message: 'Primary lane healthy · 6 routes', level: 'info' },
  { source: 'OPENCLAW', message: 'Worker pool recycled', level: 'info' },
  { source: 'MEMORY AGENT', message: 'Session summary stored', level: 'info' },
  { source: 'CLAUDE CODE', message: 'Watching repository for changes', level: 'info' },
  { source: 'HEADROOM', message: 'Context budget at 62% — compaction advised', level: 'warning' },
  { source: 'JARVIS AGENT', message: 'Heartbeat check across 6 agents', level: 'info' },
];

/* ----------------------------------------------------------- 7. commands -- */

/**
 * Command handling now lives in `adapters/mock/mockCommandHandlers.ts`, where
 * each handler implements the `CommandHandler` contract. This section is kept
 * as a pointer so there is one obvious place to look.
 */

/* -------------------------------------------------------------- 8. voice -- */

/** Phrases the mock speech-to-text "hears" while listening. */
export const voiceTranscripts: string[] = [
  'Show system status',
  'Check memory',
  'Run diagnostics',
  'Show active agents',
  'Analyze project',
];
