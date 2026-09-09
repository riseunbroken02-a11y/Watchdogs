import type { CoreShapeProps } from '../../types';
import './shapes.css';

/**
 * CUSTOM — reserved slot for your own core.
 *
 * To add one:
 *   1. Copy this file to e.g. `MyCore.tsx` and draw whatever you like. The
 *      component receives { state, intensity } and should honour the CSS
 *      variables --jv-state (accent colour) and --i (0..1 intensity).
 *   2. Register it in `src/core/shapes/registry.ts`.
 *   3. Add an entry to `coreShapes` in `src/config/jarvis.config.ts`.
 * It then appears in the CORE SHAPE selector automatically.
 */
export function CustomCore({ className }: CoreShapeProps) {
  return (
    <div className={`jv-shape ${className ?? ''}`}>
      <div className="jv-custom">
        <div className="jv-custom__title">CUSTOM SLOT</div>
        <p className="jv-custom__body">
          Drop your own core component here. It receives the current state and
          intensity, and inherits the live accent colour.
        </p>
        <div className="jv-custom__code">src/core/shapes/registry.ts</div>
      </div>
    </div>
  );
}
