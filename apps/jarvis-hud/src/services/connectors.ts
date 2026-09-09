/**
 * Connector registry — SIMULATION ONLY.
 *
 * Reports what *would* be connected. Nothing is authenticated, opened or
 * called: no GitHub token is read, no Notion workspace is contacted, no
 * Obsidian vault is touched, no browser session is launched.
 */

import { connectorSeeds } from '../config/mock.config';
import type { ConnectorInfo } from '../types';

export function createConnectors(): ConnectorInfo[] {
  return connectorSeeds.map((seed) => ({
    id: seed.id,
    label: seed.label,
    state: seed.state,
    detail: seed.detail,
  }));
}
