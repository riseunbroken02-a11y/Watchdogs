/**
 * Connector registry.
 *
 * Health checks run through here so every result lands on the bus as a
 * connector.status event. Phase 3 adapters resolve locally — no socket is
 * opened, no credential is read.
 */

import type {
  Connector,
  ConnectorHealth,
  ConnectorRegistry,
  ConnectorStatus,
  ConnectorView,
} from '../contracts';

export function createConnectorRegistry(bus: import('../contracts').EventBus): ConnectorRegistry {
  const connectors = new Map<string, Connector>();
  const health = new Map<string, ConnectorHealth>();
  /** Last status we published per connector, so repeats stay off the log. */
  const published = new Map<string, ConnectorStatus>();

  const view = (connector: Connector): ConnectorView => {
    const last = health.get(connector.id);
    return {
      id: connector.id,
      name: connector.name,
      status: last?.status ?? connector.status,
      capabilities: connector.capabilities,
      detail: last?.detail ?? '',
      latencyMs: last?.latencyMs ?? null,
      checkedAt: last?.checkedAt ?? null,
    };
  };

  return {
    register(connector) {
      connectors.set(connector.id, connector);
      // Seed with the declared status: the first probe confirms it rather than
      // reporting it as news.
      published.set(connector.id, connector.status);
    },

    get(id) {
      return connectors.get(id);
    },

    list() {
      return [...connectors.values()].map(view);
    },

    async check(id) {
      const connector = connectors.get(id);
      if (!connector) return null;

      const result = await connector.healthCheck();
      health.set(id, result);

      // A status event marks a transition. Publishing an unchanged status on
      // every sweep would bury everything else in the activity log.
      if (published.get(id) !== result.status) {
        published.set(id, result.status);
        bus.emit('connector.status', {
          connectorId: connector.id,
          connectorName: connector.name,
          status: result.status,
          detail: result.detail,
        });
      }
      return result;
    },

    async checkAll() {
      await Promise.all([...connectors.keys()].map((id) => this.check(id)));
      const views = this.list();
      const reachable = views.filter(
        (v) => v.status === 'mock' || v.status === 'connected',
      ).length;
      bus.emit('system.info', {
        source: 'CONNECTOR REGISTRY',
        message: `Health sweep — ${reachable}/${views.length} connectors responded`,
        level: 'info',
      });
      return views;
    },
  };
}
