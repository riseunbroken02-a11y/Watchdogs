/**
 * Live telemetry provider.
 *
 * Implements the same `TelemetryProvider` contract as the mock, by polling.
 *
 * Expected endpoint shape:
 *   GET /metrics → { metrics: [{ id, label, value, unit, readout }] }
 *
 * A failed poll keeps the last good snapshot rather than blanking the cards,
 * and reports the failure once on the bus instead of on every tick.
 */

import type {
  EventBus,
  MetricSample,
  TelemetryProvider,
  TelemetrySnapshot,
} from '../../contracts';
import type { HttpClient } from './httpClient';

interface RemoteMetric {
  id?: string;
  label?: string;
  value?: number;
  unit?: string;
  readout?: string;
}

function toMetric(raw: RemoteMetric): MetricSample | null {
  if (typeof raw.id !== 'string' || typeof raw.value !== 'number') return null;
  const unit = raw.unit ?? '%';
  return {
    id: raw.id,
    label: raw.label ?? raw.id.toUpperCase(),
    value: Math.max(0, Math.min(100, raw.value)),
    unit,
    readout: raw.readout ?? `${raw.value.toFixed(1)}${unit === '%' ? '%' : ` ${unit}`}`,
  };
}

export function createLiveTelemetry(
  http: HttpClient,
  bus: EventBus,
  pollIntervalMs: number,
): TelemetryProvider {
  return {
    adapter: 'live',
    isMock: false,
    subscribe(listener: (snapshot: TelemetrySnapshot) => void) {
      let stopped = false;
      let lastMetrics: MetricSample[] = [];
      let reportedFailure = false;

      const poll = async () => {
        const result = await http.get<{ metrics?: RemoteMetric[] }>('/metrics');
        if (stopped) return;

        if (!result.ok) {
          // Report once per outage, not once per tick.
          if (!reportedFailure) {
            reportedFailure = true;
            bus.emit('system.error', {
              source: 'TELEMETRY',
              message: `Metrics poll failed: ${result.error}`,
            });
          }
          return;
        }

        if (reportedFailure) {
          reportedFailure = false;
          bus.emit('system.info', {
            source: 'TELEMETRY',
            message: 'Metrics endpoint recovered',
            level: 'info',
          });
        }

        const metrics = (result.data?.metrics ?? [])
          .map(toMetric)
          .filter((m): m is MetricSample => m !== null);
        if (metrics.length > 0) lastMetrics = metrics;

        listener({
          metrics: lastMetrics,
          timestamp: Date.now(),
          adapter: 'live',
          isMock: false,
        });
      };

      void poll();
      const id = setInterval(() => void poll(), pollIntervalMs);
      return () => {
        stopped = true;
        clearInterval(id);
      };
    },
  };
}
