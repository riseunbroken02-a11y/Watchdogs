/**
 * ============================================================================
 *  JARVIS HUD — MOCK DATA
 * ============================================================================
 *  PHASE 2 IS STILL LOCAL-ONLY.
 *
 *  Every value in this file is invented. Nothing here reads from, writes to or
 *  authenticates against AIVM-BRAIN, OpenClaw, Claude Code, Claude-Mem,
 *  OmniRoute, MCP servers or any external API.
 *
 *  This is the single place to edit the demo content: seed values, service
 *  names, agents, memories, connectors, event templates and the canned command
 *  responses. Look-and-feel lives in `jarvis.config.ts` instead.
 * ============================================================================
 */

import type {
  AgentStatus,
  ConnectorState,
  MemoryCategory,
  ServiceStatus,
} from '../types';

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
}

export const metricSeeds: MetricSeed[] = [
  { id: 'cpu', label: 'CPU', unit: '%', base: 34, drift: 16 },
  { id: 'ram', label: 'RAM', unit: '%', base: 58, drift: 10, total: '32 GB' },
  { id: 'storage', label: 'STORAGE', unit: '%', base: 71, drift: 1.5, total: '2 TB' },
  { id: 'network', label: 'NETWORK', unit: 'Mb/s', base: 42, drift: 30 },
];

/* ----------------------------------------------------------- 2. services -- */

export interface ServiceSeed {
  id: string;
  label: string;
  detail: string;
  /** Status the mock feed reports for this service. */
  status: ServiceStatus;
  /** Base latency in ms; null renders as a dash. */
  latency: number | null;
}

export const serviceSeeds: ServiceSeed[] = [
  { id: 'claude-code', label: 'CLAUDE CODE', detail: 'cli bridge · session active', status: 'mock', latency: 34 },
  { id: 'openclaw', label: 'OPENCLAW', detail: 'agent runtime · 3 workers', status: 'mock', latency: 52 },
  { id: 'aivm-brain', label: 'AIVM-BRAIN', detail: 'knowledge graph · 1.2k nodes', status: 'mock', latency: 41 },
  { id: 'claude-mem', label: 'CLAUDE-MEM', detail: 'memory store · 418 entries', status: 'mock', latency: 27 },
  { id: 'headroom', label: 'HEADROOM', detail: 'context budget · 62% free', status: 'warning', latency: null },
  { id: 'omniroute', label: 'OMNIROUTE', detail: 'model router · 6 routes', status: 'mock', latency: 63 },
];

/* ------------------------------------------------------------- 3. agents -- */

export interface AgentSeed {
  id: string;
  label: string;
  role: string;
  status: AgentStatus;
  currentTask: string;
  activity: number;
  lastAction: string;
  /** Seconds ago the last action happened, at boot. */
  lastActionAgo: number;
}

export const agentSeeds: AgentSeed[] = [
  {
    id: 'main',
    label: 'MAIN AGENT',
    role: 'orchestrator',
    status: 'active',
    currentTask: 'Awaiting operator command',
    activity: 22,
    lastAction: 'Routed request to AIVM Agent',
    lastActionAgo: 48,
  },
  {
    id: 'aivm',
    label: 'AIVM AGENT',
    role: 'knowledge',
    status: 'working',
    currentTask: 'Indexing knowledge graph delta',
    activity: 74,
    lastAction: 'Wrote 12 nodes to graph',
    lastActionAgo: 15,
  },
  {
    id: 'claude-code',
    label: 'CLAUDE CODE',
    role: 'engineering',
    status: 'idle',
    currentTask: 'No active session',
    activity: 6,
    lastAction: 'Completed diff review',
    lastActionAgo: 320,
  },
  {
    id: 'openclaw',
    label: 'OPENCLAW',
    role: 'task runtime',
    status: 'active',
    currentTask: 'Holding 3 idle workers',
    activity: 41,
    lastAction: 'Drained task queue',
    lastActionAgo: 92,
  },
  {
    id: 'browser',
    label: 'BROWSER AGENT',
    role: 'web',
    status: 'offline',
    currentTask: 'Not started',
    activity: 0,
    lastAction: 'Session closed',
    lastActionAgo: 1840,
  },
  {
    id: 'memory',
    label: 'MEMORY AGENT',
    role: 'recall',
    status: 'active',
    currentTask: 'Watching for new context',
    activity: 33,
    lastAction: 'Stored session summary',
    lastActionAgo: 210,
  },
];

/** Task lines the simulation rotates through per agent. */
export const agentTaskPool: Record<string, string[]> = {
  main: ['Awaiting operator command', 'Planning task decomposition', 'Routing to sub-agent', 'Summarising results'],
  aivm: ['Indexing knowledge graph delta', 'Resolving entity links', 'Compacting node store', 'Answering graph query'],
  'claude-code': ['No active session', 'Reading repository tree', 'Drafting patch', 'Running type check'],
  openclaw: ['Holding 3 idle workers', 'Scheduling task batch', 'Draining task queue', 'Recycling worker pool'],
  browser: ['Not started', 'Launching headless session', 'Fetching page', 'Extracting content'],
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
  state: ConnectorState;
  detail: string;
}

export const connectorSeeds: ConnectorSeed[] = [
  { id: 'github', label: 'GITHUB', state: 'mock', detail: 'riseunbroken02-a11y/Watchdogs' },
  { id: 'notion', label: 'NOTION', state: 'mock', detail: 'workspace · 3 databases' },
  { id: 'obsidian', label: 'OBSIDIAN', state: 'not-configured', detail: 'no vault path set' },
  { id: 'browser', label: 'BROWSER', state: 'disconnected', detail: 'headless session closed' },
  { id: 'openclaw', label: 'OPENCLAW', state: 'mock', detail: 'local runtime · 3 workers' },
  { id: 'aivm-brain', label: 'AIVM-BRAIN', state: 'mock', detail: 'knowledge graph · read/write' },
  { id: 'claude-mem', label: 'CLAUDE-MEM', state: 'mock', detail: 'memory store · 418 entries' },
  { id: 'omniroute', label: 'OMNIROUTE', state: 'mock', detail: 'model router · 6 routes' },
];

/* ------------------------------------------------------------- 6. events -- */

/** Ambient events the stream emits on its own so the HUD feels alive. */
export const ambientEvents: { kind: string; source: string; message: string }[] = [
  { kind: 'agent-work', source: 'AIVM AGENT', message: 'Indexed 8 new graph nodes' },
  { kind: 'memory', source: 'CLAUDE-MEM', message: 'Recall query served in 27 ms' },
  { kind: 'info', source: 'OMNIROUTE', message: 'Primary lane healthy · 6 routes' },
  { kind: 'agent-work', source: 'OPENCLAW', message: 'Worker pool recycled' },
  { kind: 'task-complete', source: 'MEMORY AGENT', message: 'Session summary stored' },
  { kind: 'info', source: 'CLAUDE CODE', message: 'Watching repository for changes' },
  { kind: 'warning', source: 'HEADROOM', message: 'Context budget at 62% — compaction advised' },
  { kind: 'memory', source: 'AIVM-BRAIN', message: 'Entity links resolved for 3 topics' },
  { kind: 'agent-start', source: 'MAIN AGENT', message: 'Heartbeat check across 6 agents' },
  { kind: 'info', source: 'SYSTEM', message: 'Telemetry snapshot committed' },
];

/** Seconds between ambient events. */
export const ambientEventIntervalMs = 4200;

/* ----------------------------------------------------------- 7. commands -- */

export interface CommandSeed {
  /** Exact suggestion text shown as a chip. */
  command: string;
  /** Regex used to recognise free-form input. */
  match: RegExp;
  reply: string;
  detail?: string[];
  /** True routes the core to ERROR instead of SUCCESS. */
  fails?: boolean;
}

export const commandSeeds: CommandSeed[] = [
  {
    command: 'Show system status',
    match: /system status|status report|health/i,
    reply: 'All subsystems reporting. Headroom is the only warning.',
    detail: [
      'CPU 34% · RAM 58% · STORAGE 71% · NETWORK 42 Mb/s',
      'CLAUDE CODE · OPENCLAW · AIVM-BRAIN · CLAUDE-MEM · OMNIROUTE — mock',
      'HEADROOM — warning · context budget 62% free',
    ],
  },
  {
    command: 'Analyze project',
    match: /analy[sz]e project|scan repo|project analysis/i,
    reply: 'Repository analysed: 1 app, 52 source files, no blocking issues.',
    detail: [
      'apps/jarvis-hud — React 19 + Vite, 8 core shapes, 6 states',
      'Type check clean · production build 1.3 s',
      'Nothing outside apps/jarvis-hud is touched',
    ],
  },
  {
    command: 'Open browser',
    match: /open browser|launch browser|browse/i,
    reply: 'Browser Agent is offline and no session can be opened in mock mode.',
    detail: ['BROWSER connector: disconnected', 'Phase 2 performs no real actions'],
    fails: true,
  },
  {
    command: 'Check memory',
    match: /check memory|memory status|recall/i,
    reply: 'CLAUDE-MEM holds 418 entries across 27 topic documents.',
    detail: [
      'Most recent: "Jarvis HUD phase 1 shipped" · 6 min ago',
      'Categories: project, decision, code, session, research',
    ],
  },
  {
    command: 'Run diagnostics',
    match: /diagnostics|self test|selftest/i,
    reply: 'Diagnostics complete. 6 services probed, 1 warning raised.',
    detail: [
      'Latency: 27–63 ms across mock services',
      'HEADROOM at 62% free — compaction advised',
      'No errors detected',
    ],
  },
  {
    command: 'Show active agents',
    match: /active agents|list agents|show agents/i,
    reply: '4 of 6 agents active. Browser Agent offline, Claude Code idle.',
    detail: [
      'MAIN · AIVM · OPENCLAW · MEMORY — active',
      'CLAUDE CODE — idle · no active session',
      'BROWSER — offline · session closed',
    ],
  },
];

/** Shown when nothing matches. */
export const commandFallback = (input: string): { reply: string; detail: string[] } => ({
  reply: `Acknowledged: "${input}".`,
  detail: [
    'No mock handler matches this command.',
    'Phase 2 is interface-only — nothing was executed.',
  ],
});

/* -------------------------------------------------------------- 8. voice -- */

/** Phrases the mock speech-to-text "hears" while listening. */
export const voiceTranscripts: string[] = [
  'Show system status',
  'Check memory',
  'Run diagnostics',
  'Show active agents',
  'Analyze project',
];
