/**
 * Connector contract.
 *
 * A connector describes an integration and can report its own health. Phase 3
 * connectors are mock: `healthCheck()` resolves locally and opens no socket,
 * performs no OAuth and reads no credential.
 */

export type ConnectorStatus = 'connected' | 'disconnected' | 'mock' | 'not-configured';

/** What a connector would be able to do once it is real. */
export type ConnectorCapability =
  | 'read'
  | 'write'
  | 'search'
  | 'notify'
  | 'schedule'
  | 'execute';

export interface ConnectorHealth {
  status: ConnectorStatus;
  /** Round-trip in ms, or null when not applicable. */
  latencyMs: number | null;
  detail: string;
  checkedAt: number;
}

export interface Connector {
  readonly id: string;
  readonly name: string;
  readonly capabilities: ConnectorCapability[];
  /** Last known status without performing a check. */
  readonly status: ConnectorStatus;
  /**
   * Probes the integration. Mock adapters resolve immediately.
   *
   * A real implementation MUST take its credentials from an injected provider
   * — never from config, source or environment literals in this repo.
   */
  healthCheck(): Promise<ConnectorHealth>;
}

/** Registry view: the connector plus the result of its last health check. */
export interface ConnectorView {
  id: string;
  name: string;
  status: ConnectorStatus;
  capabilities: ConnectorCapability[];
  detail: string;
  latencyMs: number | null;
  checkedAt: number | null;
}

export interface ConnectorRegistry {
  register(connector: Connector): void;
  get(id: string): Connector | undefined;
  list(): ConnectorView[];
  /** Runs one health check and emits connector.status. */
  check(id: string): Promise<ConnectorHealth | null>;
  /** Runs every health check in parallel. */
  checkAll(): Promise<ConnectorView[]>;
}
