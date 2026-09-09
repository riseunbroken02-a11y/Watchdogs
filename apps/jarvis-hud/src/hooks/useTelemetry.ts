import { useEffect, useMemo, useState } from 'react';
import { createTelemetrySource } from '../services/telemetry';
import type { TelemetrySnapshot } from '../types';

const EMPTY: TelemetrySnapshot = {
  metrics: [],
  services: [],
  timestamp: 0,
  isMock: true,
};

/** Subscribes to the configured telemetry source (mock in phase 2). */
export function useTelemetry(): TelemetrySnapshot {
  const source = useMemo(() => createTelemetrySource(), []);
  const [snapshot, setSnapshot] = useState<TelemetrySnapshot>(EMPTY);

  useEffect(() => source.subscribe(setSnapshot), [source]);

  return snapshot;
}
