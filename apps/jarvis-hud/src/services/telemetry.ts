/**
 * Telemetry source — system metrics + service health.
 *
 * PHASE 2 — still simulated in the browser. Nothing is fetched, no process is
 * probed, no AIVM-BRAIN / OpenClaw / MCP endpoint is contacted.
 *
 * WIRING UP REAL DATA LATER:
 *   1. Implement `createLiveSource()` (fetch / WebSocket / MCP bridge) so it
 *      returns the same `TelemetrySource` shape.
 *   2. Set `telemetry.source = 'live'` in src/config/jarvis.config.ts.
 *   No component or hook needs to change.
 */

import { telemetry as telemetryConfig } from '../config/jarvis.config';
import { MOCK_MODE, metricSeeds, serviceSeeds } from '../config/mock.config';
import type { ServiceInfo, SystemMetric, TelemetrySnapshot } from '../types';

export interface TelemetrySource {
  readonly isMock: boolean;
  /** Subscribe to snapshots. Returns an unsubscribe function. */
  subscribe(listener: (snapshot: TelemetrySnapshot) => void): () => void;
}

const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));

/** Smooth pseudo-random drift so the bars breathe instead of jitter. */
function drift(current: number, base: number, amount: number): number {
  const pullToBase = (base - current) * 0.06;
  const noise = (Math.random() - 0.5) * amount * 0.35;
  return clamp(current + pullToBase + noise, 1, 99);
}

function createMockSource(): TelemetrySource {
  const values = new Map<string, number>(metricSeeds.map((m) => [m.id, m.base]));

  const buildMetrics = (): SystemMetric[] =>
    metricSeeds.map((m) => {
      const next = drift(values.get(m.id) ?? m.base, m.base, m.drift);
      values.set(m.id, next);
      const readout =
        m.unit === '%'
          ? m.total
            ? `${((next / 100) * parseFloat(m.total)).toFixed(1)} / ${m.total}`
            : `${next.toFixed(1)}%`
          : `${next.toFixed(1)} ↓ · ${(next * 0.28).toFixed(1)} ↑ ${m.unit}`;
      return { id: m.id, label: m.label, value: next, unit: m.unit, readout };
    });

  const buildServices = (): ServiceInfo[] =>
    serviceSeeds.map((s) => ({
      id: s.id,
      label: s.label,
      status: s.status,
      detail: s.detail,
      latencyMs: s.latency === null ? null : Math.round(s.latency + (Math.random() - 0.5) * 18),
    }));

  return {
    isMock: true,
    subscribe(listener) {
      const emit = () =>
        listener({
          metrics: buildMetrics(),
          services: buildServices(),
          timestamp: Date.now(),
          isMock: MOCK_MODE,
        });
      emit();
      const id = window.setInterval(emit, telemetryConfig.pollIntervalMs);
      return () => window.clearInterval(id);
    },
  };
}

/**
 * Placeholder for the real feed. Intentionally not implemented — it must never
 * silently start talking to a backend.
 */
function createLiveSource(): TelemetrySource {
  console.warn(
    '[jarvis] telemetry.source="live" is not implemented yet — falling back to mock data.',
  );
  return createMockSource();
}

export function createTelemetrySource(): TelemetrySource {
  return telemetryConfig.source === 'live' ? createLiveSource() : createMockSource();
}
