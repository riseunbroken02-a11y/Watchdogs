import type { CoreShapeProps } from '../../types';
import './shapes.css';

function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`;
  }).join(' ');
}

const NODES = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 3) * i - Math.PI / 2;
  return { x: 100 + Math.cos(a) * 62, y: 100 + Math.sin(a) * 62 };
});

/** HEXAGON — nested hex lattice with digital edge lines and a slow rotation. */
export function HexagonCore({ className }: CoreShapeProps) {
  return (
    <div className={`jv-shape ${className ?? ''}`}>
      <svg className="jv-shape__svg" viewBox="0 0 200 200" role="img" aria-label="Hexagon core">
        <g className="jv-hex__group jv-hex__group--slow">
          <polygon className="jv-hex__outline jv-hex__outline--faint" points={hexPoints(100, 100, 90)} />
          <polygon className="jv-hex__outline" points={hexPoints(100, 100, 74)} />
          {NODES.map((n, i) => (
            <circle key={i} className="jv-hex__node" cx={n.x} cy={n.y} r="2.6" />
          ))}
          {NODES.map((n, i) => (
            <line
              key={`l-${i}`}
              className="jv-hex__line"
              x1={n.x}
              y1={n.y}
              x2={NODES[(i + 2) % 6].x}
              y2={NODES[(i + 2) % 6].y}
            />
          ))}
        </g>

        <g className="jv-hex__group jv-hex__group--rev">
          <polygon className="jv-hex__outline jv-hex__outline--faint" points={hexPoints(100, 100, 48)} />
        </g>

        <polygon className="jv-hex__fill" points={hexPoints(100, 100, 34)} />
        <polygon className="jv-hex__outline" points={hexPoints(100, 100, 34)} />
        <polygon className="jv-hex__outline jv-hex__outline--faint" points={hexPoints(100, 100, 18)} />

        {/* digital readout ticks along the top edge */}
        {Array.from({ length: 12 }, (_, i) => (
          <rect
            key={`t-${i}`}
            className="jv-hex__node"
            x={64 + i * 6}
            y={186}
            width="2.5"
            height={i % 3 === 0 ? 7 : 4}
            opacity={0.35 + (i % 4) * 0.15}
          />
        ))}
      </svg>
    </div>
  );
}
