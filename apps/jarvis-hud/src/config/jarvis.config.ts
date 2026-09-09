/**
 * ============================================================================
 *  JARVIS HUD — CONFIGURATION
 * ============================================================================
 *  This is the single place to tune the interface.
 *  Change colours, animation speeds, which core shapes are available and which
 *  subsystems are listed — no component code needs to be touched.
 * ============================================================================
 */

import type { CoreShapeId, CoreState } from '../types';

/* ---------------------------------------------------------------- identity */

export const identity = {
  name: 'JARVIS',
  subtitle: 'AIVM-BRAIN COMMAND CENTER',
  /** Shown in the header + the demo banner. */
  build: 'PHASE 1 · INTERFACE ONLY',
} as const;

/* ------------------------------------------------------------------ colours */

/** Base palette. Every value lands in CSS as a custom property (--jv-*). */
export const palette = {
  bg: '#04070d',
  bgElevated: '#080d18',
  panel: 'rgba(10, 20, 34, 0.55)',
  panelBorder: 'rgba(56, 189, 248, 0.16)',
  grid: 'rgba(56, 189, 248, 0.05)',

  accent: '#22d3ee',
  accentSoft: '#0e7490',
  accentBright: '#67e8f9',

  text: '#d7ecf5',
  textDim: '#5f7d90',
  textFaint: '#33505f',

  success: '#34d399',
  warning: '#fbbf24',
  danger: '#f87171',
  violet: '#a78bfa',
} as const;

/** Accent colour per core state — the whole HUD tints to this. */
export const stateColors: Record<CoreState, string> = {
  idle: palette.accent,
  listening: '#38bdf8',
  thinking: palette.violet,
  working: palette.warning,
  success: palette.success,
  error: palette.danger,
};

/** Human labels + one-line descriptions per state. */
export const stateMeta: Record<CoreState, { label: string; hint: string }> = {
  idle: { label: 'IDLE', hint: 'Standing by' },
  listening: { label: 'LISTENING', hint: 'Capturing input' },
  thinking: { label: 'THINKING', hint: 'Reasoning over context' },
  working: { label: 'WORKING', hint: 'Executing task chain' },
  success: { label: 'SUCCESS', hint: 'Task completed' },
  error: { label: 'ERROR', hint: 'Task failed — review log' },
};

/* --------------------------------------------------------------- animation */

export const animation = {
  /** Global multiplier: 0.5 = twice as fast, 2 = twice as slow. */
  speed: 1,
  /** Base pulse duration in seconds (scaled by `speed`). */
  pulseSeconds: 3.2,
  /** Base rotation duration in seconds for holographic rings. */
  rotationSeconds: 18,
  /** Panel/UI transition duration in ms. */
  transitionMs: 260,
  /** Set true to flatten all motion (also honours prefers-reduced-motion). */
  reducedMotion: false,
} as const;

/** Per-state animation multipliers — lower = more agitated. */
export const stateTempo: Record<CoreState, number> = {
  idle: 1,
  listening: 0.7,
  thinking: 0.45,
  working: 0.35,
  success: 0.8,
  error: 0.25,
};

/* ------------------------------------------------------------- core shapes */

export interface CoreShapeConfig {
  id: CoreShapeId;
  label: string;
  description: string;
  /** Set false to hide a shape from the selector. */
  enabled: boolean;
}

export const coreShapes: CoreShapeConfig[] = [
  { id: 'orb', label: 'ORB', description: 'Glowing volumetric sphere', enabled: true },
  { id: 'ring', label: 'RING', description: 'Counter-rotating holo rings', enabled: true },
  { id: 'hexagon', label: 'HEXAGON', description: 'Hex lattice core', enabled: true },
  { id: 'hologram', label: 'HOLOGRAM', description: 'Scanlines & particles', enabled: true },
  { id: 'reactor', label: 'REACTOR', description: 'Arc reactor assembly', enabled: true },
  { id: 'wave', label: 'WAVE', description: 'Reactive waveform', enabled: true },
  { id: 'minimal', label: 'MINIMAL', description: 'Single glowing circle', enabled: true },
  { id: 'custom', label: 'CUSTOM', description: 'Slot for your own shape', enabled: true },
];

/** Shape shown on first load. */
export const defaultShape: CoreShapeId = 'reactor';

/* --------------------------------------------------------------- telemetry */

export const telemetry = {
  /**
   * PHASE 1: always 'mock'.
   * When the real backend exists, add a 'live' source in src/services/telemetry.ts
   * and switch this value — no component changes required.
   */
  source: 'mock' as 'mock' | 'live',
  /** Poll interval for the telemetry feed, in ms. */
  pollIntervalMs: 1200,
  /** Future home of the real endpoint (unused in phase 1). */
  endpoint: 'http://127.0.0.1:8787/status',
} as const;

/** System metrics rendered in the SYSTEM STATUS panel. */
export const systemMetrics = [
  { id: 'cpu', label: 'CPU', unit: '%', base: 34, drift: 16 },
  { id: 'ram', label: 'RAM', unit: '%', base: 58, drift: 10, total: '32 GB' },
  { id: 'storage', label: 'STORAGE', unit: '%', base: 71, drift: 1.5, total: '2 TB' },
  { id: 'network', label: 'NETWORK', unit: 'Mb/s', base: 42, drift: 30 },
] as const;

/** AI subsystems rendered in the AI STATUS panel. */
export const aiModules = [
  { id: 'aivm-brain', label: 'AIVM-BRAIN', detail: 'knowledge graph · 1.2k nodes' },
  { id: 'openclaw', label: 'OPENCLAW', detail: 'agent runtime · 3 workers' },
  { id: 'claude-code', label: 'CLAUDE CODE', detail: 'cli bridge · session active' },
  { id: 'claude-mem', label: 'CLAUDE-MEM', detail: 'memory store · 418 entries' },
  { id: 'omniroute', label: 'OMNIROUTE', detail: 'model router · 6 routes' },
] as const;

/* ----------------------------------------------------------------- command */

export const command = {
  placeholder: 'Talk to JARVIS...',
  submitLabel: 'EXECUTE',
  /** Phase 1 safety switch. While false, no command ever leaves the browser. */
  executeForReal: false,
  /** Simulated durations (ms) for the demo state machine. */
  simulation: {
    listeningMs: 500,
    thinkingMs: 1400,
    workingMs: 1800,
    resolveMs: 2200,
  },
} as const;

export const config = {
  identity,
  palette,
  stateColors,
  stateMeta,
  animation,
  stateTempo,
  coreShapes,
  defaultShape,
  telemetry,
  systemMetrics,
  aiModules,
  command,
};

export default config;
