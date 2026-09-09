import { palette } from '../config/jarvis.config';
import './StatBar.css';

interface StatBarProps {
  label: string;
  /** 0..100 */
  value: number;
  unit: string;
  readout: string;
}

/** Colour the bar by load: cyan → amber → red. */
function toneFor(value: number): string {
  if (value >= 85) return palette.danger;
  if (value >= 68) return palette.warning;
  return 'var(--jv-state)';
}

/** One labelled meter in the SYSTEM STATUS panel. */
export function StatBar({ label, value, unit, readout }: StatBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="jv-stat" style={{ '--jv-tone': toneFor(clamped) } as React.CSSProperties}>
      <div className="jv-stat__top">
        <span className="jv-stat__label">{label}</span>
        <span className="jv-stat__value">
          {value.toFixed(unit === '%' ? 0 : 1)}
          {unit === '%' ? '%' : ` ${unit}`}
        </span>
      </div>
      <div className="jv-stat__track">
        <div className="jv-stat__fill" style={{ width: `${clamped}%` }} />
      </div>
      <span className="jv-stat__readout">{readout}</span>
    </div>
  );
}
