import { useMemo } from 'react';
import type { CoreShapeProps } from '../../types';
import './shapes.css';

const PARTICLE_COUNT = 18;

/** HOLOGRAM — translucent projected core with scanlines and floating particles. */
export function HologramCore({ className }: CoreShapeProps) {
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        left: `${8 + ((i * 37) % 84)}%`,
        dur: `${4.5 + ((i * 13) % 40) / 10}s`,
        delay: `${-((i * 7) % 45) / 10}s`,
      })),
    [],
  );

  return (
    <div className={`jv-shape ${className ?? ''}`}>
      <div className="jv-holo">
        <div className="jv-holo__body" />
        <div className="jv-holo__scanlines">
          <div className="jv-holo__sweep" />
        </div>
        {particles.map((p, i) => (
          <span
            key={i}
            className="jv-holo__particle"
            style={
              {
                left: p.left,
                '--dur': p.dur,
                '--delay': p.delay,
              } as React.CSSProperties
            }
          />
        ))}
        <div className="jv-holo__base" />
      </div>
    </div>
  );
}
