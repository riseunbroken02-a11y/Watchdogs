import type { CoreShapeProps } from '../../types';
import './shapes.css';

/** MINIMAL — a single glowing circle. Nothing else. */
export function MinimalCore({ className }: CoreShapeProps) {
  return (
    <div className={`jv-shape ${className ?? ''}`}>
      <div className="jv-minimal" />
    </div>
  );
}
