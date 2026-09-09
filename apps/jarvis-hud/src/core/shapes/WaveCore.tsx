import { useEffect, useRef } from 'react';
import type { CoreShapeProps } from '../../types';
import './shapes.css';

const WIDTH = 200;
const SAMPLES = 96;

/**
 * WAVE — a live waveform that swells with the core's intensity.
 * The path is written straight to the DOM node so the animation costs no React
 * re-renders.
 */
export function WaveCore({ intensity, className }: CoreShapeProps) {
  const pathRef = useRef<SVGPathElement | null>(null);
  const ghostRef = useRef<SVGPathElement | null>(null);
  const intensityRef = useRef(intensity);
  intensityRef.current = intensity;

  useEffect(() => {
    let raf = 0;
    const start = performance.now();

    const build = (t: number, amp: number, phase: number) => {
      let d = '';
      for (let i = 0; i <= SAMPLES; i += 1) {
        const x = (i / SAMPLES) * WIDTH;
        // Envelope keeps the waveform centred and fading at both ends.
        const envelope = Math.sin((i / SAMPLES) * Math.PI) ** 1.6;
        const y =
          100 +
          envelope *
            amp *
            (Math.sin(i * 0.28 + t * 2.4 + phase) * 0.6 +
              Math.sin(i * 0.11 - t * 1.5 + phase) * 0.3 +
              Math.sin(i * 0.53 + t * 3.7 + phase) * 0.18);
        d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
      }
      return d;
    };

    const tick = (now: number) => {
      const t = (now - start) / 1000;
      const amp = 12 + intensityRef.current * 52;
      pathRef.current?.setAttribute('d', build(t, amp, 0));
      ghostRef.current?.setAttribute('d', build(t, amp * 0.6, 1.9));
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className={`jv-shape ${className ?? ''}`}>
      <svg className="jv-shape__svg" viewBox="0 0 200 200" role="img" aria-label="Wave core">
        <circle className="jv-wave__ring" cx="100" cy="100" r="88" />
        <circle className="jv-wave__ring" cx="100" cy="100" r="72" opacity="0.5" />

        {/* level bars framing the waveform */}
        {Array.from({ length: 24 }, (_, i) => {
          const h = 3 + ((i * 7) % 11);
          return (
            <g key={i}>
              <rect className="jv-wave__bar" x={i * 8 + 4} y={168} width="2" height={h} opacity={0.2 + (i % 5) * 0.12} />
              <rect className="jv-wave__bar" x={i * 8 + 4} y={32 - h} width="2" height={h} opacity={0.2 + (i % 3) * 0.15} />
            </g>
          );
        })}

        <path ref={ghostRef} className="jv-wave__path jv-wave__path--ghost" d="" />
        <path ref={pathRef} className="jv-wave__path" d="" />
      </svg>
    </div>
  );
}
