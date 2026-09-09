/**
 * Mock connector adapters.
 *
 * Each connector implements the same `Connector` interface a real integration
 * would, including `healthCheck()`. Every check resolves locally.
 *
 * EXPLICITLY NOT DONE HERE, BY DESIGN:
 *   - no network request, socket or webhook
 *   - no OAuth flow and no token exchange
 *   - no credential, API key or environment variable is read
 *   - no external write of any kind
 *
 * PHASE 4: a real connector takes its credentials from an injected provider
 * passed into its factory — never from this repo's config or source.
 */

import type {
  Connector,
  ConnectorCapability,
  ConnectorHealth,
  ConnectorStatus,
} from '../../contracts';
import { connectorSeeds } from '../../config/mock.config';

class MockConnector implements Connector {
  readonly id: string;
  readonly name: string;
  readonly capabilities: ConnectorCapability[];
  readonly status: ConnectorStatus;
  private readonly detail: string;

  constructor(seed: {
    id: string;
    label: string;
    state: ConnectorStatus;
    detail: string;
    capabilities: ConnectorCapability[];
  }) {
    this.id = seed.id;
    this.name = seed.label;
    this.status = seed.state;
    this.detail = seed.detail;
    this.capabilities = seed.capabilities;
  }

  async healthCheck(): Promise<ConnectorHealth> {
    // Simulated round-trip. Nothing is contacted.
    await new Promise((r) => setTimeout(r, 10 + Math.random() * 40));

    const reachable = this.status === 'mock' || this.status === 'connected';
    return {
      status: this.status,
      latencyMs: reachable ? Math.round(18 + Math.random() * 70) : null,
      detail: this.detail,
      checkedAt: Date.now(),
    };
  }
}

export function createMockConnectors(): Connector[] {
  return connectorSeeds.map((seed) => new MockConnector(seed));
}
