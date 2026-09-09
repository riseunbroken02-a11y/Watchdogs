/**
 * Mock telemetry provider.
 *
 * Produces plausible machine metrics in the browser. No OS is probed, no
 * metrics endpoint is polled.
 *
 * PHASE 4: implement the same `TelemetryProvider` interface over a real source
 * and pass it to `createJarvisRuntime`. The status cards do not change; the
 * SIMULATED badge flips to LIVE on its own because it follows `isMock`.
 */

import type { MetricSample, TelemetryProvider, TelemetrySnapshot } from '../../contracts';
import { metricSeeds } from '../../config/mock.config';

const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));

/** Smooth pseudo-random drift so the meters breathe instead of jitter. */
function drift(current: number, base: number, amount: number): number {
  const pullToBase = (base - current) * 0.06;
  const noise = (Math.random() - 0.5) * amount * 0.35;
  return clamp(current + pullToBase + noise, 1, 99);
}

export function createMockTelemetry(pollIntervalMs: number): TelemetryProvider {
  const values = new Map<string, number>(metricSeeds.map((m) => [m.id, m.base]));

  const sample = (): MetricSample[] =>
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

  return {
    adapter: 'mock',
    isMock: true,
    subscribe(listener: (snapshot: TelemetrySnapshot) => void) {
      const emit = () =>
        listener({ metrics: sample(), timestamp: Date.now(), adapter: 'mock', isMock: true });
      emit();
      const id = setInterval(emit, pollIntervalMs);
      return () => clearInterval(id);
    },
  };
}
