import type { CoreShapeProps } from '../../types';
import './shapes.css';

const TICKS = Array.from({ length: 48 }, (_, i) => i);

/** RING — three counter-rotating holographic rings around a pulsing core. */
export function RingCore({ className }: CoreShapeProps) {
  return (
    <div className={`jv-shape ${className ?? ''}`}>
      <svg className="jv-shape__svg" viewBox="0 0 200 200" role="img" aria-label="Ring core">
        {/* outer ticked ring */}
        <g className="jv-ring__group jv-ring__group--a">
          <circle className="jv-ring__track" cx="100" cy="100" r="88" />
          {TICKS.map((i) => {
            const angle = (i / TICKS.length) * Math.PI * 2;
            const long = i % 4 === 0;
            const r1 = long ? 80 : 84;
            return (
              <line
                key={i}
                className="jv-ring__tick"
                x1={100 + Math.cos(angle) * r1}
                y1={100 + Math.sin(angle) * r1}
                x2={100 + Math.cos(angle) * 88}
                y2={100 + Math.sin(angle) * 88}
              />
            );
          })}
          <circle
            className="jv-ring__arc"
            cx="100"
            cy="100"
            r="88"
            strokeWidth="2.5"
            strokeDasharray="120 433"
          />
        </g>

        {/* middle ring */}
        <g className="jv-ring__group jv-ring__group--b">
          <circle className="jv-ring__track" cx="100" cy="100" r="66" />
          <circle
            className="jv-ring__arc"
            cx="100"
            cy="100"
            r="66"
            strokeWidth="2"
            strokeDasharray="60 40 20 294"
          />
        </g>

        {/* inner ring */}
        <g className="jv-ring__group jv-ring__group--c">
          <circle className="jv-ring__track" cx="100" cy="100" r="46" />
          <circle
            className="jv-ring__arc"
            cx="100"
            cy="100"
            r="46"
            strokeWidth="1.6"
            strokeDasharray="30 20"
          />
        </g>

        {/* core */}
        <circle className="jv-ring__core" cx="100" cy="100" r="26" />
        <circle className="jv-ring__core" cx="100" cy="100" r="12" />
      </svg>
    </div>
  );
}
