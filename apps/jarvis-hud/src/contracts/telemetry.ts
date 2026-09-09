/**
 * Telemetry contract.
 *
 * The provider pushes snapshots; the HUD renders whatever it is given. A real
 * provider (an OS probe, a metrics endpoint, an MCP tool) implements the same
 * interface and the panels do not change.
 */

export interface MetricSample {
  id: string;
  label: string;
  /** 0..100, already normalised by the provider. */
  value: number;
  unit: string;
  /** Secondary readout, e.g. "14.2 / 32 GB". */
  readout: string;
}

export interface TelemetrySnapshot {
  metrics: MetricSample[];
  timestamp: number;
  /** Adapter identifier, e.g. "mock". Drives the SIMULATED / LIVE label. */
  adapter: string;
  /** True while values are simulated. */
  isMock: boolean;
}

export interface TelemetryProvider {
  readonly adapter: string;
  readonly isMock: boolean;
  subscribe(listener: (snapshot: TelemetrySnapshot) => void): () => void;
}
