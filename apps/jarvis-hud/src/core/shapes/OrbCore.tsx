import type { CoreShapeProps } from '../../types';
import './shapes.css';

/** ORB — glowing volumetric sphere with a soft pulse and orbital halos. */
export function OrbCore({ className }: CoreShapeProps) {
  return (
    <div className={`jv-shape ${className ?? ''}`}>
      <div className="jv-orb">
        <div className="jv-orb__sheen" />
        <div className="jv-orb__equator" />
        <div className="jv-orb__halo" />
        <div className="jv-orb__halo jv-orb__halo--2" />
      </div>
    </div>
  );
}
