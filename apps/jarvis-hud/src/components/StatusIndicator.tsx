import { STATUS_META, type AnyStatus } from './statusMeta';
import './StatusIndicator.css';

/** Small pulsing dot shared by the services, agents and connectors panels. */
export function StatusDot({ status }: { status: AnyStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`jv-dot ${meta.pulse ? 'jv-dot--pulse' : ''} ${meta.hollow ? 'jv-dot--hollow' : ''}`}
      style={{ '--jv-tone': meta.tone } as React.CSSProperties}
    />
  );
}

/** Uppercase status label, e.g. ONLINE / MOCK / NOT CONFIGURED. */
export function StatusChip({ status }: { status: AnyStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`jv-chip ${status === 'mock' ? 'jv-chip--mock' : ''}`}
      style={{ '--jv-tone': meta.tone } as React.CSSProperties}
    >
      {meta.label}
    </span>
  );
}
