import { palette } from '../config/jarvis.config';
import type { AgentStatus, ConnectorState, ServiceStatus } from '../types';

/** Every status value the HUD can show, across services, agents and connectors. */
export type AnyStatus = ServiceStatus | AgentStatus | ConnectorState;

export interface StatusMeta {
  label: string;
  tone: string;
  /** Live things pulse; dormant things don't. */
  pulse: boolean;
  hollow: boolean;
}

/**
 * One vocabulary for every status in the HUD. Panels read from this instead of
 * defining their own colour/label maps.
 */
export const STATUS_META: Record<AnyStatus, StatusMeta> = {
  // services
  online: { label: 'ONLINE', tone: palette.success, pulse: true, hollow: false },
  offline: { label: 'OFFLINE', tone: palette.textDim, pulse: false, hollow: true },
  warning: { label: 'WARNING', tone: palette.warning, pulse: true, hollow: false },
  mock: { label: 'MOCK', tone: palette.violet, pulse: true, hollow: false },
  // agents
  active: { label: 'ACTIVE', tone: palette.success, pulse: true, hollow: false },
  working: { label: 'WORKING', tone: palette.warning, pulse: true, hollow: false },
  idle: { label: 'IDLE', tone: palette.textDim, pulse: false, hollow: true },
  // connectors
  connected: { label: 'CONNECTED', tone: palette.success, pulse: true, hollow: false },
  disconnected: { label: 'DISCONNECTED', tone: palette.danger, pulse: false, hollow: true },
  'not-configured': { label: 'NOT CONFIGURED', tone: palette.textFaint, pulse: false, hollow: true },
};

export function statusTone(status: AnyStatus): string {
  return STATUS_META[status].tone;
}
