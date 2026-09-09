import { palette } from '../config/jarvis.config';
import type { AgentStatus, ConnectorStatus, EventStatus } from '../contracts';

/** Every status value the HUD can show, across agents, connectors and events. */
export type AnyStatus = AgentStatus | ConnectorStatus | EventStatus;

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
  // agents
  active: { label: 'ACTIVE', tone: palette.success, pulse: true, hollow: false },
  working: { label: 'WORKING', tone: palette.warning, pulse: true, hollow: false },
  idle: { label: 'IDLE', tone: palette.textDim, pulse: false, hollow: true },
  warning: { label: 'WARNING', tone: palette.warning, pulse: true, hollow: false },
  offline: { label: 'OFFLINE', tone: palette.textDim, pulse: false, hollow: true },
  // connectors
  connected: { label: 'CONNECTED', tone: palette.success, pulse: true, hollow: false },
  disconnected: { label: 'DISCONNECTED', tone: palette.danger, pulse: false, hollow: true },
  mock: { label: 'MOCK', tone: palette.violet, pulse: true, hollow: false },
  'not-configured': { label: 'NOT CONFIGURED', tone: palette.textFaint, pulse: false, hollow: true },
  // events
  ok: { label: 'OK', tone: palette.success, pulse: false, hollow: false },
  pending: { label: 'PENDING', tone: palette.accent, pulse: true, hollow: false },
  error: { label: 'ERROR', tone: palette.danger, pulse: false, hollow: false },
};

export function statusTone(status: AnyStatus): string {
  return STATUS_META[status].tone;
}
