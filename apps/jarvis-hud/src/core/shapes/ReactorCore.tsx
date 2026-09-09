import type { CoreShapeProps } from '../../types';
import './shapes.css';

const SEGMENTS = Array.from({ length: 10 }, (_, i) => i);
const COILS = Array.from({ length: 8 }, (_, i) => i);

/** REACTOR — layered arc-reactor assembly with slowly rotating housings. */
export function ReactorCore({ className }: CoreShapeProps) {
  return (
    <div className={`jv-shape ${className ?? ''}`}>
      <svg className="jv-shape__svg" viewBox="0 0 200 200" role="img" aria-label="Reactor core">
        <circle className="jv-reactor__glow" cx="100" cy="100" r="78" />

        {/* outer housing with segmented energy arcs */}
        <g className="jv-reactor__spin">
          <circle className="jv-reactor__housing" cx="100" cy="100" r="84" />
          {SEGMENTS.map((i) => {
            const circumference = 2 * Math.PI * 84;
            const seg = circumference / SEGMENTS.length;
            return (
              <circle
                key={i}
                className="jv-reactor__segment"
                cx="100"
                cy="100"
                r="84"
                strokeDasharray={`${seg * 0.62} ${circumference}`}
                strokeDashoffset={-seg * i}
                opacity={0.35 + (i % 3) * 0.25}
              />
            );
          })}
        </g>

        {/* coil ring */}
        <g className="jv-reactor__spin-rev">
          <circle className="jv-reactor__inner-ring" cx="100" cy="100" r="62" />
          {COILS.map((i) => {
            const a = (i / COILS.length) * Math.PI * 2;
            const x = 100 + Math.cos(a) * 62;
            const y = 100 + Math.sin(a) * 62;
            return (
              <g key={i} transform={`rotate(${(i / COILS.length) * 360} ${x} ${y})`}>
                <rect className="jv-reactor__coil" x={x - 7} y={y - 11} width="14" height="22" rx="3" />
              </g>
            );
          })}
        </g>

        {/* inner rings + core */}
        <circle className="jv-reactor__inner-ring" cx="100" cy="100" r="44" />
        <circle className="jv-reactor__inner-ring" cx="100" cy="100" r="36" opacity="0.5" />
        <g className="jv-reactor__spin">
          <circle
            className="jv-reactor__segment"
            cx="100"
            cy="100"
            r="30"
            strokeWidth="3"
            strokeDasharray="24 14"
          />
        </g>
        <circle className="jv-reactor__core" cx="100" cy="100" r="20" />
        <circle className="jv-reactor__core" cx="100" cy="100" r="9" opacity="0.9" />
      </svg>
    </div>
  );
}
