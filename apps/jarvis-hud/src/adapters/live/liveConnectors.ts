/**
 * Live connector adapter.
 *
 * Implements the same `Connector` contract as the mock, over a local broker
 * that already holds whatever credentials each integration needs. The HUD asks
 * the broker how things are; it never authenticates to GitHub, Notion, Gmail
 * or Calendar itself, and never sees their tokens.
 *
 * Expected endpoint shape:
 *   GET /connectors            → { connectors: [{ id, name, status,
 *                                                 capabilities, detail }] }
 *   GET /connectors/:id/health → { status, latencyMs, detail }
 *
 * `healthCheck()` is a read. Anything that writes through a connector goes via
 * a command handler and the approval gate, never from this file.
 */

import type {
  Connector,
  ConnectorCapability,
  ConnectorHealth,
  ConnectorStatus,
} from '../../contracts';
import type { HttpClient } from './httpClient';

interface RemoteConnector {
  id?: string;
  name?: string;
  status?: string;
  capabilities?: string[];
  detail?: string;
}

const STATUSES: ConnectorStatus[] = ['connected', 'disconnected', 'mock', 'not-configured'];
const CAPABILITIES: ConnectorCapability[] = [
  'read',
  'write',
  'search',
  'notify',
  'schedule',
  'execute',
];

const toStatus = (raw: unknown): ConnectorStatus =>
  STATUSES.includes(raw as ConnectorStatus) ? (raw as ConnectorStatus) : 'not-configured';

const toCapabilities = (raw: unknown): ConnectorCapability[] =>
  Array.isArray(raw)
    ? raw.filter((c): c is ConnectorCapability => CAPABILITIES.includes(c as ConnectorCapability))
    : [];

class LiveConnector implements Connector {
  readonly id: string;
  readonly name: string;
  readonly capabilities: ConnectorCapability[];
  readonly status: ConnectorStatus;
  private readonly detail: string;

  constructor(
    private readonly http: HttpClient,
    remote: RemoteConnector & { id: string },
  ) {
    this.id = remote.id;
    this.name = remote.name ?? remote.id;
    this.status = toStatus(remote.status);
    this.capabilities = toCapabilities(remote.capabilities);
    this.detail = remote.detail ?? '';
  }

  async healthCheck(): Promise<ConnectorHealth> {
    const result = await this.http.get<{ status?: string; latencyMs?: number; detail?: string }>(
      `/connectors/${encodeURIComponent(this.id)}/health`,
    );

    if (!result.ok) {
      return {
        status: 'disconnected',
        latencyMs: null,
        detail: result.error,
        checkedAt: Date.now(),
      };
    }

    return {
      status: toStatus(result.data?.status),
      latencyMs:
        typeof result.data?.latencyMs === 'number' ? result.data.latencyMs : result.latencyMs,
      detail: result.data?.detail ?? this.detail,
      checkedAt: Date.now(),
    };
  }
}

/** Empty means the broker answered with nothing usable — a failed binding. */
export async function createLiveConnectors(http: HttpClient): Promise<Connector[]> {
  const result = await http.get<{ connectors?: RemoteConnector[] }>('/connectors');
  if (!result.ok || !Array.isArray(result.data?.connectors)) return [];

  return result.data.connectors
    .filter((c): c is RemoteConnector & { id: string } => typeof c.id === 'string')
    .map((c) => new LiveConnector(http, c));
}
