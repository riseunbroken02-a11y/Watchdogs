/**
 * Telemetry source.
 *
 * PHASE 1 — everything below is simulated in the browser. Nothing is fetched,
 * nothing is executed, no AIVM-BRAIN / OpenClaw process is touched.
 *
 * WIRING UP REAL DATA LATER:
 *   1. Implement `createLiveSource()` (fetch / WebSocket / MCP bridge) so it
 *      returns the same `TelemetrySource` shape.
 *   2. Set `telemetry.source = 'live'` in src/config/jarvis.config.ts.
 *   No component or hook needs to change.
 */

import {
  aiModules,
  systemMetrics,
  telemetry as telemetryConfig,
} from '../config/jarvis.config';
import type {
  AiModuleStatus,
  ModuleHealth,
  SystemMetric,
  TelemetrySnapshot,
} from '../types';

export interface TelemetrySource {
  readonly isMock: boolean;
  /** Subscribe to snapshots. Returns an unsubscribe function. */
  subscribe(listener: (snapshot: TelemetrySnapshot) => void): () => void;
}

/* ------------------------------------------------------------------ mock -- */

const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));

/** Smooth pseudo-random drift so the bars breathe instead of jitter. */
function drift(current: number, base: number, amount: number): number {
  const pullToBase = (base - current) * 0.06;
  const noise = (Math.random() - 0.5) * amount * 0.35;
  return clamp(current + pullToBase + noise, 1, 99);
}

function healthFor(index: number, tick: number): ModuleHealth {
  // Deterministic-ish demo choreography: everything online, with the router
  // occasionally dipping to "degraded" so the UI states are visible.
  if (index === 4 && tick % 23 > 19) return 'degraded';
  if (index === 3 && tick % 37 > 34) return 'standby';
  return 'online';
}

function createMockSource(): TelemetrySource {
  const values = new Map<string, number>(
    systemMetrics.map((m) => [m.id, m.base]),
  );
  let tick = 0;

  const buildSystem = (): SystemMetric[] =>
    systemMetrics.map((m) => {
      const next = drift(values.get(m.id) ?? m.base, m.base, m.drift);
      values.set(m.id, next);
      const total = 'total' in m ? (m.total as string) : undefined;
      const readout =
        m.unit === '%'
          ? total
            ? `${((next / 100) * parseFloat(total)).toFixed(1)} / ${total}`
            : `${next.toFixed(1)}%`
          : `${next.toFixed(1)} ↓ · ${(next * 0.28).toFixed(1)} ↑ ${m.unit}`;
      return {
        id: m.id,
        label: m.label,
        value: m.unit === '%' ? next : clamp(next, 0, 100),
        unit: m.unit,
        readout,
      };
    });

  const buildModules = (): AiModuleStatus[] =>
    aiModules.map((mod, i) => ({
      id: mod.id,
      label: mod.label,
      health: healthFor(i, tick),
      detail: mod.detail,
      latencyMs: Math.round(12 + Math.random() * 60 + i * 7),
    }));

  return {
    isMock: true,
    subscribe(listener) {
      const emit = () => {
        tick += 1;
        listener({
          system: buildSystem(),
          modules: buildModules(),
          timestamp: Date.now(),
          isMock: true,
        });
      };
      emit();
      const id = window.setInterval(emit, telemetryConfig.pollIntervalMs);
      return () => window.clearInterval(id);
    },
  };
}

/* ------------------------------------------------------------------ live -- */

/**
 * Placeholder for the real feed. Intentionally not implemented in phase 1 —
 * it must never silently start talking to a backend.
 */
function createLiveSource(): TelemetrySource {
  console.warn(
    '[jarvis] telemetry.source="live" is not implemented in phase 1 — falling back to mock data.',
  );
  return createMockSource();
}

export function createTelemetrySource(): TelemetrySource {
  return telemetryConfig.source === 'live' ? createLiveSource() : createMockSource();
}
