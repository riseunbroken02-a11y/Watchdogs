import { memo } from 'react';
import { palette } from '../config/jarvis.config';
import './StatusCards.css';

interface MetricCardProps {
  label: string;
  /** 0..100 */
  value: number;
  unit: string;
  readout: string;
  /** True when a high value is good (e.g. free headroom). */
  invert?: boolean;
}

/** Colour by load: cyan → amber → red (reversed for "free" style metrics). */
function toneFor(value: number, invert: boolean): string {
  const load = invert ? 100 - value : value;
  if (load >= 85) return palette.danger;
  if (load >= 68) return palette.warning;
  return 'var(--jv-state)';
}

/** One machine metric: CPU, RAM, STORAGE, NETWORK, HEADROOM. */
export const MetricCard = memo(function MetricCard({
  label,
  value,
  unit,
  readout,
  invert = false,
}: MetricCardProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="jv-card" style={{ '--jv-tone': toneFor(clamped, invert) } as React.CSSProperties}>
      <div className="jv-card__top">
        <span className="jv-card__label">{label}</span>
        <span className="jv-card__value">
          {value.toFixed(unit === '%' ? 0 : 1)}
          {unit === '%' ? <span className="jv-card__unit">%</span> : null}
        </span>
      </div>
      <div className="jv-card__track">
        <div className="jv-card__fill" style={{ width: `${clamped}%` }} />
      </div>
      <span className="jv-card__sub">{readout}</span>
    </div>
  );
});

interface SubsystemCardProps {
  label: string;
  value: string;
  sub: string;
  tone: string;
  /** 0..100 fill, when the subsystem has a meaningful ratio. */
  ratio?: number;
}

/** One registry/service card: AGENTS, MEMORY, CONNECTORS. */
export const SubsystemCard = memo(function SubsystemCard({
  label,
  value,
  sub,
  tone,
  ratio,
}: SubsystemCardProps) {
  return (
    <div className="jv-card" style={{ '--jv-tone': tone } as React.CSSProperties}>
      <div className="jv-card__top">
        <span className="jv-card__label">{label}</span>
        <span className="jv-card__value">{value}</span>
      </div>
      {ratio === undefined ? null : (
        <div className="jv-card__track">
          <div className="jv-card__fill" style={{ width: `${Math.max(0, Math.min(100, ratio))}%` }} />
        </div>
      )}
      <span className="jv-card__sub">{sub}</span>
    </div>
  );
});
